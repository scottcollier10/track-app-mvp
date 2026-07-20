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

/** One lap's sector splits: sector-id (string) -> milliseconds. Matches laps.sector_data (Record<string, number> | null). */
export type LapSectors = Record<string, number>;

/**
 * Theoretical best lap = sum of the fastest split for each sector across all laps (ms).
 * Sector keys are taken from the union across laps; a sector counts only positive splits.
 * Returns null if no laps carry usable sector splits, or if any sector key never has a positive split.
 */
export function idealLapMs(laps: Array<LapSectors | null | undefined>): number | null {
  const valid = (laps || []).filter((l): l is LapSectors => !!l && typeof l === 'object' && Object.keys(l).length > 0);
  if (valid.length === 0) return null;
  const keys = new Set<string>();
  for (const lap of valid) for (const k of Object.keys(lap)) keys.add(k);
  if (keys.size === 0) return null;
  let total = 0;
  for (const key of keys) {
    let best = Infinity;
    for (const lap of valid) {
      const v = lap[key];
      if (typeof v === 'number' && v > 0 && v < best) best = v;
    }
    if (!isFinite(best)) return null; // a sector with no positive split -> cannot form an ideal lap
    total += best;
  }
  return total;
}

/**
 * Fastest actual lap (real lap_time_ms) − ideal lap, in SECONDS.
 * Null when sector data is absent (ideal null) or no valid fastest lap is given.
 */
export function gapToIdealSeconds(fastestActualLapMs: number | null, laps: Array<LapSectors | null | undefined>): number | null {
  const ideal = idealLapMs(laps);
  if (ideal === null || fastestActualLapMs == null || !(fastestActualLapMs > 0)) return null;
  return (fastestActualLapMs - ideal) / 1000;
}
