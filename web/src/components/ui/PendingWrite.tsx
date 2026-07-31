'use client';

/**
 * Per-control write state for the debrief flow's tap-to-save controls.
 *
 * One hook instance per control, deliberately nothing shared: a failed
 * judgment tap must not paint the context chips red, and two controls saving
 * at once must each report their own outcome.
 *
 * The hook remembers the last write so `retry` re-runs EXACTLY what failed —
 * same request closure, same success callback — instead of asking the caller
 * to reconstruct it. That is what makes optimistic UI honest here: a write
 * that fails surfaces as failed with a way to try again, and never silently
 * dissolves while the screen keeps showing the optimistic value.
 */
import { useCallback, useRef, useState } from 'react';

export type ControlWriteStatus = 'idle' | 'pending' | 'saved' | 'failed';

export function useControlWrite() {
  const [status, setStatus] = useState<ControlWriteStatus>('idle');
  const last = useRef<{ send: () => Promise<Response>; onSaved?: () => void } | null>(null);
  // Monotonic write counter: when a second tap lands before the first write
  // resolves, the first response must not overwrite the newer write's status —
  // NOR fire its success callback. A stale onSaved is worse than a stale
  // status: callbacks mutate caller state (e.g. clearing an input the coach
  // has since retyped), so only the latest write may run either.
  const seq = useRef(0);

  const run = useCallback(async (send: () => Promise<Response>, onSaved?: () => void) => {
    last.current = { send, onSaved };
    const token = ++seq.current;
    setStatus('pending');
    try {
      const response = await send();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (seq.current === token) {
        setStatus('saved');
        onSaved?.();
      }
    } catch {
      // A network throw and a non-2xx land in the same place: the coach sees
      // "failed" plus retry either way. The response body is not surfaced —
      // there is nothing actionable in it from a paddock.
      if (seq.current === token) setStatus('failed');
    }
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current.send, last.current.onSaved);
  }, [run]);

  return { status, run, retry };
}

/**
 * Inline pending → saved / failed indicator. Renders the retry affordance
 * itself, so no consumer can show "failed" without offering a way out.
 */
export function PendingWrite({
  status,
  retry,
}: {
  status: ControlWriteStatus;
  retry: () => void;
}) {
  if (status === 'idle') return null;
  if (status === 'pending') {
    return (
      <span role="status" className="text-xs text-muted">
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span role="status" className="text-xs text-muted">
        Saved
      </span>
    );
  }
  return (
    <span role="status" className="text-xs text-status-critical">
      Failed to save
      <button type="button" onClick={retry} className="ml-2 underline">
        Retry
      </button>
    </span>
  );
}
