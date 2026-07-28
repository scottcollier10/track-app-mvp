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
}

/** σ (SECONDS) of the chronologically first and last sessions that clear the lap gate; null if <2 qualify. Sorts by date itself — caller order is irrelevant. */
export function dayConsistencyTrend(sessions: SessionForTrend[]): ConsistencyTrend | null {
  const sigmas = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((s) => s.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS)
    .map((s) => sessionConsistencySeconds(s.lapTimesMs))
    .filter((s): s is number => s !== null);
  if (sigmas.length < 2) return null;
  return { firstSeconds: sigmas[0], lastSeconds: sigmas[sigmas.length - 1] };
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
