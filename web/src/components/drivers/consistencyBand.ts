/**
 * Baseline-aware consistency band state for the ProgressStats "Consistency Trend" card.
 *
 * Consistency is a session's clean-lap std-dev in SECONDS (lower = tighter/better).
 * We colour the card only on a real breakout from the student's own history:
 *   - 'worse'   -> latest session broke ABOVE the personal upper limit (spread widened)
 *   - 'better'  -> latest session dropped BELOW the personal lower limit (tightened)
 *   - 'neutral' -> inside the band, or too few sessions for a baseline
 */

import { consistencyBaseline } from '@/lib/analytics-v2';

export type ConsistencyBandState = 'worse' | 'better' | 'neutral';

/**
 * @param consistencySecondsSeries per-session std-dev seconds, oldest -> latest (nulls allowed)
 */
export function consistencyBandState(
  consistencySecondsSeries: Array<number | null>
): ConsistencyBandState {
  const values = consistencySecondsSeries.filter((v): v is number => v !== null);
  if (values.length === 0) return 'neutral';

  const latest = values[values.length - 1];
  const band = consistencyBaseline(values);
  if (!band) return 'neutral';

  if (latest > band.upper) return 'worse';
  if (latest < band.lower) return 'better';
  return 'neutral';
}

/** Format a std-dev value in seconds as +/-0.Xs. */
export function formatConsistencySeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
