/**
 * Session Insights - Centralized Analytics Helpers
 *
 * Honest metrics only: consistency is the sample std-dev of clean lap times in
 * SECONDS (from analytics-v2), never a /100 composite.
 */

import { calculatePaceTrend } from './analytics';
import { sessionConsistencySeconds } from './analytics-v2';

/** Single lap-count gate for the interpretive layer (insight tabs + AI coaching). */
export const MIN_LAPS_FOR_INSIGHTS = 6;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get session insights from millisecond lap times
 *
 * @param lapTimesMs - Array of lap times in milliseconds
 * @returns consistency (±seconds, null if <2 clean laps) and pace trend
 */
export function getSessionInsightsFromMs(lapTimesMs: number[]): {
  consistencySeconds: number | null;
  paceTrendLabel: string;
  paceTrendDetail: string;
} {
  const validLapTimes = lapTimesMs.filter(t => t != null && t > 0);

  const consistencySeconds = sessionConsistencySeconds(lapTimesMs);
  const paceTrendLabel = calculatePaceTrend(lapTimesMs);

  // Generate detailed pace trend description
  let paceTrendDetail = '';
  if (validLapTimes.length >= MIN_LAPS_FOR_INSIGHTS && paceTrendLabel) {
    const first3 = average(validLapTimes.slice(0, 3));
    const last3 = average(validLapTimes.slice(-3));
    const diffMs = last3 - first3;
    const diffSec = Math.abs(diffMs / 1000);

    if (paceTrendLabel === 'improving') {
      paceTrendDetail = `You got ${diffSec.toFixed(2)}s faster from start to finish.`;
    } else if (paceTrendLabel === 'fading') {
      paceTrendDetail = `You slowed ${diffSec.toFixed(2)}s from start to finish.`;
    } else {
      paceTrendDetail = `Your pace remained stable throughout the session.`;
    }
  } else {
    paceTrendDetail = `Not enough laps to show a trend. Pace trend needs at least ${MIN_LAPS_FOR_INSIGHTS} laps.`;
  }

  return {
    consistencySeconds,
    paceTrendLabel: paceTrendLabel || 'Not enough data',
    paceTrendDetail,
  };
}

/**
 * Tooltip descriptions for each insight metric
 */
export const INSIGHT_HELPERS = {
  consistency: 'Spread of your clean lap times in seconds. Lower means tighter, more repeatable laps.',
  paceTrend: 'Compares your first 3 vs last 3 laps to show improvement or fade.',
};
