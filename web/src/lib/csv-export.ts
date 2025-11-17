/**
 * CSV Export Utilities
 *
 * Functions for exporting data to CSV format with proper escaping
 */

import type { SessionWithDetails } from '@/data/sessions';
import { formatLapMs, formatDurationMs } from './time';

export interface CSVExportOptions {
  filename: string;
  headers: string[];
  data: any[][];
}

/**
 * Escapes a CSV field value
 * - Wraps in quotes if contains comma, newline, or quote
 * - Escapes existing quotes by doubling them
 */
function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if field needs escaping
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Escape quotes by doubling them
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }

  return stringValue;
}

/**
 * Generates CSV string from headers and data rows
 */
function generateCSVString(headers: string[], data: any[][]): string {
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(escapeCSVField).join(','));

  // Add data rows
  for (const row of data) {
    csvRows.push(row.map(escapeCSVField).join(','));
  }

  return csvRows.join('\n');
}

/**
 * Triggers a browser download of CSV content
 */
export function exportToCSV(options: CSVExportOptions): void {
  const { filename, headers, data } = options;

  // Generate CSV string
  const csvContent = generateCSVString(headers, data);

  // Create blob with BOM for Excel compatibility
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link and trigger click
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL object
  URL.revokeObjectURL(url);
}

/**
 * Formats session data for CSV export
 * Returns headers and data rows ready for CSV generation
 */
export function formatSessionsForCSV(sessions: SessionWithDetails[]): {
  headers: string[];
  data: any[][];
} {
  const headers = [
    'Driver Name',
    'Track Name',
    'Track Location',
    'Date',
    'Total Time',
    'Best Lap',
    'Laps',
  ];

  const data = sessions.map((session) => {
    // Format date as YYYY-MM-DD
    const date = new Date(session.date);
    const dateString = date.toISOString().split('T')[0];

    // Format times
    const totalTime = formatDurationMs(session.total_time_ms);
    const bestLap = session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '—';

    return [
      session.driver?.name || 'Unknown',
      session.track?.name || 'Unknown Track',
      session.track?.location || '',
      dateString,
      totalTime,
      bestLap,
      session.lapCount,
    ];
  });

  return { headers, data };
}

/**
 * Exports sessions to CSV file with timestamp in filename
 */
export function exportSessionsToCSV(sessions: SessionWithDetails[]): void {
  const { headers, data } = formatSessionsForCSV(sessions);

  // Generate filename with current date
  const today = new Date().toISOString().split('T')[0];
  const filename = `sessions_${today}.csv`;

  exportToCSV({ filename, headers, data });
}
