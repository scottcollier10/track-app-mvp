/**
 * Analytics Insights Helpers
 *
 * Standardized labels, scores, and trend analysis for session insights
 */

// =============================================================================
// Types
// =============================================================================

export type Severity = 'excellent' | 'good' | 'ok' | 'poor' | 'unknown';

export interface ScoreLabel {
  score: number | null;
  label: string;
  severity: Severity;
}

export interface PaceTrend {
  value: string;
  helper: string;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

// =============================================================================
// Constants
// =============================================================================

export const INSIGHT_HELPERS = {
  consistency: "How tightly your laps group around your best times.",
  paceTrend: {
    improving: "Last 3 laps are faster than your first 3.",
    fading: "Last 3 laps are slower than your first 3.",
    consistent: "Pace is roughly unchanged across the session.",
  },
  behavior: "Based on how stable your lap-to-lap pace is.",
};

// =============================================================================
// Functions
// =============================================================================

/**
 * Map a numeric score (0-100) to a human-readable label and severity level
 *
 * @param score - Numeric score from 0-100, or null if no data
 * @returns Object with score, label, and severity
 *
 * @example
 * getScoreLabel(95)
 * // => { score: 95, label: 'Excellent', severity: 'excellent' }
 *
 * getScoreLabel(72)
 * // => { score: 72, label: 'Needs work', severity: 'ok' }
 *
 * getScoreLabel(null)
 * // => { score: null, label: 'No data', severity: 'unknown' }
 */
export function getScoreLabel(score: number | null): ScoreLabel {
  if (score === null) {
    return {
      score: null,
      label: 'No data',
      severity: 'unknown',
    };
  }

  if (score >= 90) {
    return {
      score,
      label: 'Excellent',
      severity: 'excellent',
    };
  }

  if (score >= 80) {
    return {
      score,
      label: 'Strong',
      severity: 'good',
    };
  }

  if (score >= 65) {
    return {
      score,
      label: 'Needs work',
      severity: 'ok',
    };
  }

  return {
    score,
    label: 'Inconsistent',
    severity: 'poor',
  };
}

/**
 * Analyze lap times to determine if pace is improving, fading, or consistent
 *
 * Compares average of first 3 laps vs last 3 laps to detect trends.
 * Requires minimum 6 laps for analysis.
 *
 * @param laps - Array of lap objects with lapTimeMs property
 * @returns Object with trend value, helper text, and direction
 *
 * @example
 * describePaceTrend([
 *   { lapTimeMs: 95000 },
 *   { lapTimeMs: 93000 },
 *   { lapTimeMs: 92000 },
 *   { lapTimeMs: 91000 },
 *   { lapTimeMs: 90000 },
 *   { lapTimeMs: 89000 },
 * ])
 * // => {
 * //   value: 'Improving ↗',
 * //   helper: 'Last 3 laps are faster than your first 3.',
 * //   direction: 'up'
 * // }
 */
export function describePaceTrend(
  laps: { lapTimeMs: number }[]
): PaceTrend {
  // Require minimum 6 laps for trend analysis
  if (laps.length < 6) {
    return {
      value: 'Not Enough Data',
      helper: 'Need at least 6 laps to analyze pace trend.',
      direction: 'unknown',
    };
  }

  // Calculate average of first 3 laps
  const first3 = laps.slice(0, 3);
  const first3Avg =
    first3.reduce((sum, lap) => sum + lap.lapTimeMs, 0) / first3.length;

  // Calculate average of last 3 laps
  const last3 = laps.slice(-3);
  const last3Avg =
    last3.reduce((sum, lap) => sum + lap.lapTimeMs, 0) / last3.length;

  // Calculate percentage change
  const delta = (last3Avg - first3Avg) / first3Avg;

  // Improving: last 3 are at least 1% faster (delta is negative)
  if (delta <= -0.01) {
    return {
      value: 'Improving ↗',
      helper: INSIGHT_HELPERS.paceTrend.improving,
      direction: 'up',
    };
  }

  // Fading: last 3 are at least 1% slower (delta is positive)
  if (delta >= 0.01) {
    return {
      value: 'Fading ↘',
      helper: INSIGHT_HELPERS.paceTrend.fading,
      direction: 'down',
    };
  }

  // Consistent: within 1% either direction
  return {
    value: 'Consistent →',
    helper: INSIGHT_HELPERS.paceTrend.consistent,
    direction: 'flat',
  };
}

// =============================================================================
// Example Usage
// =============================================================================

/*
Example 1: Score Labels
-----------------------
const myScore = 85;
const { label, severity } = getScoreLabel(myScore);
console.log(label);     // "Strong"
console.log(severity);  // "good"

Example 2: Pace Trend Analysis
-------------------------------
const sessionLaps = [
  { lapTimeMs: 94000 },
  { lapTimeMs: 93500 },
  { lapTimeMs: 93000 },
  { lapTimeMs: 91500 },
  { lapTimeMs: 91000 },
  { lapTimeMs: 90500 },
];

const trend = describePaceTrend(sessionLaps);
console.log(trend.value);      // "Improving ↗"
console.log(trend.direction);  // "up"
console.log(trend.helper);     // "Last 3 laps are faster than your first 3."

Example 3: UI Component Integration
------------------------------------
import { getScoreLabel, describePaceTrend, INSIGHT_HELPERS } from '@/lib/insights';

function SessionInsights({ consistencyScore, laps }) {
  const { label, severity } = getScoreLabel(consistencyScore);
  const trend = describePaceTrend(laps);

  return (
    <div>
      <div className={`score-${severity}`}>
        Consistency: {label}
        <Tooltip>{INSIGHT_HELPERS.consistency}</Tooltip>
      </div>
      <div className={`trend-${trend.direction}`}>
        Pace: {trend.value}
        <Tooltip>{trend.helper}</Tooltip>
      </div>
    </div>
  );
}
*/
