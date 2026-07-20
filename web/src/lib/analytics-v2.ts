import {
  CLEAN_LAP_MAX_MULTIPLE,
  MIN_CLEAN_LAPS_FOR_FADE,
  MIN_PRIOR_SESSIONS_FOR_BASELINE,
  BASELINE_SIGMA,
  BASELINE_MIN_DELTA_S,
  PB_REGRESSION_PCT,
} from './analytics-constants';

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Positive laps with out/in/pit/traffic laps (>1.25x median) removed. Preserves order. */
export function cleanLaps(lapTimesMs: Array<number | null>): number[] {
  const valid = lapTimesMs.filter((t): t is number => typeof t === 'number' && t > 0 && isFinite(t));
  if (valid.length === 0) return [];
  const med = median([...valid].sort((a, b) => a - b));
  const limit = med * CLEAN_LAP_MAX_MULTIPLE;
  return valid.filter((t) => t <= limit);
}

/** Sample standard deviation of clean lap times, in SECONDS. Null if <2 clean laps. */
export function sessionConsistencySeconds(lapTimesMs: Array<number | null>): number | null {
  const laps = cleanLaps(lapTimesMs);
  if (laps.length < 2) return null;
  const mean = laps.reduce((s, t) => s + t, 0) / laps.length;
  const variance = laps.reduce((s, t) => s + (t - mean) ** 2, 0) / (laps.length - 1);
  return Math.sqrt(variance) / 1000;
}

function medianOf(values: number[]): number {
  return median([...values].sort((a, b) => a - b));
}

/** (last-third median − first-third median) of clean laps, in SECONDS. +ve = slowed late. Null if <6 clean laps. */
export function sessionFadeSeconds(lapTimesMs: Array<number | null>): number | null {
  const laps = cleanLaps(lapTimesMs);
  if (laps.length < MIN_CLEAN_LAPS_FOR_FADE) return null;
  const third = Math.ceil(laps.length / 3);
  const firstMed = medianOf(laps.slice(0, third));
  const lastMed = medianOf(laps.slice(-third));
  return (lastMed - firstMed) / 1000;
}

export interface Baseline { mean: number; upper: number; lower: number; }

/** Personal consistency band from PRIOR per-session std-dev values (seconds). Null if too few priors. */
export function consistencyBaseline(priorSeconds: number[]): Baseline | null {
  if (priorSeconds.length < MIN_PRIOR_SESSIONS_FOR_BASELINE) return null;
  const mean = priorSeconds.reduce((s, v) => s + v, 0) / priorSeconds.length;
  const variance = priorSeconds.reduce((s, v) => s + (v - mean) ** 2, 0) / (priorSeconds.length - 1);
  const sigma = Math.sqrt(variance);
  return { mean, upper: mean + BASELINE_SIGMA * sigma, lower: mean - BASELINE_SIGMA * sigma };
}

/** True when this session's spread breaks above the driver's personal upper limit by a meaningful margin. */
export function isOffConsistencyBaseline(sessionSeconds: number, priorSeconds: number[]): boolean {
  const b = consistencyBaseline(priorSeconds);
  if (!b) return false;
  return sessionSeconds > b.upper && sessionSeconds - b.mean >= BASELINE_MIN_DELTA_S;
}

/** True when sessionBestMs is >PB_REGRESSION_PCT slower than the min of priorBestsMs (same track). */
export function isRegressedVsTrackPB(sessionBestMs: number, priorTrackBestsMs: number[]): boolean {
  const valid = priorTrackBestsMs.filter((t) => t > 0);
  if (valid.length === 0 || !(sessionBestMs > 0)) return false;
  const pb = Math.min(...valid);
  return sessionBestMs > pb * (1 + PB_REGRESSION_PCT);
}
