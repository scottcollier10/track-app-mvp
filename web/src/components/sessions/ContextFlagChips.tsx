'use client';

/**
 * The three-way representativeness control — the write side of the flag the
 * day aggregates and deltas read. Shared between the debrief sheet and the
 * import confirmation, so "session cut short" can be flagged the moment a
 * coach remembers it, wherever that moment is.
 *
 * Two rules from the storage contract:
 *  - NULL is the one stored encoding of "representative"; the route normalizes
 *    the string, so this control may send it freely.
 *  - The context route NULLS an omitted note (unlike the assessments route's
 *    omit-preserves rule), so EVERY write here carries the current note
 *    text — otherwise a bare chip tap would silently wipe a stored note.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PendingWrite, useControlWrite } from '@/components/ui/PendingWrite';
import type { Representativeness } from '@/lib/types';

const OPTIONS: Array<{ value: Representativeness; label: string }> = [
  { value: 'representative', label: 'Representative' },
  { value: 'partial', label: 'Partial' },
  { value: 'not_representative', label: 'Not representative' },
];

export default function ContextFlagChips({
  sessionId,
  representativeness,
  note,
}: {
  sessionId: string;
  /** Stored value; null IS 'representative' (the default state). */
  representativeness: string | null;
  note: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Representativeness>(
    representativeness === 'partial' || representativeness === 'not_representative'
      ? representativeness
      : 'representative'
  );
  const [noteDraft, setNoteDraft] = useState(note ?? '');
  const { status, run, retry } = useControlWrite();

  const save = (flag: Representativeness, noteValue: string) => {
    void run(
      () =>
        fetch(`/api/sessions/${sessionId}/context`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            representativeness: flag,
            note: flag === 'representative' ? null : noteValue.trim() || null,
          }),
        }),
      // The flag feeds server-computed baselines, day best and the trend, so
      // the surrounding server-rendered page must recompute.
      () => router.refresh()
    );
  };

  const noteVisible = selected !== 'representative';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected === value}
            onClick={() => {
              // Optimistic, but never hopeful: the chip flips now, and the
              // PendingWrite beside it reports pending/failed with retry.
              setSelected(value);
              save(value, noteDraft);
            }}
            className={`rounded-full border px-3 py-2 text-sm transition-colors ${
              selected === value
                ? 'border-strong bg-surfaceAlt text-primary'
                : 'border-subtle text-muted hover:border-strong'
            }`}
          >
            {label}
          </button>
        ))}
        <PendingWrite status={status} retry={retry} />
      </div>

      {noteVisible && (
        <div className="flex items-center gap-2">
          <label htmlFor={`context-note-${sessionId}`} className="sr-only">
            Context note
          </label>
          <input
            id={`context-note-${sessionId}`}
            type="text"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Why — cut short, rain, red flag…"
            className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-text-subtle"
          />
          <button
            type="button"
            onClick={() => save(selected, noteDraft)}
            disabled={noteDraft.trim() === (note ?? '')}
            className="shrink-0 rounded-lg border border-subtle px-3 py-2 text-sm text-muted hover:border-strong disabled:opacity-50"
          >
            Save note
          </button>
        </div>
      )}
    </div>
  );
}
