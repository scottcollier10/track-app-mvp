import { CLEAN_LAP_MAX_MULTIPLE } from './analytics-constants';

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
