'use client';

/**
 * The day page's focus panel — zone 2, READ/MANAGE ONLY.
 *
 * This panel never writes an assessment. Status transitions (pause / drop /
 * achieve / reactivate) PATCH the item with no session anchor and create no
 * assessment row; assessments happen exclusively through a session's debrief
 * sheet, where the session linkage is explicit. An ambient panel that
 * auto-attached judgments to "latest session" is the dishonesty the design
 * doc rejected.
 *
 * House rules this file must never break:
 *  - Grouping comes from focusPanelGroups (@/lib/track-days) — including the
 *    INTENDED GAP that "Resolved this day" means resolved-with-same-day-
 *    evidence, and everything else non-active lands in Paused/inactive so no
 *    item is ever invisible. This component only assembles the lib's inputs
 *    from the embeds.
 *  - Origin labels are facts read off the origin session's DAY. A null origin
 *    says "added outside a session"; an unresolvable one says nothing. Never
 *    inferred from timestamps.
 *  - "Add focus item" here sends NO createdAfterSessionId: the panel is not
 *    session-anchored, and origin unknown is recorded as unknown.
 *  - Every write renders pending/failed/retry (useControlWrite) and
 *    router.refresh()es on success so the server-rendered page recomputes.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FOCUS_STATUS_LABELS,
  JUDGMENT_LABELS,
  assessmentsInSessionOrder,
  focusPanelGroups,
} from '@/lib/track-days';
import { formatTrackDate } from '@/lib/time';
import { PendingWrite, useControlWrite } from '@/components/ui/PendingWrite';
import type {
  AssessmentJudgment,
  FocusItemStatus,
  FocusItemWithAssessments,
  FocusOriginSession,
} from '@/lib/types';

/**
 * Compact glyph per judgment for the timeline row. The glyph restates the
 * coach's own recorded judgment — direction included — it concludes nothing
 * of its own. Full label rides along as the accessible name.
 */
const JUDGMENT_MARKERS: Record<AssessmentJudgment, string> = {
  improved: '▲',
  keep_working: '●',
  no_change: '○',
  regressed: '▼',
};

/**
 * The origin label, or null when there is nothing honest to say.
 *
 * Read off the origin session's DAY: the plain track-local calendar date plus
 * the track name — never the session's timestamptz, which renders in the
 * runtime's timezone and can name the previous day. A null origin id is the
 * recorded fact "added outside a session". A non-null id that does not
 * resolve (or resolves to a day-less session) gets NO label: "added outside a
 * session" would be a lie, and a derived date would be an inference.
 */
function originLabel(
  item: FocusItemWithAssessments,
  originById: Map<string, FocusOriginSession>
): string | null {
  if (item.created_after_session_id === null) return 'added outside a session';
  const origin = originById.get(item.created_after_session_id);
  if (!origin?.track_day) return null;
  return `from ${origin.track_day.track.name}, ${formatTrackDate(origin.track_day.date)}`;
}

/**
 * The item's judgments in coaching order — one marker per assessed session,
 * ordered by assessmentsInSessionOrder (bySessionStart underneath, the same
 * comparator behind every "Session N"). Renders nothing for an unassessed
 * item: an empty timeline is no fact at all.
 */
function JudgmentTimeline({
  item,
  sessionById,
}: {
  item: FocusItemWithAssessments;
  sessionById: Map<string, { id: string; date: string }>;
}) {
  if (item.focus_item_assessments.length === 0) return null;
  const ordered = assessmentsInSessionOrder(item.focus_item_assessments, sessionById);
  return (
    <span data-testid="judgment-timeline" className="inline-flex gap-1 text-xs text-muted">
      {ordered.map((assessment) => {
        const label =
          JUDGMENT_LABELS[assessment.judgment as AssessmentJudgment] ?? assessment.judgment;
        return (
          <span key={assessment.id} role="img" aria-label={label} title={label}>
            {JUDGMENT_MARKERS[assessment.judgment as AssessmentJudgment] ?? '·'}
          </span>
        );
      })}
    </span>
  );
}

/** One PATCH { status } write with its own pending/failed/retry state. */
function useStatusWrite(itemId: string) {
  const router = useRouter();
  const write = useControlWrite();
  const setStatus = (status: FocusItemStatus) =>
    void write.run(
      () =>
        fetch(`/api/focus-items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      () => router.refresh()
    );
  return { write, setStatus };
}

const manageButtonClass =
  'rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:border-strong';

function ActiveItemRow({
  item,
  originById,
  sessionById,
}: {
  item: FocusItemWithAssessments;
  originById: Map<string, FocusOriginSession>;
  sessionById: Map<string, { id: string; date: string }>;
}) {
  const { write, setStatus } = useStatusWrite(item.id);
  const origin = originLabel(item, originById);

  return (
    <li className="rounded-lg border border-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-primary">{item.text}</p>
        <JudgmentTimeline item={item} sessionById={sessionById} />
      </div>
      {origin && <p className="mt-1 text-xs text-text-subtle">{origin}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => setStatus('paused')} className={manageButtonClass}>
          Pause
        </button>
        <button type="button" onClick={() => setStatus('dropped')} className={manageButtonClass}>
          Drop
        </button>
        <button type="button" onClick={() => setStatus('achieved')} className={manageButtonClass}>
          Achieve
        </button>
        <PendingWrite status={write.status} retry={write.retry} />
      </div>
    </li>
  );
}

function InactiveItemRow({ item }: { item: FocusItemWithAssessments }) {
  const { write, setStatus } = useStatusWrite(item.id);
  return (
    <li className="rounded-lg border border-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-primary">{item.text}</p>
        <span className="text-xs text-text-subtle">
          {FOCUS_STATUS_LABELS[item.status as FocusItemStatus] ?? item.status}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => setStatus('active')} className={manageButtonClass}>
          Reactivate
        </button>
        <PendingWrite status={write.status} retry={write.retry} />
      </div>
    </li>
  );
}

/**
 * "Add focus item" for the non-session cases: pre-day planning, a thought at
 * dinner. The body carries NO createdAfterSessionId — the panel has no
 * session to honestly anchor to, and null origin is exactly what the item's
 * label will say.
 */
function AddFocusItem({ driverId }: { driverId: string }) {
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
          body: JSON.stringify({ driverId, text: trimmed }),
        }),
      () => {
        // Cleared only on success — a failed add keeps the text for Retry.
        setText('');
        router.refresh();
      }
    );
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="panel-new-focus-item" className="sr-only">
        New focus item
      </label>
      <input
        id="panel-new-focus-item"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What to work on"
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

export default function FocusPanel({
  driverId,
  daySessionIds,
  focusItems,
  originSessions,
  assessmentSessions,
}: {
  driverId: string;
  /** ids of THIS day's sessions — the same-day-evidence proxy for "Resolved this day". */
  daySessionIds: string[];
  /** The driver's focus items with their FULL assessment history. */
  focusItems: FocusItemWithAssessments[];
  /** The items' origin sessions with their days — possibly from OTHER days. */
  originSessions: FocusOriginSession[];
  /** id+date of every session the assessments anchor to, for timeline order. */
  assessmentSessions: Array<{ id: string; date: string }>;
}) {
  const [showInactive, setShowInactive] = useState(false);

  // Input assembly only — the grouping rule itself is focusPanelGroups', the
  // same division of labor as the debrief sheet's assessedItemIds.
  const daySessionIdSet = new Set(daySessionIds);
  const assessedThisDayItemIds = new Set(
    focusItems
      .filter((item) =>
        item.focus_item_assessments.some((a) => daySessionIdSet.has(a.session_id))
      )
      .map((item) => item.id)
  );
  const { active, resolvedThisDay, pausedInactive } = focusPanelGroups({
    items: focusItems,
    assessedThisDayItemIds,
  });

  const originById = new Map(originSessions.map((origin) => [origin.id, origin]));
  const sessionById = new Map(
    assessmentSessions.map((session) => [session.id, session])
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Focus Items</h2>

      <div className="space-y-2" data-testid="focus-active">
        <h3 className="text-sm font-semibold text-primary">Active</h3>
        {active.length > 0 ? (
          <ul className="space-y-3">
            {active.map((item) => (
              <ActiveItemRow
                key={item.id}
                item={item}
                originById={originById}
                sessionById={sessionById}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No active focus items.</p>
        )}
      </div>

      {/* Rendered only when it has content: an empty "Resolved this day" would
          read as "nothing resolved", which — given the intended gap above —
          is not a claim this panel can honestly make. */}
      {resolvedThisDay.length > 0 && (
        <div className="space-y-2" data-testid="focus-resolved">
          <h3 className="text-sm font-semibold text-primary">Resolved this day</h3>
          <ul className="space-y-3">
            {resolvedThisDay.map((item) => (
              <li key={item.id} className="rounded-lg border border-subtle p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-primary">{item.text}</p>
                  <span className="text-xs text-text-subtle">
                    {FOCUS_STATUS_LABELS[item.status as FocusItemStatus] ?? item.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Driver-scoped and NOT day-filtered: reactivation must be reachable
          for an item paused a month ago. Collapsed, never absent. */}
      {pausedInactive.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={showInactive}
            onClick={() => setShowInactive((open) => !open)}
            className="text-sm font-semibold text-primary hover:text-accent-primary"
          >
            Paused / inactive ({pausedInactive.length})
          </button>
          {showInactive && (
            <ul className="space-y-3" data-testid="focus-inactive">
              {pausedInactive.map((item) => (
                <InactiveItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}

      <AddFocusItem driverId={driverId} />
    </section>
  );
}
