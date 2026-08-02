'use client';

/**
 * The day page's AI summary slot — zone 3, directly above Day notes.
 *
 * WHICH ROW IS CURRENT IS NOT DECIDED HERE. `daySummaryView` picks the current
 * row and the revision-in-progress draft, and `editedAfterApproval` decides the
 * chip; both live in @/lib/day-summaries because they are semantics wearing a
 * presentation costume. The five states the design names are just what this
 * component renders for the four combinations that function returns:
 *
 *   current null                     -> generate
 *   current draft                    -> editable draft, Approve, Regenerate
 *   current approved                 -> editable approved text, chip, Regenerate
 *   current approved + pendingDraft  -> the above, plus the revision card
 *
 * Text edits autosave into `final_text` with the DayNotes debounce (800ms,
 * flush on blur and unmount). They and Approve share ONE write queue, and that
 * is load-bearing rather than tidy: `set_updated_at` fires on every UPDATE, so
 * a PATCH landing after the approve POST pushes `updated_at` past `approved_at`
 * and lights "Edited after approval" with no post-approval edit at all. Typing
 * and then clicking Approve inside the debounce window is the ordinary way this
 * control gets used, so the click flushes the pending edit and the approval
 * queues behind it.
 *
 * A 409 from any write is the stale-tab case (the row was superseded in another
 * tab). The controls are replaced by SUMMARY_REPLACED's message and a Refresh —
 * never a generic save error, which would invite a retry that cannot succeed.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUMMARY_REPLACED, daySummaryView, editedAfterApproval } from '@/lib/day-summaries';
import { formatDate } from '@/lib/time';
import { Card } from '@/components/ui/Card';
import { PendingWrite, useControlWrite } from '@/components/ui/PendingWrite';
import type { DaySummary } from '@/lib/types';

const DEBOUNCE_MS = 800;

const buttonClass =
  'rounded-lg border border-subtle px-3 py-2 text-sm text-muted hover:border-strong disabled:opacity-50';

/**
 * One unit of work on the summary write queue. Approve carries its own row id:
 * in the draft-beside-approved state the Approve on screen promotes the
 * REVISION, not the row the textarea is editing.
 */
type Job =
  | { kind: 'text'; summaryId: string; value: string }
  | { kind: 'approve'; summaryId: string };

/**
 * How an approved row labels itself. The approver's name is passed in — this
 * component never guesses it — and its absence degrades to a shorter true
 * statement rather than a placeholder.
 *
 * `approved_at` is a timestamptz (an instant), so formatDate, never
 * formatTrackDate: that one is for the day's plain calendar date.
 */
function approvedLabel(row: DaySummary, approverName?: string): string {
  const by = approverName ? `Approved by ${approverName}` : 'Approved';
  return row.approved_at ? `${by} · ${formatDate(row.approved_at)}` : by;
}

export default function DaySummarySlot({
  dayId,
  summaries,
  approverName,
}: {
  dayId: string;
  /** Every generation recorded for the day — drafts, approved, superseded. */
  summaries: DaySummary[];
  /** The approving coach's display name, when the page knows it. */
  approverName?: string;
}) {
  const router = useRouter();
  const { current, pendingDraft } = daySummaryView(summaries);

  // Two write states, deliberately separate: a failed generation must not paint
  // the autosave indicator, and generation takes seconds while a PATCH is
  // instant — one shared "pending" would describe neither.
  const generate = useControlWrite();
  const write = useControlWrite();

  const [replaced, setReplaced] = useState(false);
  const [text, setText] = useState(current?.final_text ?? '');

  // Re-seed when a DIFFERENT row becomes current — a regenerate, or a revision
  // approved out of the card below. Adjusting state during render (React's own
  // "adjusting state when a prop changes" pattern) rather than in an effect, so
  // the coach never sees one frame of the old summary under the new label.
  // Deliberately NOT keyed on final_text: after an autosave + refresh the row
  // id is unchanged and re-seeding would yank the textarea out from under
  // whatever has been typed since.
  const [seededId, setSeededId] = useState(current?.id ?? null);
  if ((current?.id ?? null) !== seededId) {
    setSeededId(current?.id ?? null);
    setText(current?.final_text ?? '');
    // A new current row IS the refresh the replaced message asked for.
    setReplaced(false);
  }

  /** Every write goes through here, so the 409 is recognized in ONE place. */
  const request = async (url: string, init: RequestInit) => {
    const response = await fetch(url, init);
    if (response.status === 409) setReplaced(true);
    return response;
  };

  // Serialization state, the DayNotes pattern with a queue of jobs instead of a
  // single pending value — because Approve rides it too (see the docblock).
  const inFlight = useRef<Promise<void> | null>(null);
  const queue = useRef<Job[]>([]);
  // The last job handed to the wire, so retry re-sends THROUGH the queue. The
  // hook's own retry would re-run the closure outside `inFlight`, and an
  // untracked write reopens the ordering race.
  const lastSent = useRef<Job | null>(null);

  const send = (job: Job) => {
    lastSent.current = job;
    inFlight.current = write
      .run(
        () =>
          job.kind === 'text'
            ? request(`/api/day-summaries/${job.summaryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalText: job.value }),
              })
            : // No payload: approval publishes the text the row already holds.
              request(`/api/day-summaries/${job.summaryId}/approve`, { method: 'POST' }),
        // Approval changes the label, the chip and which row is current, so the
        // server-rendered page must recompute. A text PATCH deliberately does
        // NOT refresh — it would fight the coach mid-sentence.
        job.kind === 'approve' ? () => router.refresh() : undefined
      )
      .then(() => {
        inFlight.current = null;
        const next = queue.current.shift();
        // Fires even after unmount (the chain lives on the promise, not the
        // component); the hook's setStatus is then a React no-op.
        if (next) send(next);
      });
  };

  const enqueue = (job: Job) => {
    if (inFlight.current === null) {
      send(job);
      return;
    }
    const last = queue.current[queue.current.length - 1];
    // Latest text wins, exactly as in DayNotes — but only over another waiting
    // TEXT job. A queued Approve must keep its place behind the edit it
    // followed, or the approval publishes wording the coach already replaced.
    if (job.kind === 'text' && last?.kind === 'text') {
      queue.current[queue.current.length - 1] = job;
    } else {
      queue.current.push(job);
    }
  };

  /**
   * Queue one text save against the CURRENT row (there is nothing to edit
   * without one).
   *
   * Blank text is sent, not suppressed — unlike DayNotes, which encodes empty
   * as null. `final_text` is NOT NULL and the PATCH route rejects an empty
   * string: there is no "clear the summary" action, regenerating replaces it.
   * A silent skip would leave the coach believing an emptied box had saved, so
   * the rejection surfaces as a failed save, which is what it is.
   */
  const saveText = (value: string) => {
    if (!current) return;
    enqueue({ kind: 'text', summaryId: current.id, value });
  };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (value: string) => {
    setText(value);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      saveText(value);
    }, DEBOUNCE_MS);
  };

  /** Send a pending edit NOW; a no-op when nothing is waiting on the timer. */
  const flush = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    saveText(text);
  };

  // Flush on unmount. The cleanup below registers once, so it reads the CURRENT
  // flush (and therefore the current text) through a ref reassigned after every
  // commit — a first-render closure would save stale text. The reassignment
  // lives in an effect, not the render body, so a discarded concurrent render
  // can never leak its closure into the ref.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  /** Flush first, then queue the approval BEHIND the edit it followed. */
  const approve = (summaryId: string) => {
    flush();
    enqueue({ kind: 'approve', summaryId });
  };

  const retry = () => {
    if (lastSent.current !== null) enqueue(lastSent.current);
  };

  const startGenerate = () =>
    void generate.run(() => request(`/api/days/${dayId}/summary`, { method: 'POST' }), () =>
      router.refresh()
    );

  const generateLabel =
    generate.status === 'pending'
      ? 'Generating…'
      : generate.status === 'failed'
        ? 'Retry'
        : current
          ? 'Regenerate'
          : 'Generate day summary';

  // The controls, or the stale-tab message that replaces them. Nothing here can
  // succeed against a superseded row, so nothing here is offered.
  const controls = replaced ? (
    <div className="space-y-2">
      <p className="text-sm text-status-critical">{SUMMARY_REPLACED.message}</p>
      <button type="button" onClick={() => router.refresh()} className={buttonClass}>
        Refresh
      </button>
    </div>
  ) : (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {current?.status === 'draft' && (
          <button type="button" onClick={() => approve(current.id)} className={buttonClass}>
            Approve
          </button>
        )}
        <button
          type="button"
          onClick={startGenerate}
          disabled={generate.status === 'pending'}
          className={buttonClass}
        >
          {generateLabel}
        </button>
      </div>
      {generate.status === 'failed' && (
        <p role="alert" className="text-xs text-status-critical">
          Could not generate a day summary.
        </p>
      )}
    </div>
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold text-primary">Day summary</h2>
        {current !== null && !replaced && <PendingWrite status={write.status} retry={retry} />}
      </div>

      {current === null ? (
        <Card className="space-y-3">
          <p className="text-sm text-muted">No summary generated for this day yet.</p>
          {controls}
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-subtle">
              {current.status === 'draft'
                ? 'AI draft — not approved'
                : approvedLabel(current, approverName)}
            </span>
            {editedAfterApproval(current) && (
              <span className="rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
                Edited after approval
              </span>
            )}
          </div>
          <textarea
            aria-label="Day summary"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onBlur={flush}
            disabled={replaced}
            rows={8}
            className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-text-subtle disabled:opacity-50"
          />
          {controls}
        </Card>
      )}

      {/* State 5. The approved summary above is still what the day says; this
          is the regeneration waiting on a decision. Read-only on purpose —
          approving it makes it current, and current is what is editable. */}
      {pendingDraft !== null && (
        <Card data-testid="pending-draft" className="space-y-3">
          <p className="text-xs text-text-subtle">Revision in progress</p>
          <p className="whitespace-pre-wrap text-sm text-primary">{pendingDraft.final_text}</p>
          {!replaced && (
            <button
              type="button"
              onClick={() => approve(pendingDraft.id)}
              className={buttonClass}
            >
              Approve
            </button>
          )}
        </Card>
      )}
    </section>
  );
}
