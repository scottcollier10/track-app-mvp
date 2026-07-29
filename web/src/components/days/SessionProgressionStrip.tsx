/**
 * Session progression across one track day — S1 → S2 → S3 → S4.
 *
 * This is the point of the day page. HPDE coaching happens BETWEEN sessions:
 * the instructor debriefs, gives the student something to work on, and the next
 * session is the evidence. So each card carries its own best lap and σ plus the
 * signed change from the session before it.
 *
 * Two rules this component must never break:
 *  - σ is only claimed at >= MIN_LAPS_FOR_INSIGHTS laps, and always comes from
 *    sessionConsistencySeconds. The math is never reimplemented here.
 *  - Deltas are signed numbers. The app compares, the instructor concludes.
 *
 * `sessions` MUST arrive in chronological order — that order IS the "Session N"
 * numbering (see bySessionStart in @/data/track-days). Nothing is re-sorted here.
 */
import Link from 'next/link';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { sessionDelta } from '@/lib/track-days';
import { formatLapMs } from '@/lib/time';
import type { SessionWithLapTimes } from '@/lib/types';

/**
 * Signed best-lap change vs the previous session, in seconds.
 * Renders nothing when either session lacks a best lap.
 */
function BestLapDelta({ deltaMs }: { deltaMs: number | null }) {
  if (deltaMs === null) return null;
  const seconds = deltaMs / 1000;

  // Zero is its own case: an identical best lap is not "slower", so it must pick
  // up neither the warn colour nor a + sign.
  const tone =
    deltaMs < 0 ? 'text-status-success' : deltaMs > 0 ? 'text-status-warn' : 'text-muted';

  return (
    <span className={`ml-2 text-sm font-normal ${tone}`}>
      {/* toFixed already carries the minus sign; only a gain needs one added. */}
      {deltaMs > 0 ? '+' : ''}
      {seconds.toFixed(3)}s
    </span>
  );
}

export default function SessionProgressionStrip({
  sessions,
}: {
  sessions: SessionWithLapTimes[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sessions.map((session, i) => {
        const lapTimesMs = session.laps.map((l) => l.lap_time_ms);

        // The honesty gate. Below the lap minimum we do not compute a σ at all,
        // so there is nothing to accidentally render.
        const sigma =
          lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS
            ? sessionConsistencySeconds(lapTimesMs)
            : null;

        const prev = i > 0 ? sessions[i - 1] : null;
        const delta = prev
          ? sessionDelta(
              {
                bestLapMs: prev.best_lap_ms,
                lapTimesMs: prev.laps.map((l) => l.lap_time_ms),
              },
              { bestLapMs: session.best_lap_ms, lapTimesMs }
            )
          : null;
        // sessionDelta applies the same lap gate to BOTH sessions, so this is
        // null unless a σ comparison is actually earned.
        const sigmaDelta = delta?.consistencyDeltaSeconds ?? null;

        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="block rounded-lg border border-subtle bg-surface p-4 transition-colors hover:border-strong"
          >
            <p className="text-sm text-muted">Session {i + 1}</p>

            <p className="mt-1 text-xl font-semibold text-primary">
              {session.best_lap_ms !== null ? formatLapMs(session.best_lap_ms) : '--'}
              <BestLapDelta deltaMs={delta?.bestLapDeltaMs ?? null} />
            </p>

            <p className="mt-1 text-sm text-muted">
              {sigma !== null ? (
                <>
                  ±{sigma.toFixed(1)}s
                  {sigmaDelta !== null && (
                    <span className="ml-2 text-text-subtle">
                      ({sigmaDelta > 0 ? '+' : ''}
                      {sigmaDelta.toFixed(1)}s)
                    </span>
                  )}
                </>
              ) : (
                // True whether the session is under the lap gate or has too few
                // clean laps for σ to resolve — either way, no claim is made.
                'Too few laps for a consistency figure'
              )}
            </p>

            <p className="mt-1 text-xs text-text-subtle">
              {lapTimesMs.length} {lapTimesMs.length === 1 ? 'lap' : 'laps'}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
