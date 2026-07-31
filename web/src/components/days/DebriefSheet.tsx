'use client';

/**
 * The between-sessions debrief sheet — Phase 2's centerpiece. Opens from any
 * session card on the day page (retroactive assessment is legitimate: a coach
 * may fill in Session 2's debrief during Session 4's break) and does four
 * things, in the order a paddock debrief happens:
 *
 *  1. Flag the session's context (ContextFlagChips).
 *  2. Compare against a NAMED baseline — the nearest earlier counted session
 *     per deltaBaselineIndex, never blindly i-1.
 *  3. Assess the focus items in play (tap a judgment; correct a past one).
 *  4. Add a new focus item, anchored to THIS session as its origin.
 *
 * House rules this file must never break:
 *  - Every σ, gate, baseline and eligibility split comes from the shared lib
 *    (@/lib/track-days, @/lib/insights, @/lib/analytics-v2). Nothing numeric
 *    is re-derived here.
 *  - Deltas are signed numbers; the app compares, the instructor concludes.
 *  - A judgment-only tap sends a body with NO note key — the assessments
 *    route preserves the stored note only when the key is absent.
 *  - Every write renders pending → saved/failed with retry (useControlWrite),
 *    and every successful write router.refresh()es so the server-rendered day
 *    page recomputes what this write changed.
 *
 * `sessions` MUST arrive in bySessionStart order — that order IS the
 * "Session N" naming and the baseline index arithmetic.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sessionConsistencySeconds, idealLapMs, type LapSectors } from '@/lib/analytics-v2';
import { canClaimConsistency } from '@/lib/insights';
import {
  SIGMA_DISPLAY_DECIMALS,
  deltaBaselineIndex,
  displayedSigmaDeltaSeconds,
  focusItemsForSession,
  sessionDelta,
  validLapTimesMs,
} from '@/lib/track-days';
import ContextFlagChips from '@/components/sessions/ContextFlagChips';
import { PendingWrite, useControlWrite } from '@/components/ui/PendingWrite';
import type { AssessmentJudgment, FocusItemWithAssessments, Session } from '@/lib/types';
import type { Json } from '@/lib/types/database';

/**
 * The lap shape the sheet needs. sector_data is OPTIONAL so callers holding
 * the narrower SessionWithLapTimes projection still typecheck — they simply
 * get no ideal-lap delta, which is the honest rendering of laps fetched
 * without sectors.
 */
export interface DebriefLap {
  lap_number: number;
  lap_time_ms: number | null;
  sector_data?: Json | null;
}

export interface DebriefSession extends Session {
  laps: DebriefLap[];
}

const JUDGMENTS: Array<{ value: AssessmentJudgment; label: string }> = [
  { value: 'improved', label: 'Improved' },
  { value: 'keep_working', label: 'Keep working' },
  { value: 'no_change', label: 'No change' },
  { value: 'regressed', label: 'Regressed' },
];

/**
 * Coerce one lap's sector_data (raw Json) into the LapSectors idealLapMs
 * consumes. Shape plumbing only — no math: non-numeric entries are dropped and
 * an empty/non-object value becomes null, which idealLapMs already treats as
 * "no usable sectors". Mirrors the coach dashboard's normalizeSectorData.
 */
function lapSectors(raw: Json | null | undefined): LapSectors | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: LapSectors = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** "+1.500s" / "-1.500s" / "0.000s" — zero carries no sign; it is neither gain nor loss. */
function signedSeconds(seconds: number, decimals: number): string {
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(decimals)}s`;
}

/**
 * Zone 2 — the comparison. Both empty states are distinct claims: index 0 has
 * no earlier session AT ALL, while a null baseline behind index > 0 means every
 * earlier session was excluded. Conflating them would tell a coach on Session 3
 * that the day just started.
 */
function DeltaBlock({ sessions, index }: { sessions: DebriefSession[]; index: number }) {
  if (index === 0) {
    return (
      <p className="text-sm text-muted">No comparison baseline yet — first session of the day</p>
    );
  }

  const baselineIndex = deltaBaselineIndex(sessions, index);
  if (baselineIndex === null) {
    return <p className="text-sm text-muted">— no earlier representative session</p>;
  }

  const baseline = sessions[baselineIndex];
  const current = sessions[index];
  const baselineLapTimes = validLapTimesMs(baseline.laps);
  const currentLapTimes = validLapTimesMs(current.laps);

  const delta = sessionDelta(
    { bestLapMs: baseline.best_lap_ms, lapTimesMs: baselineLapTimes },
    { bestLapMs: current.best_lap_ms, lapTimesMs: currentLapTimes }
  );

  // σ on BOTH sides only through the gate, then the delta of the ROUNDED
  // values — the same idiom as the strip's SigmaDelta, for the same reason: a
  // delta must not claim finer resolution than the σ figures it came from.
  const baselineSigma = canClaimConsistency(baselineLapTimes)
    ? sessionConsistencySeconds(baselineLapTimes)
    : null;
  const currentSigma = canClaimConsistency(currentLapTimes)
    ? sessionConsistencySeconds(currentLapTimes)
    : null;
  const sigmaDelta =
    baselineSigma !== null && currentSigma !== null
      ? displayedSigmaDeltaSeconds(baselineSigma, currentSigma)
      : null;

  // Ideal-lap delta only when BOTH sessions' laps form an ideal lap. idealLapMs
  // returning null — no sectors, or a sector with no positive split — IS the
  // "carries sector_data" check, applied per side.
  const baselineIdeal = idealLapMs(baseline.laps.map((lap) => lapSectors(lap.sector_data)));
  const currentIdeal = idealLapMs(current.laps.map((lap) => lapSectors(lap.sector_data)));

  // A partial baseline is a real comparison with a caveat — so the caveat
  // travels WITH the baseline's name, note and all.
  const partialSuffix =
    baseline.representativeness === 'partial'
      ? ` · partial${
          baseline.representativeness_note ? ` — ${baseline.representativeness_note}` : ''
        }`
      : '';

  return (
    <div className="space-y-1 text-sm text-primary">
      <p data-testid="delta-baseline" className="text-muted">
        vs Session {baselineIndex + 1}
        {partialSuffix}
      </p>
      <p data-testid="delta-best-lap">
        {/* null means no pair of best laps exists; 0 means an identical pair
            and renders as an explicit 0.000s. Never the same rendering. */}
        Best lap Δ {delta.bestLapDeltaMs !== null ? signedSeconds(delta.bestLapDeltaMs / 1000, 3) : '--'}
      </p>
      <p data-testid="delta-sigma">
        σ Δ{' '}
        {sigmaDelta !== null
          ? `${sigmaDelta > 0 ? '+' : ''}${sigmaDelta.toFixed(SIGMA_DISPLAY_DECIMALS)}s`
          : '--'}
      </p>
      {baselineIdeal !== null && currentIdeal !== null && (
        <p data-testid="delta-ideal">
          ideal-lap Δ {signedSeconds((currentIdeal - baselineIdeal) / 1000, 3)}
        </p>
      )}
      {/* Lap ROWS recorded, matching the strip and the session page. */}
      <p data-testid="delta-laps" className="text-xs text-text-subtle">
        {current.laps.length} laps vs {baseline.laps.length} laps
      </p>
    </div>
  );
}

/**
 * Zone 3, one row — an item with its four judgment buttons and note. Serves
 * both groups: a reviewed item arrives with `current` set (tappable to
 * correct), an in-play one with null.
 */
function AssessmentRow({
  item,
  sessionId,
  current,
}: {
  item: { id: string; text: string };
  sessionId: string;
  current: { judgment: string; note: string | null } | null;
}) {
  const router = useRouter();
  const judgmentWrite = useControlWrite();
  const noteWrite = useControlWrite();
  const [judgment, setJudgment] = useState<AssessmentJudgment | null>(
    (current?.judgment as AssessmentJudgment | undefined) ?? null
  );
  const [noteDraft, setNoteDraft] = useState(current?.note ?? '');

  const put = (body: Record<string, unknown>) =>
    fetch(`/api/focus-items/${item.id}/assessments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  return (
    <div className="rounded-lg border border-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-primary">{item.text}</p>
        <PendingWrite status={judgmentWrite.status} retry={judgmentWrite.retry} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {JUDGMENTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={judgment === value}
            onClick={() => {
              setJudgment(value);
              // Judgment-only: NO note key in this body. The route's
              // omit-preserves rule keeps whatever note is already stored;
              // `note: null` here would erase it.
              void judgmentWrite.run(
                () => put({ sessionId, judgment: value }),
                () => router.refresh()
              );
            }}
            className={`rounded-lg border px-3 py-3 text-sm transition-colors ${
              judgment === value
                ? 'border-strong bg-surfaceAlt text-primary'
                : 'border-subtle text-muted hover:border-strong'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={`assessment-note-${item.id}`} className="sr-only">
          Assessment note
        </label>
        <input
          id={`assessment-note-${item.id}`}
          type="text"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Optional note"
          className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-text-subtle"
        />
        <button
          type="button"
          // The note is its own write, and only an EDITED note earns one — the
          // route needs a judgment for the cell, so no judgment means nothing
          // to attach a note to yet.
          disabled={judgment === null || noteDraft === (current?.note ?? '')}
          onClick={() => {
            if (judgment === null) return;
            void noteWrite.run(
              () => put({ sessionId, judgment, note: noteDraft.trim() || null }),
              () => router.refresh()
            );
          }}
          className="shrink-0 rounded-lg border border-subtle px-3 py-2 text-sm text-muted hover:border-strong disabled:opacity-50"
        >
          Save note
        </button>
        <PendingWrite status={noteWrite.status} retry={noteWrite.retry} />
      </div>
    </div>
  );
}

/** Zone 4 — a new focus item, with THIS session recorded as its origin. */
function AddFocusItem({ driverId, sessionId }: { driverId: string; sessionId: string }) {
  const router = useRouter();
  const { status, run, retry } = useControlWrite();
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void run(
      () =>
        fetch('/api/focus-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId,
            text: trimmed,
            // Explicit origin: this item is coaching output OF this session,
            // which is what makes it "in play" only from the NEXT one on.
            createdAfterSessionId: sessionId,
          }),
        }),
      () => {
        // Cleared only on success: a failed add keeps the text so Retry (and
        // the coach's eyes) still have it.
        setText('');
        router.refresh();
      }
    );
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="new-focus-item" className="sr-only">
        New focus item
      </label>
      <input
        id="new-focus-item"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What to work on next session"
        className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-text-subtle"
      />
      <button
        type="button"
        onClick={submit}
        disabled={text.trim().length === 0}
        className="shrink-0 rounded-lg border border-subtle px-3 py-2 text-sm text-muted hover:border-strong disabled:opacity-50"
      >
        Add focus item
      </button>
      <PendingWrite status={status} retry={retry} />
    </div>
  );
}

export default function DebriefSheet({
  driverId,
  sessions,
  index,
  dayDate,
  trackTimezone,
  focusItems,
  originSessions,
  onClose,
}: {
  driverId: string;
  /** The day's sessions in bySessionStart order. */
  sessions: DebriefSession[];
  /** Which session this debrief is FOR — its position IS its "Session N". */
  index: number;
  /** track_days.date — a plain track-local calendar date. */
  dayDate: string;
  trackTimezone: string | null;
  focusItems: FocusItemWithAssessments[];
  /** id+date of the items' origin sessions — possibly from OTHER days. */
  originSessions: Array<{ id: string; date: string }>;
  onClose: () => void;
}) {
  const session = sessions[index];

  // "Assessed AT this session", exactly — not "ever assessed". The eligibility
  // split itself is the lib's; this only assembles its inputs from the embeds.
  const assessedItemIds = new Set(
    focusItems
      .filter((item) => item.focus_item_assessments.some((a) => a.session_id === session.id))
      .map((item) => item.id)
  );

  const { reviewed, inPlay } = focusItemsForSession({
    items: focusItems,
    assessedItemIds,
    session: { id: session.id, date: session.date },
    originSessions: new Map(originSessions.map((origin) => [origin.id, origin])),
    dayDate,
    trackTimezone,
  });

  // The lib returns the full tagged union (an item can be in both groups); the
  // presentation split — reviewed rows first, then the not-yet-reviewed — is
  // the caller's, per its contract.
  const reviewedIds = new Set(reviewed.map((item) => item.id));
  const notYetReviewed = inPlay.filter((item) => !reviewedIds.has(item.id));

  const assessmentAt = (item: FocusItemWithAssessments) =>
    item.focus_item_assessments.find((a) => a.session_id === session.id) ?? null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Session ${index + 1} debrief`}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] space-y-6 overflow-y-auto rounded-t-xl border border-subtle bg-surface p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Session {index + 1} debrief</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-subtle px-3 py-2 text-sm text-muted hover:border-strong"
          >
            Close
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Session context</h3>
          <ContextFlagChips
            sessionId={session.id}
            representativeness={session.representativeness}
            note={session.representativeness_note}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Comparison</h3>
          <DeltaBlock sessions={sessions} index={index} />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Focus items</h3>
          {reviewed.length === 0 && notYetReviewed.length === 0 ? (
            <p className="text-sm text-muted">No focus items in play for this session.</p>
          ) : (
            <div className="space-y-3">
              {reviewed.map((item) => (
                <AssessmentRow
                  key={item.id}
                  item={item}
                  sessionId={session.id}
                  current={assessmentAt(item)}
                />
              ))}
              {notYetReviewed.map((item) => (
                <AssessmentRow key={item.id} item={item} sessionId={session.id} current={null} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Add focus item</h3>
          <AddFocusItem driverId={driverId} sessionId={session.id} />
        </section>
      </div>
    </div>
  );
}
