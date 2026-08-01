'use client';

/**
 * The day page's notes scratchpad — zone 3, below the focus panel.
 *
 * A free-form textarea over track_days.notes with debounced autosave: one
 * PATCH per pause in typing, not one per keystroke. Blur and unmount both
 * flush the pending save immediately, so in-app navigation inside the
 * debounce window still writes. (A hard tab close mid-debounce fires neither,
 * so that edit can be lost — the one gap this design accepts.)
 *
 * Saves are serialized: at most one PATCH is in flight at a time, and an edit
 * that lands mid-flight queues (latest wins) until the wire is clear. Two
 * overlapping PATCHes are unordered at the database — the older text could
 * commit last and win while the UI says "Saved".
 *
 * Empty/whitespace is sent as explicit null: one encoding at the write site,
 * matching the route's one stored encoding of "no notes".
 */
import { useEffect, useRef, useState } from 'react';
import { PendingWrite, useControlWrite } from '@/components/ui/PendingWrite';

const DEBOUNCE_MS = 800;

export default function DayNotes({
  dayId,
  initialNotes,
}: {
  dayId: string;
  initialNotes: string | null;
}) {
  const { status, run } = useControlWrite();
  const [text, setText] = useState(initialNotes ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialization state. `inFlight` is the promise of the PATCH currently on
  // the wire (run() always resolves — it catches failures internally), and
  // `queued` holds the single latest value waiting behind it. Overlapping
  // PATCHes would be unordered at the database, so a save that fires
  // mid-flight parks here instead and goes out when the wire clears —
  // success or failure — guaranteeing DB commit order matches edit order.
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef<{ value: string } | null>(null);
  // Last value handed to the wire, so retry can re-send THROUGH the
  // serialization above. The hook's own retry would re-run the closure
  // outside `inFlight`, and an untracked PATCH reopens the ordering race.
  const lastSent = useRef<string | null>(null);

  const send = (value: string) => {
    lastSent.current = value;
    const notes = value.trim() === '' ? null : value;
    // No router.refresh() on success: this textarea is the only surface on the
    // page rendering notes, and a refresh mid-typing would fight the coach.
    inFlight.current = run(() =>
      fetch(`/api/days/${dayId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    ).then(() => {
      inFlight.current = null;
      const next = queued.current;
      if (next !== null) {
        queued.current = null;
        // Fires even after unmount (the chain lives on the promise, not the
        // component); the hook's setStatus is then a React no-op.
        send(next.value);
      }
    });
  };

  const save = (value: string) => {
    if (inFlight.current !== null) {
      queued.current = { value };
      return;
    }
    send(value);
  };

  /** Re-send the failed payload — via `save`, so it too serializes. */
  const retry = () => {
    if (lastSent.current !== null) save(lastSent.current);
  };

  const onChange = (value: string) => {
    setText(value);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      save(value);
    }, DEBOUNCE_MS);
  };

  /** Send a pending edit NOW; a no-op when nothing is waiting on the timer. */
  const flush = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    save(text);
  };

  // Flush on unmount. The cleanup below registers once, so it reads the
  // CURRENT flush (and therefore the current text) through a ref reassigned
  // after every commit — a first-render closure would save stale text. The
  // reassignment lives in an effect, not the render body, so a discarded
  // concurrent render can never leak its closure into the ref.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="day-notes" className="text-xl font-semibold text-primary">
          Day notes
        </label>
        <PendingWrite status={status} retry={retry} />
      </div>
      <textarea
        id="day-notes"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        rows={4}
        placeholder="Anything worth remembering about this day"
        className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-text-subtle"
      />
    </section>
  );
}
