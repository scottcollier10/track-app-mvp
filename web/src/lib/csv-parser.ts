/**
 * CSV Parser for Track App
 * Parses CSV files containing lap data and transforms them into ImportSessionPayload format
 */

import Papa from 'papaparse';

// CSV row format matching the template
export interface CsvRow {
  session_date: string;
  track_name: string;
  driver_name: string;
  lap_number: string;
  lap_time_ms: string;
  timestamp: string;
}

// Parsed and validated session data
export interface ParsedSession {
  driverEmail: string; // Will be generated as driver_name@trackapp.local
  driverName: string;
  trackName: string;
  date: string;
  totalTimeMs: number;
  bestLapMs: number;
  laps: {
    lapNumber: number;
    lapTimeMs: number;
  }[];
}

export interface ParseResult {
  success: boolean;
  sessions?: ParsedSession[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Parse CSV file and return structured session data
 */
export function parseSessionCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        try {
          // Validate CSV structure
          const requiredHeaders = [
            'session_date',
            'track_name',
            'driver_name',
            'lap_number',
            'lap_time_ms',
            'timestamp',
          ];

          const headers = results.meta.fields || [];
          const missingHeaders = requiredHeaders.filter(
            (h) => !headers.includes(h)
          );

          if (missingHeaders.length > 0) {
            errors.push(
              `Missing required columns: ${missingHeaders.join(', ')}`
            );
            return resolve({ success: false, errors });
          }

          // Parse and group rows by session
          const sessionMap = new Map<string, CsvRow[]>();

          results.data.forEach((row, index) => {
            // Validate row
            const rowErrors = validateRow(row, index + 2); // +2 for header and 0-index
            if (rowErrors.length > 0) {
              errors.push(...rowErrors);
              return;
            }

            // Group by session (date + track + driver)
            const sessionKey = `${row.session_date}|${row.track_name}|${row.driver_name}`;
            if (!sessionMap.has(sessionKey)) {
              sessionMap.set(sessionKey, []);
            }
            sessionMap.get(sessionKey)!.push(row);
          });

          // If validation errors, return early
          if (errors.length > 0) {
            return resolve({ success: false, errors });
          }

          // Transform sessions
          const sessions: ParsedSession[] = [];

          sessionMap.forEach((rows, sessionKey) => {
            const [date, trackName, driverName] = sessionKey.split('|');

            // Sort laps by lap number
            const sortedRows = rows.sort(
              (a, b) => parseInt(a.lap_number) - parseInt(b.lap_number)
            );

            // Parse laps
            const laps = sortedRows.map((row) => ({
              lapNumber: parseInt(row.lap_number),
              lapTimeMs: parseInt(row.lap_time_ms),
            }));

            // Calculate stats
            const lapTimes = laps.map((l) => l.lapTimeMs);
            const bestLapMs = Math.min(...lapTimes);
            const totalTimeMs = lapTimes.reduce((sum, time) => sum + time, 0);

            // Generate email (temporary until we have track lookup)
            const driverEmail = `${driverName.toLowerCase().replace(/\s+/g, '.')}@trackapp.local`;

            // Convert session_date to ISO timestamp at noon local time to avoid timezone issues
            // This ensures the session stays on the correct day regardless of timezone
            const sessionDate = new Date(date + 'T12:00:00').toISOString();

            sessions.push({
              driverEmail,
              driverName,
              trackName,
              date: sessionDate,  // Use the converted timestamp
              totalTimeMs,
              bestLapMs,
              laps,
            });

          // Add warnings if needed
          if (sessions.length === 0) {
            warnings.push('No valid sessions found in CSV');
          }

          resolve({
            success: true,
            sessions,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        } catch (error) {
          errors.push(
            `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          resolve({ success: false, errors });
        }
      },
      error: (error) => {
        errors.push(`CSV parsing failed: ${error.message}`);
        resolve({ success: false, errors });
      },
    });
  });
}

/**
 * Validate a single CSV row
 */
function validateRow(row: CsvRow, rowNumber: number): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!row.session_date?.trim()) {
    errors.push(`Row ${rowNumber}: Missing session_date`);
  }
  if (!row.track_name?.trim()) {
    errors.push(`Row ${rowNumber}: Missing track_name`);
  }
  if (!row.driver_name?.trim()) {
    errors.push(`Row ${rowNumber}: Missing driver_name`);
  }
  if (!row.lap_number?.trim()) {
    errors.push(`Row ${rowNumber}: Missing lap_number`);
  }
  if (!row.lap_time_ms?.trim()) {
    errors.push(`Row ${rowNumber}: Missing lap_time_ms`);
  }

  // Validate numeric fields
  const lapNumber = parseInt(row.lap_number);
  if (isNaN(lapNumber) || lapNumber < 1) {
    errors.push(`Row ${rowNumber}: Invalid lap_number (must be positive integer)`);
  }

  const lapTimeMs = parseInt(row.lap_time_ms);
  if (isNaN(lapTimeMs) || lapTimeMs < 1) {
    errors.push(`Row ${rowNumber}: Invalid lap_time_ms (must be positive integer)`);
  }

  // Validate date format (basic check)
  if (row.session_date && !isValidDateString(row.session_date)) {
    errors.push(
      `Row ${rowNumber}: Invalid session_date format (expected YYYY-MM-DD or ISO format)`
    );
  }

  return errors;
}

/**
 * Validate date string
 */
function isValidDateString(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Generate a sample CSV template
 */
export function generateTemplateData(): string {
  const template = [
    'session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp',
    '2024-11-22,Laguna Seca,Scott Collier,1,92450,2024-11-22T10:15:23Z',
    '2024-11-22,Laguna Seca,Scott Collier,2,91234,2024-11-22T10:17:01Z',
    '2024-11-22,Laguna Seca,Scott Collier,3,90890,2024-11-22T10:18:55Z',
  ];
  return template.join('\n');
}

/**
 * Download template CSV file
 */
export function downloadTemplate(): void {
  const csv = generateTemplateData();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'track-app-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
