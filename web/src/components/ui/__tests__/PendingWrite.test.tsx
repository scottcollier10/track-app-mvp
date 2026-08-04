/**
 * @jest-environment jsdom
 *
 * `useControlWrite`'s `reset` — the escape hatch for a caller that has decided
 * its failed write can never succeed (the row it addressed is gone).
 *
 * The status going back to idle is the visible half and the cheap half. What
 * these tests pin is the other half: nothing is left pointing at the forgotten
 * write. A reset that only hid the failure would leave `retry` re-sending it,
 * and an in-flight write resolving afterwards would repaint 'failed' beside a
 * Retry whose target had just been cleared — a button that does nothing at all.
 */
import { act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useControlWrite } from '../PendingWrite';

const ok = { ok: true, status: 200 } as Response;
const failed = { ok: false, status: 409 } as Response;

describe('useControlWrite reset', () => {
  it('goes back to idle and forgets the write, so retry re-sends nothing', async () => {
    const send = jest.fn(async () => failed);
    const { result } = renderHook(() => useControlWrite());

    await act(async () => {
      await result.current.run(send);
    });
    expect(result.current.status).toBe('failed');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.retry();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('silences a write still on the wire: no late status, no late onSaved', async () => {
    let settle!: (response: Response) => void;
    const send = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
    );
    const onSaved = jest.fn();
    const { result } = renderHook(() => useControlWrite());

    act(() => {
      void result.current.run(send, onSaved);
    });
    expect(result.current.status).toBe('pending');

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      settle(ok);
    });

    // The caller said the slate was clean before this response existed. Letting
    // it through would either flash 'Saved' for a write nobody is waiting on,
    // or — had it failed — offer a Retry with `last` already null.
    expect(result.current.status).toBe('idle');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('leaves an ordinary write untouched: run after reset still reports and retries', async () => {
    const send = jest.fn(async () => ok);
    const { result } = renderHook(() => useControlWrite());

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await result.current.run(send);
    });
    expect(result.current.status).toBe('saved');

    await act(async () => {
      result.current.retry();
    });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
