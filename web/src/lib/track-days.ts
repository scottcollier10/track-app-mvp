/**
 * Track-day helpers. Pure functions only — day grouping math lives here,
 * honesty gates reuse canClaimConsistency and sessionConsistencySeconds.
 */
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { canClaimConsistency } from '@/lib/insights';
import type {
  AssessmentJudgment,
  FocusItemStatus,
  ImportedSessionResponse,
} from '@/lib/types';

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

/**
 * The lap times that COUNT, in MILLISECONDS — the app's one definition of "a
 * lap", used for every honesty gate and every σ input.
 *
 * A 0 or negative lap time is not a lap, and nothing downstream treats it as
 * one: sessionConsistencySeconds drops it before computing σ. But the
 * canClaimConsistency gate is applied by the CALLER, not by
 * sessionConsistencySeconds, so a caller that counts laps σ never saw makes the
 * gate stop describing the figure it guards — "±0.4s, 6 laps" over a σ of five.
 *
 * That is reachable, not hypothetical: csv-parser only rejects a lap time that
 * fails parseInt ("0" and "-5000" both survive, and "0" is truthy so it clears
 * the missing-field check too), the import route adds no positivity check, and
 * laps.lap_time_ms has no CHECK > 0. One such session used to render three ways
 * — dropped from the driver page's trend, σ computed WITH the zero on the day
 * page, and σ over five laps behind a satisfied six-lap gate on the session
 * page.
 *
 * So the gate and the σ read the same array, from here. Two derivations is how
 * they drifted apart, and one is how they stay together.
 *
 * This is a narrower question than cleanLaps() answers — "is this a lap at all",
 * not "is this a representative lap" — so the two sets are deliberately
 * different and neither replaces the other.
 */
export function validLapTimesMs(laps: Array<{ lap_time_ms: number | null }>): number[] {
  return laps.map((lap) => lap.lap_time_ms).filter((ms): ms is number => ms !== null && ms > 0);
}

/**
 * The predicate behind representativeSessions and deltaBaselineIndex — kept
 * private so "does this session count?" has exactly one answer, whichever
 * entry point asked.
 */
function countsTowardDayAggregates(session: { representativeness?: string | null }): boolean {
  return session.representativeness !== 'not_representative';
}

/**
 * The sessions a day aggregate is allowed to count — the ONE exclusion rule.
 *
 * Only an explicit 'not_representative' flag excludes. null (unflagged — every
 * pre-P2 session) and 'partial' count in FULL: a partial session is real
 * evidence with a caveat the UI renders as a chip, not evidence to hide, and
 * treating null as anything but "counts" would change every historical day the
 * moment this shipped.
 *
 * The field is optional so a caller (or an old fixture) without the column
 * behaves exactly like an unflagged session — absence and null are the same
 * case, never a third behavior.
 */
export function representativeSessions<T extends { representativeness?: string | null }>(
  sessions: T[]
): T[] {
  return sessions.filter(countsTowardDayAggregates);
}

/**
 * Fastest best lap across the day's COUNTED sessions, in MILLISECONDS. Null
 * when no counted session has a positive best lap.
 *
 * The representativeness filter is applied here, not by callers: the day page
 * KPI and the driver page's day list both render this number, and a filter
 * applied at one call site and forgotten at the other would put two different
 * "best laps of the day" one click apart.
 */
export function dayBestLapMs(
  sessions: Array<{ bestLapMs: number | null; representativeness?: string | null }>
): number | null {
  const bests = representativeSessions(sessions)
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
  /** MUST come from validLapTimesMs — the gate below counts this array. */
  lapTimesMs: number[];
  /** Optional, but pass it when you have one: it is bySessionStart's tiebreak. */
  id?: string;
  /** Absent behaves as null (counts) — see representativeSessions. */
  representativeness?: string | null;
}

/**
 * σ (SECONDS) of the chronologically first and last COUNTED sessions that clear
 * the lap gate; null if <2 qualify. A not_representative session cannot be
 * either endpoint — same rule, same place, as dayBestLapMs above.
 *
 * Sorts by bySessionStart itself — caller order is irrelevant. That is
 * deliberate: callers hand it newest-first data (the driver page query orders
 * descending), and reporting the trend backwards would tell a driver who
 * tightened up all day that they got looser.
 */
export function dayConsistencyTrend(sessions: SessionForTrend[]): ConsistencyTrend | null {
  const sigmas = representativeSessions(sessions)
    .sort(bySessionStart)
    .filter((s) => canClaimConsistency(s.lapTimesMs))
    .map((s) => sessionConsistencySeconds(s.lapTimesMs))
    .filter((s): s is number => s !== null);
  if (sigmas.length < 2) return null;
  return { firstSeconds: sigmas[0], lastSeconds: sigmas[sigmas.length - 1] };
}

/**
 * The caption a day aggregate carries when the representativeness filter
 * removed something: "(3 of 4 sessions)". Null when every session counted —
 * annotating the full set would imply a filter that did nothing.
 *
 * One formatter, because the day page KPI and the driver page's day list print
 * the same aggregate and must caption it identically or not at all.
 */
export function dayAggregateAnnotation(total: number, counted: number): string | null {
  return counted < total ? `(${counted} of ${total} sessions)` : null;
}

/**
 * The index a delta at `index` is measured against: the NEAREST EARLIER session
 * that counts (countsTowardDayAggregates — the same rule every day aggregate
 * applies). Null at the first session, and null when every earlier session is
 * excluded: "no baseline" is the honest answer, never "compare against the
 * flagged one anyway" — a delta vs a not_representative session is exactly the
 * misleading comparison the flag exists to prevent.
 *
 * `sessions` must be in day order (bySessionStart's) — the index arithmetic is
 * meaningless in any other order.
 */
export function deltaBaselineIndex(
  sessions: Array<{ representativeness?: string | null }>,
  index: number
): number | null {
  // Callers pass a render-loop index; an out-of-range one has no "earlier
  // session" to name, and null is the same honest answer index 0 gets.
  if (!Number.isInteger(index) || index < 0 || index >= sessions.length) return null;
  for (let i = index - 1; i >= 0; i--) {
    if (countsTowardDayAggregates(sessions[i])) return i;
  }
  return null;
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

/** A track day an import landed in, and the driver whose day it is. */
export interface TrackDayLink {
  trackDayId: string;
  driverName: string;
}

/**
 * The distinct track days a batch of imported sessions landed in, each paired
 * with its driver, in the order they were first seen.
 *
 * WARNING on that order: first-seen is CSV ROW ORDER, not chronological. A file
 * listing driver B's Jul 12 sessions above driver A's Jul 11 yields B's day
 * first. It is stable and deterministic, and that is all it is — never number
 * these ("track day 1", "track day 2") or otherwise present them as a sequence.
 * Every "N" a driver reads in this app comes from bySessionStart above; an
 * ordinal derived from row order would contradict it.
 *
 * Deduped because the import loop posts one session at a time and the route
 * returns the SAME trackDayId for every session of the same driver/track/day —
 * the common case (a coach uploading one event's CSV) is N responses carrying
 * one id, which must render as one link and not N identical ones.
 *
 * The driver name is safe to pair here: resolveTrackDay keys a track day on
 * (driver, track, date), so one trackDayId belongs to exactly one driver. The
 * first response carrying an id therefore names the same driver as every later
 * response carrying it, and the same driver /days/[id] renders. Unlike a date,
 * this label cannot contradict the page it links to.
 *
 * It is read off the RESPONSE (`drivers.name`, straight from the row the
 * session was filed under), never off the CSV row that produced it. Same
 * driver either way, but not necessarily the same string: a driver created by
 * an import is named from the email local part, and an existing driver's row
 * can have been named differently from whatever the file's name column says.
 * Sourcing it from the CSV would let this chip and /days/[id] spell one driver
 * two ways.
 *
 * Filtered, not cast: a response is only supposed to arrive without a
 * trackDayId if the route changes shape, and the failure mode of casting is a
 * link to /days/undefined, which looks like a working link until it is clicked.
 *
 * Note the count can exceed the number of calendar dates in the CSV — track
 * days are per DRIVER, so two drivers at the same event on the same date are
 * two days.
 */
export function uniqueTrackDayLinks(imports: ImportedSessionResponse[]): TrackDayLink[] {
  const byId = new Map<string, TrackDayLink>();
  for (const imported of imports) {
    const { trackDayId, driverName } = imported;
    if (typeof trackDayId !== 'string' || trackDayId.length === 0) continue;
    if (!byId.has(trackDayId)) byId.set(trackDayId, { trackDayId, driverName });
  }
  return Array.from(byId.values());
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
 * consistencyDeltaSeconds is SECONDS, null unless both sessions clear
 * canClaimConsistency and both σ resolve.
 */
export function sessionDelta(prev: SessionForDelta, curr: SessionForDelta): SessionDelta {
  const bestLapDeltaMs =
    prev.bestLapMs !== null && curr.bestLapMs !== null ? curr.bestLapMs - prev.bestLapMs : null;

  let consistencyDeltaSeconds: number | null = null;
  if (canClaimConsistency(prev.lapTimesMs) && canClaimConsistency(curr.lapTimesMs)) {
    const prevSigma = sessionConsistencySeconds(prev.lapTimesMs);
    const currSigma = sessionConsistencySeconds(curr.lapTimesMs);
    if (prevSigma !== null && currSigma !== null) {
      consistencyDeltaSeconds = currSigma - prevSigma;
    }
  }
  return { bestLapDeltaMs, consistencyDeltaSeconds };
}

/**
 * The full tagged union focusItemsForSession returns. An item may appear in
 * BOTH groups (an active item assessed at this session); callers own the
 * presentation split (`inPlay \ reviewed` etc.), never the eligibility rules.
 */
export interface FocusItemEligibility<I> {
  reviewed: I[];
  inPlay: I[];
}

/**
 * Which focus items belong to a session's debrief — the one definition, so the
 * session page and the day page cannot show a coach two different lists of
 * "what this driver was working on".
 *
 * `reviewed` — items with an assessment AT this session, whatever their current
 * status. An assessment is a record of a review that happened; an item achieved
 * or dropped since still shows the review that led there. Ordered by item
 * creation time (id tiebreak), so two renders cannot disagree on order.
 *
 * `inPlay` — active items that were in play COMING IN to this session:
 *
 *  - Non-null origin (created_after_session_id) found in `originSessions`:
 *    the origin must be STRICTLY earlier by bySessionStart. An item is coaching
 *    output OF its origin session — advice for the next one — so it is never
 *    "in play" during the session that produced it, and bySessionStart's id
 *    tiebreak decides tied timestamps the same way the Session N numbering does.
 *
 *  - Null origin, or an origin id missing from the map (unknown origin — same
 *    fallback): the item's created_at, as a TRACK-LOCAL calendar date, must be
 *    <= the day's date. The same-day TIE IS INCLUDED deliberately: imported
 *    session timestamps are noon-anchored, so comparing wall clocks would make
 *    "created before this session?" a coin flip for an item written the same
 *    day — ties resolve toward showing the coach their own item.
 */
export function focusItemsForSession<
  I extends {
    id: string;
    status: string;
    created_at: string;
    created_after_session_id: string | null;
  }
>(args: {
  items: I[];
  /** Assessments AT this session — not "ever assessed". */
  assessedItemIds: Set<string>;
  session: { id: string; date: string };
  /** id -> session, for origin ordering. Missing ids fall back to the date rule. */
  originSessions: Map<string, { id: string; date: string }>;
  /** track_days.date of the session's day — a plain track-local calendar date. */
  dayDate: string;
  trackTimezone: string | null;
}): FocusItemEligibility<I> {
  const { items, assessedItemIds, session, originSessions, dayDate, trackTimezone } = args;

  const byCreation = [...items].sort(byItemCreation);

  const inPlayComingIn = (item: I): boolean => {
    const origin = item.created_after_session_id
      ? originSessions.get(item.created_after_session_id)
      : undefined;
    if (origin) {
      return bySessionStart(origin, session) < 0;
    }
    return localDateForTimezone(item.created_at, trackTimezone) <= dayDate;
  };

  return {
    reviewed: byCreation.filter((item) => assessedItemIds.has(item.id)),
    inPlay: byCreation.filter((item) => item.status === 'active' && inPlayComingIn(item)),
  };
}

/**
 * The one comparator behind every focus-item list rendered anywhere: creation
 * time, id tiebreak. focusItemsForSession and focusPanelGroups both sort with
 * it, so the debrief sheet and the focus panel cannot order the same items two
 * ways.
 */
function byItemCreation(
  a: { id: string; created_at: string },
  b: { id: string; created_at: string }
): number {
  return (
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id)
  );
}

/**
 * The focus panel's three groups. Together they PARTITION the driver's items —
 * every item lands in exactly one group, because "never deleted by workflow"
 * also has to mean never invisible.
 */
export interface FocusPanelGroups<I> {
  /** status === 'active', whatever this day's evidence says. */
  active: I[];
  /** Achieved/dropped WITH an assessment on one of this day's sessions. */
  resolvedThisDay: I[];
  /** Every other non-active item — driver-scoped, NOT day-filtered. */
  pausedInactive: I[];
}

/**
 * How the day page's focus panel groups a driver's items — the one definition,
 * kept beside focusItemsForSession for the same reason: components assemble
 * inputs from the embeds, they never own grouping rules.
 *
 * INTENDED GAP, do not "fix": `resolvedThisDay` really means
 * resolved-AND-ASSESSED-on-this-day. An item dropped via the panel with no
 * assessment on any of this day's sessions has no evidence tying its
 * resolution to this day, so it appears in NO day's resolved group — it goes
 * straight to `pausedInactive`, where it stays findable. The transition log
 * that could date the resolution honestly was explicitly rejected (a new
 * table + write path + backfill guesses, to power one banner); inferring the
 * day from updated_at would be the app guessing.
 *
 * Paused is never "resolved": only achieved/dropped can be, so a paused item
 * sits in `pausedInactive` even when it WAS assessed on this day.
 */
export function focusPanelGroups<I extends { id: string; status: string; created_at: string }>(args: {
  items: I[];
  /**
   * Item ids with an assessment on ONE OF THIS DAY'S sessions — assembled by
   * the caller from the embeds, exactly like focusItemsForSession's
   * assessedItemIds.
   */
  assessedThisDayItemIds: Set<string>;
}): FocusPanelGroups<I> {
  const { items, assessedThisDayItemIds } = args;
  const byCreation = [...items].sort(byItemCreation);

  const isResolvedThisDay = (item: I): boolean =>
    (item.status === 'achieved' || item.status === 'dropped') &&
    assessedThisDayItemIds.has(item.id);

  return {
    active: byCreation.filter((item) => item.status === 'active'),
    resolvedThisDay: byCreation.filter(isResolvedThisDay),
    pausedInactive: byCreation.filter(
      (item) => item.status !== 'active' && !isResolvedThisDay(item)
    ),
  };
}

/**
 * A focus item's assessments in the order the coaching happened: by the START
 * of the session each judgment was given at (bySessionStart — the same
 * comparator behind every "Session N"), never by assessment row order or
 * created_at, which retroactive debriefs scramble.
 *
 * An assessment whose session is not in the map shouldn't exist — session
 * deletion is RESTRICTed precisely so judgments keep their anchor — so a miss
 * here is a fetch gap. Those sort LAST, ordered among themselves by session
 * id: the known timeline stays honest and the stragglers stay deterministic.
 */
export function assessmentsInSessionOrder<A extends { session_id: string }>(
  assessments: A[],
  sessionsById: Map<string, { id: string; date: string }>
): A[] {
  return [...assessments].sort((a, b) => {
    const sessionA = sessionsById.get(a.session_id);
    const sessionB = sessionsById.get(b.session_id);
    if (sessionA && sessionB) return bySessionStart(sessionA, sessionB);
    if (sessionA) return -1;
    if (sessionB) return 1;
    return a.session_id.localeCompare(b.session_id);
  });
}

/**
 * Display copy for the four judgments — one definition, because the debrief
 * sheet's buttons, the evidence banner and the focus panel's timeline all
 * print the same coach-authored judgment and must spell it identically.
 */
export const JUDGMENT_LABELS: Record<AssessmentJudgment, string> = {
  improved: 'Improved',
  keep_working: 'Keep working',
  no_change: 'No change',
  regressed: 'Regressed',
};

/**
 * Display copy for the four item statuses, for the same one-spelling reason
 * as JUDGMENT_LABELS.
 */
export const FOCUS_STATUS_LABELS: Record<FocusItemStatus, string> = {
  active: 'Active',
  achieved: 'Achieved',
  paused: 'Paused',
  dropped: 'Dropped',
};
