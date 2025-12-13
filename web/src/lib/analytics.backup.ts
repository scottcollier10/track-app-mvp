/**
 * Analytics Functions
 *
 * Formula implementations for session analytics
 */

/**
 * Calculate sample standard deviation (using n-1)
 */
function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate average
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate Consistency Score (0-100)
 *
 * Formula:
 * - rawScore = 1 - (std / mean)
 * - consistencyScore = clamp(rawScore * 100, 0, 100)
 *
 * Higher score = more consistent lap times
 * Skip laps with null lap_time_ms
 */
export function calculateConsistencyScore(lapTimes: (number | null)[]): number | null {
  // Filter out null values
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 2) {
    return null; // Not enough data
  }

  const mean = average(validLapTimes);
  const std = sampleStandardDeviation(validLapTimes);

  if (mean === 0) return null;

  const rawScore = 1 - (std / mean);
  const consistencyScore = Math.max(0, Math.min(100, rawScore * 100));

  return Math.round(consistencyScore);
}

/**
 * Get color coding for consistency score
 */
export function getConsistencyColor(score: number): {
  text: string;
  bg: string;
} {
  if (score >= 90) {
    return {
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    };
  }
  if (score >= 70) {
    return {
      text: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    };
  }
  return {
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
  };
}

/**
 * Calculate Pace Trend
 *
 * Formula:
 * - Compare average of first 3 laps vs last 3 laps
 * - Returns "Improving ↗", "Fading ↘", or "Consistent →"
 * - Requires at least 6 laps
 *
 * Skip laps with null lap_time_ms
 */
export function calculatePaceTrend(lapTimes: (number | null)[]): string {
  // Filter out null values
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 6) {
    return 'Not Enough Data';
  }

  const first3 = average(validLapTimes.slice(0, 3));
  const last3 = average(validLapTimes.slice(-3));

  // Lower time = faster = improving
  if (last3 < first3) {
    return 'Improving ↗';
  }

  // Higher time = slower = fading
  if (last3 > first3) {
    return 'Fading ↘';
  }

  return 'Consistent →';
}

/**
 * Get color for pace trend
 */
export function getPaceTrendColor(trend: string): {
  text: string;
  bg: string;
} {
  if (trend.includes('Improving')) {
    return {
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    };
  }
  if (trend.includes('Fading')) {
    return {
      text: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
    };
  }
  if (trend.includes('Consistent')) {
    return {
      text: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    };
  }
  // Not Enough Data
  return {
    text: 'text-gray-700 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800',
  };
}

/**
 * Calculate Behavior Score (0-100)
 *
 * Formula:
 * - behaviorScore = clamp(100 - (std * 0.02), 0, 100)
 *
 * Lower standard deviation = higher score = smoother driving
 * Skip laps with null lap_time_ms
 */
export function calculateBehaviorScore(lapTimes: (number | null)[]): number | null {
  // Filter out null values
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 2) {
    return null; // Not enough data
  }

  const std = sampleStandardDeviation(validLapTimes);
  const behaviorScore = Math.max(0, Math.min(100, 100 - (std * 0.02)));

  return Math.round(behaviorScore);
}

/**
 * Get color for behavior score
 */
export function getBehaviorScoreColor(score: number): {
  text: string;
  bg: string;
} {
  if (score >= 80) {
    return {
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    };
  }
  if (score >= 60) {
    return {
      text: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    };
  }
  return {
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
  };
}
