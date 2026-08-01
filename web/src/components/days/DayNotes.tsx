'use client';

/**
 * The day page's notes scratchpad — zone 3, below the focus panel.
 *
 * A free-form textarea over track_days.notes with debounced autosave: one
 * PATCH per pause in typing, not one per keystroke. The rule that makes
 * autosave honest is that leaving never drops an edit — blur and unmount both
 * flush the pending save immediately, so navigating away inside the debounce
 * window still writes.
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
  const { status, run, retry } = useControlWrite();
  const [text, setText] = useState(initialNotes ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (value: string) => {
    const notes = value.trim() === '' ? null : value;
    // No router.refresh() on success: this textarea is the only surface on the
    // page rendering notes, and a refresh mid-typing would fight the coach.
    void run(() =>
      fetch(`/api/days/${dayId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    );
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
  // every render — a first-render closure would save stale text.
  const flushRef = useRef(flush);
  flushRef.current = flush;
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
