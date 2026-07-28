/**
 * Track-day helpers. Pure functions only — day grouping math lives here,
 * honesty gates reuse MIN_LAPS_FOR_INSIGHTS and sessionConsistencySeconds.
 */
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';

export function localDateForTimezone(isoTimestamp: string, timezone: string | null): string {
  const date = new Date(isoTimestamp);
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // en-CA -> YYYY-MM-DD
  try {
    return format(timezone ?? 'UTC');
  } catch {
    return format('UTC'); // invalid IANA name
  }
}

export function dayBestLapMs(sessions: Array<{ best_lap_ms: number | null }>): number | null {
  const bests = sessions
    .map((s) => s.best_lap_ms)
    .filter((b): b is number => b !== null);
  return bests.length ? Math.min(...bests) : null;
}

export interface ConsistencyTrend {
  firstSeconds: number;
  lastSeconds: number;
}

/** σ of the first and last sessions that clear the lap gate; null if <2 qualify. */
export function dayConsistencyTrend(lapTimesBySession: number[][]): ConsistencyTrend | null {
  const sigmas = lapTimesBySession
    .filter((laps) => laps.length >= MIN_LAPS_FOR_INSIGHTS)
    .map((laps) => sessionConsistencySeconds(laps))
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
