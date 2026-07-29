/**
 * Track-day helpers. Pure functions only — day grouping math lives here,
 * honesty gates reuse MIN_LAPS_FOR_INSIGHTS and sessionConsistencySeconds.
 */
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';

/** Track-local calendar date as YYYY-MM-DD. Throws RangeError on an unparseable timestamp; a null/invalid IANA name falls back to UTC. */
export function localDateForTimezone(isoTimestamp: string, timezone: string | null): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`localDateForTimezone: invalid timestamp "${isoTimestamp}"`);
  }
  // Fall back to UTC only for an unusable IANA name — never for an unusable timestamp.
  let tz = timezone ?? 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // en-CA -> YYYY-MM-DD
}

/**
 * Session ordering for a track day — the ONE comparator, used by both the data
 * layer's queries and dayConsistencyTrend below.
 *
 * This ordering IS the "Session 1..N" numbering rendered on the day page and in
 * session prev/next nav, and it is the order the day-KPI σ trend reports
 * "first -> last" over. Two comparators would let the KPI describe different
 * sessions than the cards underneath it, so there is only ever one.
 *
 * Sorts on sessions.date (TIMESTAMPTZ — the session's start time), not
 * track_days.date (a plain calendar date, identical for every session in a day).
 *
 * Session id breaks a tie. Two sessions can share a start time (a CSV with a
 * date-only column, a double-entered session), and without a tiebreak their
 * "Session N" numbering falls back to whatever order the row set arrived in —
 * which the day page and the session page have no reason to agree on. id is
 * arbitrary but stable, which is the whole requirement. Optional because
 * SessionForTrend callers may not carry one; when it is absent the tie simply
 * stays unresolved rather than being resolved differently in each caller.
 */
export function bySessionStart(
  a: { date: string; id?: string },
  b: { date: string; id?: string }
): number {
  return (
    new Date(a.date).getTime() - new Date(b.date).getTime() ||
    (a.id ?? '').localeCompare(b.id ?? '')
  );
}

/** Fastest best lap across the day, in MILLISECONDS. Null when no session has a positive best lap. */
export function dayBestLapMs(sessions: Array<{ bestLapMs: number | null }>): number | null {
  const bests = sessions
    .map((s) => s.bestLapMs)
    .filter((b): b is number => b !== null && b > 0);
  return bests.length ? Math.min(...bests) : null;
}

export interface ConsistencyTrend {
  firstSeconds: number;
  lastSeconds: number;
}

export interface SessionForTrend {
  date: string;
  lapTimesMs: number[];
  /** Optional, but pass it when you have one: it is bySessionStart's tiebreak. */
  id?: string;
}

/**
 * σ (SECONDS) of the chronologically first and last sessions that clear the lap
 * gate; null if <2 qualify.
 *
 * Sorts by bySessionStart itself — caller order is irrelevant. That is
 * deliberate: callers hand it newest-first data (the driver page query orders
 * descending), and reporting the trend backwards would tell a driver who
 * tightened up all day that they got looser.
 */
export function dayConsistencyTrend(sessions: SessionForTrend[]): ConsistencyTrend | null {
  const sigmas = [...sessions]
    .sort(bySessionStart)
    .filter((s) => s.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS)
    .map((s) => sessionConsistencySeconds(s.lapTimesMs))
    .filter((s): s is number => s !== null);
  if (sigmas.length < 2) return null;
  return { firstSeconds: sigmas[0], lastSeconds: sigmas[sigmas.length - 1] };
}

/**
 * Decimal places every σ is displayed at. σ is never claimed finer than this,
 * so nothing derived from a σ may be either.
 */
export const SIGMA_DISPLAY_DECIMALS = 1;

/**
 * A σ snapped to the resolution it is displayed at.
 *
 * Anything computed FROM σ for display has to go through this first, or the
 * screen contradicts itself: 0.649 and 0.551 both render "±0.6s" while their
 * raw difference renders "(-0.1s)".
 */
export function displayedSigmaSeconds(seconds: number): number {
  return Number(seconds.toFixed(SIGMA_DISPLAY_DECIMALS));
}

/**
 * Signed σ change from prev to curr (negative = tighter), computed from the
 * ROUNDED σ values a coach can actually read off the screen. Exactly 0 when the
 * two render identically — which is also what kills the "-0.0s" signed zero.
 */
export function displayedSigmaDeltaSeconds(prevSeconds: number, currSeconds: number): number {
  return displayedSigmaSeconds(currSeconds) - displayedSigmaSeconds(prevSeconds);
}

/**
 * What a rendered σ trend actually claims.
 *
 * The pair of numbers is first -> last QUALIFYING session, not first -> last
 * session of the day: on a four-session day where only S2 and S3 clear the lap
 * gate, "±0.6s → ±0.4s" is a claim about the middle of the day. Every view that
 * prints formatConsistencyTrend prints this beside it, from one definition, so
 * the day page and the driver page's day list cannot drift into making
 * different claims about identical numbers.
 */
export const CONSISTENCY_TREND_CLAIM = 'First to last qualifying session';

/**
 * The day's σ trend as one string: "±0.6s → ±0.4s". Null when there is no
 * honest trend to report (dayConsistencyTrend returned null) — callers supply
 * their own placeholder.
 *
 * Shared because the day page KPI and the driver page's day list render the
 * same number and must round it the same way.
 */
export function formatConsistencyTrend(trend: ConsistencyTrend | null): string | null {
  if (!trend) return null;
  const first = displayedSigmaSeconds(trend.firstSeconds).toFixed(SIGMA_DISPLAY_DECIMALS);
  const last = displayedSigmaSeconds(trend.lastSeconds).toFixed(SIGMA_DISPLAY_DECIMALS);
  return `±${first}s → ±${last}s`;
}

/** The only field of an /api/import-session response the day links care about. */
export interface ImportedSessionResponse {
  trackDayId?: string | null;
}

/**
 * The distinct track days a batch of imported sessions landed in, in the order
 * they were first seen.
 *
 * Deduped because the import loop posts one session at a time and the route
 * returns the SAME trackDayId for every session of the same driver/track/day —
 * the common case (a coach uploading one event's CSV) is N responses carrying
 * one id, which must render as one link and not N identical ones.
 *
 * Filtered, not cast: a response is only supposed to arrive without a
 * trackDayId if the route changes shape, and the failure mode of casting is a
 * link to /days/undefined, which looks like a working link until it is clicked.
 *
 * Note the count can exceed the number of calendar dates in the CSV — track
 * days are per DRIVER, so two drivers at the same event on the same date are
 * two days.
 */
export function uniqueTrackDayIds(responses: ImportedSessionResponse[]): string[] {
  const ids = responses
    .map((r) => r.trackDayId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return Array.from(new Set(ids));
}

export interface SessionDelta {
  bestLapDeltaMs: number | null;
  consistencyDeltaSeconds: number | null;
}

export interface SessionForDelta {
  bestLapMs: number | null;
  lapTimesMs: number[];
}

/**
 * Change from prev to curr, signed as `curr - prev` (negative = faster lap / tighter σ).
 * bestLapDeltaMs is MILLISECONDS, null if either best lap is null.
 * consistencyDeltaSeconds is SECONDS, null unless both sessions clear the lap gate and both σ resolve.
 */
export function sessionDelta(prev: SessionForDelta, curr: SessionForDelta): SessionDelta {
  const bestLapDeltaMs =
    prev.bestLapMs !== null && curr.bestLapMs !== null ? curr.bestLapMs - prev.bestLapMs : null;

  let consistencyDeltaSeconds: number | null = null;
  if (
    prev.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS &&
    curr.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS
  ) {
    const prevSigma = sessionConsistencySeconds(prev.lapTimesMs);
    const currSigma = sessionConsistencySeconds(curr.lapTimesMs);
    if (prevSigma !== null && currSigma !== null) {
      consistencyDeltaSeconds = currSigma - prevSigma;
    }
  }
  return { bestLapDeltaMs, consistencyDeltaSeconds };
}
