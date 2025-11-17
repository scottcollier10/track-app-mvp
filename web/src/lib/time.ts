/**
 * Time Formatting Utilities
 *
 * Clean utilities for formatting lap times and durations
 */

/**
 * Format lap time from milliseconds to "mm:ss.SSS"
 * Examples: 92500 -> "1:32.500", 45123 -> "0:45.123"
 */
export function formatLapMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format duration from milliseconds to "MM:SS"
 * Examples: 1200000 -> "20:00", 92500 -> "01:32"
 */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format date for display
 * Example: "2024-01-15T14:30:00Z" -> "Jan 15, 2024"
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
 * Format date with time
 * Example: "2024-01-15T14:30:00Z" -> "Jan 15, 2024, 2:30 PM"
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
 * Format time from milliseconds to HH:MM:SS for CSV export
 * Examples: 3661000 -> "01:01:01", 92500 -> "00:01:32"
 */
export function formatTimeForCSV(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
