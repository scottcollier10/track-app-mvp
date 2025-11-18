/**
 * CSV Export Utilities
 *
 * Functions for exporting session data to CSV format
 */

import { formatDate, formatLapMs, formatDurationMs } from './time';

interface Session {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

/**
 * Escapes CSV field values to handle commas, quotes, and newlines
 */
function escapeCSVField(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Exports sessions data to CSV and triggers browser download
 */
export function exportSessionsToCSV(sessions: Session[]): void {
  if (!sessions || sessions.length === 0) {
    console.warn('No sessions to export');
    return;
  }

  // CSV headers
  const headers = [
    'Date',
    'Track',
    'Location',
    'Driver',
    'Laps',
    'Best Lap',
    'Total Time',
    'Session ID'
  ];

  // Convert sessions to CSV rows
  const rows = sessions.map(session => {
    return [
      escapeCSVField(formatDate(session.date)),
      escapeCSVField(session.track?.name || 'Unknown Track'),
      escapeCSVField(session.track?.location || ''),
      escapeCSVField(session.driver?.name || 'Unknown'),
      escapeCSVField(session.lapCount),
      escapeCSVField(session.best_lap_ms ? formatLapMs(session.best_lap_ms) : ''),
      escapeCSVField(formatDurationMs(session.total_time_ms)),
      escapeCSVField(session.id)
    ].join(',');
  });

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Generate filename with current date
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `track-sessions-${timestamp}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}
