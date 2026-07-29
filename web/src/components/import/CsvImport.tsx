'use client';

/**
 * CSV Import Component
 * Main component that coordinates file upload, parsing, and import
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2, UploadCloud, TrendingUp, CalendarDays } from 'lucide-react';
import CsvUploader from './CsvUploader';
import CsvPreview from './CsvPreview';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { parseSessionCsv, ParsedSession } from '@/lib/csv-parser';
import { uniqueTrackDayIds, type ImportedSessionResponse } from '@/lib/track-days';
import type { ImportSessionPayload } from '@/lib/types';

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error';

interface ImportResults {
  successful: number;
  failed: number;
  sessionIds: string[];
  /** Distinct track days the imported sessions landed in — usually exactly one. */
  trackDayIds: string[];
  totalLaps: number;
  uniqueDrivers: number;
}

export default function CsvImport() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [sessions, setSessions] = useState<ParsedSession[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  /**
   * Handle file selection and parse CSV
   */
  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setState('parsing');
    setError(null);
    setSessions([]);
    setWarnings([]);

    try {
      const result = await parseSessionCsv(file);

      if (!result.success || !result.sessions) {
        setError(result.errors?.join(', ') || 'Failed to parse CSV');
        setState('error');
        return;
      }

      setSessions(result.sessions);
      setWarnings(result.warnings || []);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  /**
   * Import sessions to database
   */
  const handleImport = async () => {
    if (sessions.length === 0) return;

    setState('importing');
    setError(null);

    const successful: string[] = [];
    const failed: string[] = [];
    // Every response that created a session, including the 207 "laps partly
    // failed" ones — the day exists in that case too, so it gets a link.
    const responses: ImportedSessionResponse[] = [];
    const uniqueDriverEmails = new Set<string>();
    let totalLaps = 0;

    // Import each session sequentially
    for (const session of sessions) {
      try {
        // Track driver
        uniqueDriverEmails.add(session.driverEmail);

        // First, lookup track by name to get trackId
        const trackResponse = await fetch(
          `/api/tracks?name=${encodeURIComponent(session.trackName)}`
        );

        if (!trackResponse.ok) {
          failed.push(`${session.trackName} (track not found)`);
          continue;
        }

        const result = await trackResponse.json();
        const tracks = result.tracks || result.data || result;
        if (!tracks || tracks.length === 0) {
          failed.push(`${session.trackName} (track not found)`);
          continue;
        }

        const track = tracks[0];

        // Build import payload
        const payload: ImportSessionPayload = {
          driverEmail: session.driverEmail,
          trackId: track.id,
          date: session.date,
          totalTimeMs: session.totalTimeMs,
          bestLapMs: session.bestLapMs,
          source: session.source, // RaceChrono, AiM, TrackAddict, etc.
          laps: session.laps.map((lap) => ({
            lapNumber: lap.lapNumber,
            lapTimeMs: lap.lapTimeMs,
          })),
        };

        // Import session
        const response = await fetch('/api/import-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          failed.push(
            `${session.trackName} - ${session.driverName} (${errorData.error || 'import failed'})`
          );
          continue;
        }

        const data = await response.json();
        successful.push(data.sessionId);
        responses.push(data);
        totalLaps += session.laps.length;
      } catch (err) {
        failed.push(
          `${session.trackName} - ${session.driverName} (${
            err instanceof Error ? err.message : 'unknown error'
          })`
        );
      }
    }

    setImportResults({
      successful: successful.length,
      failed: failed.length,
      sessionIds: successful,
      trackDayIds: uniqueTrackDayIds(responses),
      totalLaps,
      uniqueDrivers: uniqueDriverEmails.size,
    });

    if (failed.length > 0) {
      setError(`Failed to import ${failed.length} session(s): ${failed.join(', ')}`);
    }

    setState(successful.length > 0 ? 'success' : 'error');
  };

  /**
   * Reset to upload new file
   */
  const handleReset = () => {
    setState('idle');
    setFileName('');
    setSessions([]);
    setWarnings([]);
    setError(null);
    setImportResults(null);
  };

  /**
   * Navigate to first imported session
   */
  const handleViewSessions = () => {
    if (importResults && importResults.sessionIds.length > 0) {
      router.push(`/sessions/${importResults.sessionIds[0]}`);
    }
  };

  // Days the import landed in. Almost always one (a coach uploading one
  // event's CSV); more than one when the file spans dates or drivers — track
  // days are per driver, so two drivers at one event are two days.
  const trackDayIds = importResults?.trackDayIds ?? [];

  return (
    <div className="space-y-6">
      {/* Upload State */}
      {(state === 'idle' || state === 'parsing' || state === 'error') && (
        <Card>
          <CsvUploader 
            onFileSelect={handleFileSelect}
            isUploading={state === 'parsing'}
          />

          {state === 'parsing' && (
            <div className="mt-6 flex items-center justify-center space-x-3 py-8">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <p className="text-neutral-400">Parsing {fileName}...</p>
            </div>
          )}

          {state === 'error' && error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Error</p>
                  <p className="text-sm text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Preview State */}
      {state === 'preview' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Ready to Import
                </h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Review the data below, then click Import
                </p>
              </div>
              <div className="flex space-x-3">
                <Button variant="ghost" onClick={handleReset}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  icon={UploadCloud}
                  onClick={handleImport}
                >
                  Import Sessions
                </Button>
              </div>
            </div>

            <CsvPreview sessions={sessions} warnings={warnings} />
          </Card>
        </div>
      )}

      {/* Importing State */}
      {state === 'importing' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <div className="text-center">
              <p className="text-lg font-medium text-white">
                Importing sessions...
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                This may take a few moments
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Success State */}
      {state === 'success' && importResults && (
        <Card>
          <div className="text-center py-12 space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-green-500/10 rounded-full">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Import Complete!
              </h3>
              
              {/* Detailed Summary */}
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <p className="text-lg text-gray-200">
                  Imported{' '}
                  <span className="font-semibold text-white">{importResults.successful}</span>
                  {' '}session{importResults.successful !== 1 ? 's' : ''},{' '}
                  <span className="font-semibold text-white">{importResults.totalLaps}</span>
                  {' '}lap{importResults.totalLaps !== 1 ? 's' : ''},{' '}
                  <span className="font-semibold text-white">{importResults.uniqueDrivers}</span>
                  {' '}driver{importResults.uniqueDrivers !== 1 ? 's' : ''}{' '}
                  — <span className="text-green-400">{importResults.failed} errors</span>
                </p>
              </div>

              {importResults.failed > 0 && (
                <p className="text-red-400 text-sm mt-3">
                  {importResults.failed} session(s) failed to import
                </p>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-2xl mx-auto">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Track day links. Deliberately unlabelled by date: the date here
                would come from the CSV parse (noon in the SERVER's timezone),
                while /days/[id] renders the authoritative track-local date from
                the database — printing it risks this panel saying "Jul 11" and
                the page it links to saying "Jul 12". Numbering is import order,
                and only appears when there is more than one to tell apart. */}
            {trackDayIds.length > 0 && (
              <div className="space-y-3">
                {trackDayIds.length > 1 && (
                  <p className="text-sm text-neutral-400">
                    These sessions landed in {trackDayIds.length} track days
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-3">
                  {trackDayIds.map((id, index) => (
                    <Link
                      key={id}
                      href={`/days/${id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-200 hover:text-white hover:border-gray-600 transition-colors"
                    >
                      <CalendarDays className="w-4 h-4 text-green-500" />
                      {trackDayIds.length === 1
                        ? 'View track day'
                        : `View track day ${index + 1}`}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-3">
              <Button variant="ghost" onClick={handleReset}>
                Import More
              </Button>
              <Button variant="primary" onClick={handleViewSessions}>
                View Sessions
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
