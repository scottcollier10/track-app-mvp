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
 * numbering (see bySessionStart in @/lib/track-days). Nothing is re-sorted here.
 */
import Link from 'next/link';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import {
  SIGMA_DISPLAY_DECIMALS,
  displayedSigmaDeltaSeconds,
  displayedSigmaSeconds,
  sessionDelta,
  validLapTimesMs,
} from '@/lib/track-days';
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
    <span data-testid="best-lap-delta" className={`ml-2 text-sm font-normal ${tone}`}>
      {/* toFixed already carries the minus sign; only a gain needs one added. */}
      {deltaMs > 0 ? '+' : ''}
      {seconds.toFixed(3)}s
    </span>
  );
}

/**
 * Signed σ change vs the previous session, in seconds.
 *
 * Takes the two σ values, not a precomputed delta, because it must subtract the
 * ROUNDED figures — the ones printed right next to it. Deriving it from raw σ
 * puts two contradictory numbers on screen (0.649 and 0.551 both render "±0.6s",
 * yet their raw difference renders "(-0.1s)") and produces the "-0.0s" signed
 * zero at the same time.
 *
 * σ deltas carry no success/warn colouring, so the neutral-zero rule the best-lap
 * chip applies reduces to one thing here: an unchanged σ gets no sign.
 */
function SigmaDelta({
  prevSigmaSeconds,
  currSigmaSeconds,
}: {
  prevSigmaSeconds: number | null;
  currSigmaSeconds: number | null;
}) {
  if (prevSigmaSeconds === null || currSigmaSeconds === null) return null;
  const delta = displayedSigmaDeltaSeconds(prevSigmaSeconds, currSigmaSeconds);

  return (
    <span data-testid="sigma-delta" className="ml-2 text-text-subtle">
      ({delta > 0 ? '+' : ''}
      {delta.toFixed(SIGMA_DISPLAY_DECIMALS)}s)
    </span>
  );
}

export default function SessionProgressionStrip({
  sessions,
}: {
  sessions: SessionWithLapTimes[];
}) {
  // σ per session, computed once so a card can reach the one before it. The
  // honesty gate lives here: below the lap minimum we do not compute a σ at all,
  // so there is nothing to accidentally render — and a null also means "no σ
  // delta is earned", which is exactly sessionDelta's rule for the pair.
  //
  // The gate and the σ both read validLapTimesMs, so the count being gated on is
  // the count σ was computed from. A raw laps.map gated on six rows while σ ran
  // over five of them whenever one lap time was 0.
  const sigmas = sessions.map((session) => {
    const lapTimesMs = validLapTimesMs(session.laps);
    return lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS
      ? sessionConsistencySeconds(lapTimesMs)
      : null;
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sessions.map((session, i) => {
        const lapTimesMs = validLapTimesMs(session.laps);
        const sigma = sigmas[i];

        const prev = i > 0 ? sessions[i - 1] : null;
        // Only bestLapDeltaMs is read: the σ delta on screen is derived from the
        // ROUNDED σ values instead (see SigmaDelta), so it cannot claim finer
        // resolution than the σ printed beside it.
        const delta = prev
          ? sessionDelta(
              {
                bestLapMs: prev.best_lap_ms,
                lapTimesMs: validLapTimesMs(prev.laps),
              },
              { bestLapMs: session.best_lap_ms, lapTimesMs }
            )
          : null;

        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="block rounded-lg border border-subtle bg-surface p-4 transition-colors hover:border-strong"
          >
            <p className="text-sm text-muted">Session {i + 1}</p>

            <p className="mt-1 text-xl font-semibold text-primary">
              {/* > 0, not !== null: a 0 best lap would print "0:00.000" here
                  while dayBestLapMs skips it for the KPI directly above and the
                  session page prints "--" for it. Same row, one rule. */}
              {session.best_lap_ms !== null && session.best_lap_ms > 0
                ? formatLapMs(session.best_lap_ms)
                : '--'}
              <BestLapDelta deltaMs={delta?.bestLapDeltaMs ?? null} />
            </p>

            <p className="mt-1 text-sm text-muted">
              {sigma !== null ? (
                <>
                  ±{displayedSigmaSeconds(sigma).toFixed(SIGMA_DISPLAY_DECIMALS)}s
                  <SigmaDelta
                    prevSigmaSeconds={i > 0 ? sigmas[i - 1] : null}
                    currSigmaSeconds={sigma}
                  />
                </>
              ) : (
                // True whether the session is under the lap gate or has too few
                // clean laps for σ to resolve — either way, no claim is made.
                'Too few laps for a consistency figure'
              )}
            </p>

            {/* Lap ROWS recorded, deliberately not lapTimesMs.length: this is
                the same figure the session page's "Laps" card shows, and the two
                must not disagree one click apart. The σ line above already says
                when a session cannot support a consistency figure, without
                putting a second, smaller lap count next to this one. */}
            <p className="mt-1 text-xs text-text-subtle">
              {session.laps.length} {session.laps.length === 1 ? 'lap' : 'laps'}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
