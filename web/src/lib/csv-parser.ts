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
  source?: string; // Optional: RaceChrono, AiM, TrackAddict, generic
}

// Parsed and validated session data
export interface ParsedSession {
  driverEmail: string; // Will be generated as driver_name@trackapp.demo
  driverName: string;
  trackName: string;
  date: string;
  totalTimeMs: number;
  bestLapMs: number;
  source: string; // RaceChrono, AiM, TrackAddict, generic, csv_import
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
 * Validate a single CSV row
 */
function validateRow(row: CsvRow, rowNumber: number): string[] {
  const errors: string[] = [];

  // Required fields
  if (!row.session_date) {
    errors.push(`Row ${rowNumber}: Missing session_date`);
  }
  if (!row.track_name) {
    errors.push(`Row ${rowNumber}: Missing track_name`);
  }
  if (!row.driver_name) {
    errors.push(`Row ${rowNumber}: Missing driver_name`);
  }
  if (!row.lap_number) {
    errors.push(`Row ${rowNumber}: Missing lap_number`);
  }
  if (!row.lap_time_ms) {
    errors.push(`Row ${rowNumber}: Missing lap_time_ms`);
  }

  // Validate lap_number is a number
  if (row.lap_number && isNaN(parseInt(row.lap_number))) {
    errors.push(`Row ${rowNumber}: lap_number must be a number`);
  }

  // Validate lap_time_ms is a number
  if (row.lap_time_ms && isNaN(parseInt(row.lap_time_ms))) {
    errors.push(`Row ${rowNumber}: lap_time_ms must be a number`);
  }

  return errors;
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
          // Check for required columns
          const requiredHeaders = [
            'session_date',
            'track_name',
            'driver_name',
            'lap_number',
            'lap_time_ms',
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

            // Get source from first row (all rows in session should have same source)
            const source = rows[0].source || 'csv_import';

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

            // Generate email with .demo domain
            const driverEmail = `${driverName.toLowerCase().replace(/\s+/g, '.')}@trackapp.demo`;

            // Convert session_date to proper ISO format with timezone handling
            // Add T12:00:00 to force noon local time, preventing timezone date rollback
            const sessionDate = new Date(date + 'T12:00:00').toISOString();

            sessions.push({
              driverEmail,
              driverName,
              trackName,
              date: sessionDate,
              totalTimeMs,
              bestLapMs,
              source,
              laps,
            });
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
        errors.push(`CSV parsing error: ${error.message}`);
        resolve({ success: false, errors });
      },
    });
  });
}
