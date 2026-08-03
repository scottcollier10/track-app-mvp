'use client';

/**
 * CSV Import Component
 * Main component that coordinates file upload, parsing, and import
 */

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2, UploadCloud, TrendingUp, CalendarDays } from 'lucide-react';
import CsvUploader from './CsvUploader';
import CsvPreview from './CsvPreview';
import ContextFlagChips from '@/components/sessions/ContextFlagChips';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { parseSessionCsv, ParsedSession } from '@/lib/csv-parser';
import { isCountableLapMs, uniqueTrackDayLinks, type TrackDayLink } from '@/lib/track-days';
import { formatDriverName } from '@/lib/utils/formatters';
import { formatLapMs } from '@/lib/time';
import type { ImportedSessionResponse, ImportSessionPayload } from '@/lib/types';

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error';

/** One imported session a coach can flag right here, before leaving the panel. */
interface FlagTarget {
  sessionId: string;
  /** drivers.name from the route's response — never the CSV's spelling. */
  driverName: string;
  /**
   * The best lap SUBMITTED, which on this route is also the best lap stored
   * (the payload's bestLapMs goes into sessions.best_lap_ms verbatim) — so
   * unlike the parse date it cannot contradict the pages it identifies.
   */
  bestLapMs: number | null;
}

interface ImportResults {
  successful: number;
  failed: number;
  sessionIds: string[];
  /** Distinct track days the imported sessions landed in — usually exactly one. */
  trackDayLinks: TrackDayLink[];
  /** Laps STORED, counted only over sessions the route confirmed a full 201 for. */
  totalLaps: number;
  /** Sessions that came back 207 and are therefore left out of totalLaps. */
  partialSessions: number;
  uniqueDrivers: number;
  /** Every imported session (201 and 207 alike), flaggable in place. */
  flagTargets: FlagTarget[];
}

export default function CsvImport() {
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

    const failed: string[] = [];
    // One entry per session that actually imported — 201s and the 207 "laps
    // partly failed" ones alike, since a 207 still created the session and its
    // day. Every other outcome takes a `continue`/`catch` below, so this is
    // exactly the set of successes; session ids and day links both derive from
    // it rather than being accumulated in parallel and drifting apart.
    // The route's own response is the only thing stored here — in particular
    // the driver name that labels the day links is drivers.name from the DB,
    // not the CSV's name column, so a link's label matches the page it opens.
    const imported: ImportedSessionResponse[] = [];
    // Parallel to `imported`, adding the one CSV-side field the flag rows may
    // print: the best lap, which the route stores verbatim. Kept out of
    // `imported` so that array stays exactly "what the route said".
    const flagTargets: FlagTarget[] = [];
    const uniqueDriverEmails = new Set<string>();
    let totalLaps = 0;
    let partialSessions = 0;

    // Import each session sequentially
    for (const session of sessions) {
      try {
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

        const data: ImportedSessionResponse = await response.json();
        imported.push(data);
        flagTargets.push({
          sessionId: data.sessionId,
          driverName: data.driverName,
          bestLapMs: session.bestLapMs ?? null,
        });
        // Counted HERE, not at the top of the loop: a driver whose only session
        // failed the track lookup or the POST was attempted, not imported, and
        // "3 drivers" over "landed in 2 track days" is a panel arguing with
        // itself. Every count in this panel is of what succeeded.
        uniqueDriverEmails.add(session.driverEmail);
        // Laps are counted only on a 201. A 207 means "session created but some
        // laps failed", and its body says which session and which day — not how
        // many of its laps landed. Adding the number SUBMITTED there is the one
        // count on this panel that would be of what we sent rather than what
        // stored. So the 207's laps are excluded and counted separately, and the
        // panel says the lap figure leaves them out; a silent omission would be
        // a total the coach has no way to know is short.
        if (response.status === 207) {
          partialSessions += 1;
        } else {
          totalLaps += session.laps.length;
        }
      } catch (err) {
        failed.push(
          `${session.trackName} - ${session.driverName} (${
            err instanceof Error ? err.message : 'unknown error'
          })`
        );
      }
    }

    setImportResults({
      successful: imported.length,
      failed: failed.length,
      sessionIds: imported.map((r) => r.sessionId),
      trackDayLinks: uniqueTrackDayLinks(imported),
      totalLaps,
      partialSessions,
      uniqueDrivers: uniqueDriverEmails.size,
      flagTargets,
    });

    if (failed.length > 0) {
      setError(`Failed to import ${failed.length} session(s): ${failed.join(', ')}`);
    }

    setState(imported.length > 0 ? 'success' : 'error');
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

              {/* Why the lap figure above is smaller than the file. Stated
                  rather than folded in silently: the route's 207 does not say
                  how many of that session's laps landed, so the only honest
                  lap total is one that leaves them out and says so. */}
              {importResults.partialSessions > 0 && (
                <p className="text-neutral-400 text-sm mt-3">
                  Lap count excludes {importResults.partialSessions} session(s) whose laps
                  failed to import
                </p>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-2xl mx-auto">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Days the import landed in. Almost always one (a coach uploading
                one event's CSV); more than one when the file spans dates or
                drivers — track days are per driver, so two drivers at one event
                are two days.

                Deliberately unlabelled by DATE: the date here would come from
                the CSV parse (noon in the SERVER's timezone), while /days/[id]
                renders the authoritative track-local date from the database —
                printing it risks this panel saying "Jul 11" and the page it
                links to saying "Jul 12".

                The single day is the panel's PRIMARY action, and it goes to the
                day rather than to a session: the day is the navigation hub and
                the session sits one click deeper from it (design decision #4;
                "confirmation lands on the day page"). The debrief a coach came
                here to do — session progression, focus items, day notes — is the
                day page, and a session is one piece of evidence inside it. */}
            {importResults.trackDayLinks.length === 1 && (
              <div className="flex justify-center">
                <Link href={`/days/${importResults.trackDayLinks[0].trackDayId}`}>
                  <Button variant="primary" icon={CalendarDays}>
                    View track day
                  </Button>
                </Link>
              </div>
            )}

            {/* Several days: there is no "the" day to promote, and choosing one
                would mean choosing by CSV ROW ORDER, which is not chronological.
                So these chips ARE this panel's primary affordance — nothing
                outranks them now that the old session button is gone.

                Labelled by DRIVER, so several links are tellable apart by a
                screen reader rather than being N identical "View track day"s. A
                day is keyed on (driver, track, date), so the driver is a fact
                about the id and cannot disagree with /days/[id] — and the name
                printed here is the one the route read back out of drivers.name,
                not the CSV's name column, so the two pages spell it identically.
                No ordinals: the order is CSV row order, not chronological. */}
            {importResults.trackDayLinks.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">
                  These sessions landed in {importResults.trackDayLinks.length} track days
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {importResults.trackDayLinks.map(({ trackDayId, driverName }) => (
                    <Link
                      key={trackDayId}
                      href={`/days/${trackDayId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-200 hover:text-white hover:border-gray-600 transition-colors"
                    >
                      <CalendarDays className="w-4 h-4 text-green-500" />
                      {`View ${formatDriverName(driverName)}'s track day`}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback only. Every imported session has a day, so this is
                unreachable unless the route stops returning trackDayId — and
                then a panel with no way forward is worse than one that opens a
                session. */}
            {importResults.trackDayLinks.length === 0 && importResults.sessionIds.length > 0 && (
              <div className="flex justify-center">
                <Link href={`/sessions/${importResults.sessionIds[0]}`}>
                  <Button variant="primary">View session</Button>
                </Link>
              </div>
            )}

            {/* Context flags, one row per imported session. This is the moment
                a coach remembers "session 2 got red-flagged" — at import, not
                three clicks later — so the same write control the debrief
                sheet uses lives here too.

                Rows are labelled by driver (drivers.name off the response, the
                spelling /days/[id] uses) and best lap (stored verbatim from
                the payload, so it matches the session page). Deliberately NOT
                by ordinal or date: the order here is CSV ROW order, and a
                "Session 1" printed from it would contradict the bySessionStart
                numbering every other view derives — see uniqueTrackDayLinks's
                warning. The parse date can likewise contradict the day page. */}
            {importResults.flagTargets.length > 0 && (
              <div className="mx-auto max-w-2xl space-y-3 text-left">
                <p className="text-sm text-neutral-400">
                  Flag any session that should not count as-is — cut short, rain, red flag.
                  &ldquo;Not representative&rdquo; sessions are set aside from day aggregates
                  and comparisons; &ldquo;partial&rdquo; ones still count, with the caveat shown.
                </p>
                <ul className="space-y-4">
                  {importResults.flagTargets.map((target) => (
                    <li
                      key={target.sessionId}
                      className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-4"
                    >
                      <p className="text-sm text-gray-200">
                        {formatDriverName(target.driverName)}
                        {isCountableLapMs(target.bestLapMs)
                          ? ` — best ${formatLapMs(target.bestLapMs)}`
                          : ''}
                      </p>
                      <ContextFlagChips
                        sessionId={target.sessionId}
                        representativeness={null}
                        note={null}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center space-x-3">
              <Button variant="ghost" onClick={handleReset}>
                Import More
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
