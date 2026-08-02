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
 * Generation is the ONE write deliberately left off that queue. It inserts a
 * NEW row rather than writing the row the queued jobs address, so it has no
 * order to keep with them, and putting an LLM round trip on the autosave's wire
 * would park every subsequent keystroke behind it for seconds. The cost is that
 * with the browser's blur-then-click order a flushed PATCH and the generate
 * POST are in flight together; the PATCH is milliseconds against a row that is
 * still live and the generation takes seconds, and if the PATCH does lose that
 * race its 409 is recoverable (a new current row, or Refresh).
 *
 * A 409 from any write is the stale-tab case (the row was superseded in another
 * tab). The controls are replaced by SUMMARY_REPLACED's message and a Refresh —
 * never a generic save error, which would invite a retry that cannot succeed.
 * That message is escapable BY ITSELF: Refresh clears it as well as asking the
 * server for the truth, because the flip a summary makes most often — draft to
 * approved — does not change the row's id, so "a different row became current"
 * cannot be the only way out.
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
 * The name is used ONLY when it provably belongs to this row's approver:
 * `approverName` describes the coach whose id is `coachId`, and the row names
 * its own approver in `approved_by`. Today's RLS chain makes those the same
 * coach in practice, but a row can be approved by someone else — a driver
 * reassigned between coaches, or a seeded row inserted `approved` with its own
 * `approved_by` (see the migration's write matrix). An unverified name is a
 * confident lie about who signed off; "Approved" is a smaller true statement.
 *
 * `approved_at` is a timestamptz (an instant), so formatDate, never
 * formatTrackDate: that one is for the day's plain calendar date.
 */
function approvedLabel(row: DaySummary, approverName?: string, coachId?: string): string {
  const named =
    approverName !== undefined && row.approved_by !== null && row.approved_by === coachId;
  const by = named ? `Approved by ${approverName}` : 'Approved';
  return row.approved_at ? `${by} · ${formatDate(row.approved_at)}` : by;
}

export default function DaySummarySlot({
  dayId,
  summaries,
  approverName,
  coachId,
}: {
  dayId: string;
  /** Every generation recorded for the day — drafts, approved, superseded. */
  summaries: DaySummary[];
  /** The signed-in coach's display name, when the page knows it. */
  approverName?: string;
  /** Whose name that is — the row's `approved_by` has to match it to be used. */
  coachId?: string;
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
    // Whether this write LANDED. `write.run` turns the outcome into a status
    // and returns nothing, so the drain below would otherwise treat a lost edit
    // exactly like a saved one. False until proven otherwise: a network throw
    // never reaches the assignment, and it is as much a failure as a 500.
    let landed = false;
    inFlight.current = write
      .run(
        async () => {
          const response =
            job.kind === 'text'
              ? await request(`/api/day-summaries/${job.summaryId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ finalText: job.value }),
                })
              : // No payload: approval publishes the text the row already holds.
                await request(`/api/day-summaries/${job.summaryId}/approve`, { method: 'POST' });
          landed = response.ok;
          return response;
        },
        // Approval changes the label, the chip and which row is current, so the
        // server-rendered page must recompute. A text PATCH deliberately does
        // NOT refresh — it would fight the coach mid-sentence.
        job.kind === 'approve' ? () => router.refresh() : undefined
      )
      .then(() => {
        inFlight.current = null;
        // A write that did not land cancels every approval waiting behind it.
        // Approval publishes the text the ROW holds, so approving after a lost
        // edit publishes the wording the coach already replaced — the outcome
        // this queue exists to prevent, reached by the failure path instead of
        // the ordering path. Queued EDITS still drain: each one carries the
        // whole textarea, so sending them is how the coach's words survive.
        if (!landed) queue.current = queue.current.filter((j) => j.kind !== 'approve');
        const next = queue.current.shift();
        // Fires even after unmount (the chain lives on the promise, not the
        // component); the hook's setStatus is then a React no-op.
        if (next) send(next);
      });
  };

  /** Is an approval of this row already on the wire or waiting behind one? */
  const approveOutstanding = (summaryId: string) =>
    (inFlight.current !== null &&
      lastSent.current?.kind === 'approve' &&
      lastSent.current.summaryId === summaryId) ||
    queue.current.some((job) => job.kind === 'approve' && job.summaryId === summaryId);

  const enqueue = (job: Job) => {
    // One approval per row from this component, however impatiently the button
    // is clicked. The second POST lands on a row the first one already flipped
    // to `approved`, and the write matrix allows the approval fields to be
    // written only at draft->approved (see the migration) — so it comes back as
    // a rejection this component can only read as "replaced", a stale-tab
    // banner sitting over a summary that approved perfectly well.
    //
    // Guarded here rather than by disabling the button on any pending write:
    // that would also refuse the approval that rides BEHIND an in-flight edit,
    // which is the queue's whole reason for existing and the ordinary way this
    // control gets used. The write in flight is reported beside the heading.
    if (job.kind === 'approve' && approveOutstanding(job.summaryId)) return;
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
    // Safe only because Retry renders on 'failed', which persists only with an
    // empty queue: re-enqueued behind a NEWER text job, this older text would
    // coalesce over it and save the wrong words.
    if (lastSent.current !== null) enqueue(lastSent.current);
  };

  /**
   * Drop the pending edit, THEN regenerate. Not flush: the timer's closure
   * PATCHes the row that is current right now, and a successful regenerate is
   * what supersedes that row — so the late PATCH earns a 409 that means nothing
   * (the coach is looking at the new draft, which is fine) and paints the
   * stale-tab banner over a draft that is perfectly live. Escapable now that
   * Refresh clears the flag itself, but a banner nobody needed to see.
   *
   * It cancels the TIMER and nothing else. A blur — which a real browser fires
   * before the click that follows it — has already sent that edit; see the file
   * docblock on why generation is not on the queue.
   */
  const startGenerate = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void generate.run(() => request(`/api/days/${dayId}/summary`, { method: 'POST' }), () =>
      router.refresh()
    );
  };

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
      {/* role="alert": this message arrives asynchronously and takes every
          control on the card with it — the largest change on the page is not
          the one to leave unannounced. */}
      <p role="alert" className="text-sm text-status-critical">
        {SUMMARY_REPLACED.message}
      </p>
      <button
        type="button"
        // Clearing the flag here, not only asking the server: the row's id does
        // NOT change when a draft flips to approved, so the id-change reset
        // cannot be relied on to fire and this button would otherwise redraw
        // the same banner it claims to dismiss. If the row really is superseded
        // the next write 409s and the banner comes back — which is the honest
        // ordering: recovery is offered, the server still decides.
        onClick={() => {
          setReplaced(false);
          router.refresh();
        }}
        className={buttonClass}
      >
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
                : approvedLabel(current, approverName, coachId)}
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
