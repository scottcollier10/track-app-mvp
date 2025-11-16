/**
 * Session Insights - Centralized Analytics Helpers
 *
 * Provides unified interface for session analytics with scoring, labels, and tooltips.
 */

import {
  calculateConsistencyScore,
  calculatePaceTrend,
  calculateBehaviorScore,
} from './analytics';

/**
 * Calculate average
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get session insights from millisecond lap times
 *
 * @param lapTimesMs - Array of lap times in milliseconds
 * @returns Object containing all session insights
 */
export function getSessionInsightsFromMs(lapTimesMs: number[]): {
  consistencyScore: number | null;
  drivingBehaviorScore: number | null;
  paceTrendLabel: string;
  paceTrendDetail: string;
} {
  const validLapTimes = lapTimesMs.filter(t => t != null && t > 0);

  const consistencyScore = calculateConsistencyScore(lapTimesMs);
  const drivingBehaviorScore = calculateBehaviorScore(lapTimesMs);
  const paceTrendLabel = calculatePaceTrend(lapTimesMs);

  // Generate detailed pace trend description
  let paceTrendDetail = '';
  if (validLapTimes.length >= 6) {
    const first3 = average(validLapTimes.slice(0, 3));
    const last3 = average(validLapTimes.slice(-3));
    const diffMs = last3 - first3;
    const diffSec = Math.abs(diffMs / 1000);

    if (paceTrendLabel.includes('Improving')) {
      paceTrendDetail = `You got ${diffSec.toFixed(2)}s faster from start to finish.`;
    } else if (paceTrendLabel.includes('Fading')) {
      paceTrendDetail = `You slowed ${diffSec.toFixed(2)}s from start to finish.`;
    } else {
      paceTrendDetail = `Your pace remained stable throughout the session.`;
    }
  } else {
    paceTrendDetail = INSIGHT_HELPERS.paceTrend;
  }

  return {
    consistencyScore,
    drivingBehaviorScore,
    paceTrendLabel,
    paceTrendDetail,
  };
}

/**
 * Map score to label with severity and color
 *
 * @param score - Score value (0-100) or null
 * @returns Object with label, severity level, and Tailwind color class
 */
export function getScoreLabel(score: number | null): {
  label: string;
  severity: 'excellent' | 'good' | 'ok' | 'poor' | 'unknown';
  colorClass: string;
} {
  if (score === null) return {
    label: 'No Data',
    severity: 'unknown',
    colorClass: 'text-gray-400'
  };

  if (score >= 90) return {
    label: 'Excellent',
    severity: 'excellent',
    colorClass: 'text-emerald-400'
  };

  if (score >= 80) return {
    label: 'Strong',
    severity: 'good',
    colorClass: 'text-green-400'
  };

  if (score >= 65) return {
    label: 'Needs Work',
    severity: 'ok',
    colorClass: 'text-amber-400'
  };

  return {
    label: 'Inconsistent',
    severity: 'poor',
    colorClass: 'text-red-400'
  };
}

/**
 * Tooltip descriptions for each insight metric
 */
export const INSIGHT_HELPERS = {
  consistency: "How tightly your laps group around your best times.",
  paceTrend: "Compares your first 3 vs last 3 laps to show improvement or fade.",
  behavior: "Based on how stable your lap-to-lap pace is.",
};
