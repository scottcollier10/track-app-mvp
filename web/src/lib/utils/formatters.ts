/**
 * Formatting Utilities
 *
 * Helper functions for formatting times, dates, and other values
 */

/**
 * Format lap time from milliseconds to "M:SS.mmm"
 */
export function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  return seconds.toFixed(3);
}

/**
 * Format duration from milliseconds to "MM:SS"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format delta (difference from best lap) with sign
 */
export function formatDelta(ms: number): string {
  const seconds = ms / 1000;
  const sign = ms >= 0 ? '+' : '';
  return `${sign}${seconds.toFixed(3)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Calculate delta from best lap
 */
export function calculateDelta(lapTimeMs: number, bestLapMs: number) {
  return lapTimeMs - bestLapMs;
}

/**
 * Format track length from meters to miles
 */
export function formatTrackLength(meters: number): string {
  const miles = meters * 0.000621371;
  return `${miles.toFixed(2)} mi`;
}
