'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import {
  RUN_GROUP_BANDS,
  RUN_GROUP_LABELS,
  type RunGroupBand,
} from '@/components/coach/runGroups';

interface RunGroupControlProps {
  driverId: string;
  current: RunGroupBand;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Ordered bands so we can name the "next" tier for the sign-off copy. */
const NEXT_BAND: Partial<Record<RunGroupBand, RunGroupBand>> = {
  beginner: 'intermediate',
  intermediate: 'advanced',
};

export default function RunGroupControl({ driverId, current }: RunGroupControlProps) {
  const [level, setLevel] = useState<RunGroupBand>(current);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // The parent seeds `current` AFTER an async profile fetch, so re-sync when it
  // lands. Skip while saving so we never clobber an in-flight or just-succeeded
  // optimistic update with a stale prop.
  useEffect(() => {
    if (saveState === 'saving' || saveState === 'saved') return;
    setLevel(current);
  }, [current, saveState]);

  const nextBand = NEXT_BAND[level];

  async function handleSelect(next: RunGroupBand) {
    if (next === level || saveState === 'saving') return;

    const previous = level;
    setLevel(next);
    setSaveState('saving');

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, experienceLevel: next }),
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      setSaveState('saved');
    } catch {
      setLevel(previous);
      setSaveState('error');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
        Run Group
      </p>

      <div
        role="group"
        aria-label="Run group"
        className="inline-flex rounded-lg border border-slate-700 bg-slate-950/50 p-1"
      >
        {RUN_GROUP_BANDS.map((band) => {
          const active = band === level;
          return (
            <button
              key={band}
              type="button"
              aria-pressed={active}
              onClick={() => handleSelect(band)}
              disabled={saveState === 'saving'}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-50'
              }`}
            >
              {RUN_GROUP_LABELS[band]}
            </button>
          );
        })}
      </div>

      {/* Deliberate sign-off framing */}
      {nextBand && (
        <p className="mt-3 text-sm text-slate-300">
          <span className="font-semibold text-slate-100">
            Advance to {RUN_GROUP_LABELS[nextBand]}
          </span>{' '}
          when they are ready — your call, in-car judgment required.
        </p>
      )}

      {/* Save state */}
      {saveState === 'saving' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Saving…</span>
        </p>
      )}
      {saveState === 'saved' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-sky-400">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>Saved</span>
        </p>
      )}
      {saveState === 'error' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-amber-400">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>Could not save — try again.</span>
        </p>
      )}
    </div>
  );
}
