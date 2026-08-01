/**
 * @jest-environment jsdom
 *
 * The day notes scratchpad — zone 3 of the day page. What matters here:
 *
 *  - Saves are debounced: one PATCH per pause in typing, never one per
 *    keystroke, and nothing fires before the debounce elapses.
 *  - Leaving mid-debounce must not drop the edit: blur and unmount both
 *    flush the pending save immediately.
 *  - Empty/whitespace is sent as explicit null — one encoding at the write
 *    site, matching the route's stored encoding.
 *  - Every write renders pending/failed/retry (useControlWrite idiom), and
 *    retry re-sends the exact payload that failed.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DayNotes from '../DayNotes';

const DEBOUNCE_MS = 800;

function calls(fetchMock: jest.Mock): Array<[string, string | undefined, Record<string, unknown>]> {
  return fetchMock.mock.calls.map(([input, init]: [RequestInfo, RequestInit | undefined]) => [
    String(input),
    init?.method,
    init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
  ]);
}

function stubFetch(status = 200): jest.Mock {
  const fetchMock = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  stubFetch();
});

afterEach(() => {
  jest.useRealTimers();
});

const notesArea = () => screen.getByLabelText('Day notes') as HTMLTextAreaElement;

describe('DayNotes', () => {
  it('prefills the textarea from the stored notes', () => {
    render(<DayNotes dayId="day-1" initialNotes="Ran wide in T7 all morning" />);
    expect(notesArea().value).toBe('Ran wide in T7 all morning');
  });

  it('renders a stored null as an empty textarea', () => {
    render(<DayNotes dayId="day-1" initialNotes={null} />);
    expect(notesArea().value).toBe('');
  });

  it('debounces: one PATCH after the pause, nothing before it', async () => {
    const fetchMock = stubFetch();
    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'typed text' } });

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/days/day-1/notes');
    expect(method).toBe('PATCH');
    expect(body).toEqual({ notes: 'typed text' });

    await act(async () => {});
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('a burst of keystrokes resets the debounce — exactly one PATCH, final value', async () => {
    const fetchMock = stubFetch();
    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'Brake ea' } });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    fireEvent.change(notesArea(), { target: { value: 'Brake earlier' } });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    // 800ms since the FIRST keystroke, but only 400 since the last: no save yet.
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, , body] = calls(fetchMock)[0];
    expect(body).toEqual({ notes: 'Brake earlier' });
    await act(async () => {});
  });

  it('clearing to whitespace saves explicit null — one encoding at the write site', async () => {
    const fetchMock = stubFetch();
    render(<DayNotes dayId="day-1" initialNotes="old notes" />);

    fireEvent.change(notesArea(), { target: { value: '   ' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, , body] = calls(fetchMock)[0];
    expect(body).toEqual({ notes: null });
    await act(async () => {});
  });

  it('blur inside the debounce window flushes immediately, and the timer does not double-fire', async () => {
    const fetchMock = stubFetch();
    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'half-typed thought' } });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.blur(notesArea());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, , body] = calls(fetchMock)[0];
    expect(body).toEqual({ notes: 'half-typed thought' });

    // The pending timer was cancelled by the flush: no second PATCH later.
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it('blur with nothing pending sends nothing', () => {
    const fetchMock = stubFetch();
    render(<DayNotes dayId="day-1" initialNotes="stored" />);

    fireEvent.blur(notesArea());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unmount inside the debounce window flushes — navigating away must not drop the edit', async () => {
    const fetchMock = stubFetch();
    const { unmount } = render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'note before navigating' } });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/days/day-1/notes');
    expect(method).toBe('PATCH');
    expect(body).toEqual({ notes: 'note before navigating' });
    // Flush the fetch promise; its setStatus lands on the unmounted hook and
    // is a React no-op — nothing here can throw or leak into the next test.
    await act(async () => {});
  });

  it('serializes overlapping saves: while a PATCH is in flight, later edits queue and only the latest is sent after it settles', async () => {
    let resolveFirst!: (response: unknown) => void;
    const ok = { ok: true, status: 200, json: async () => ({}) };
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementation(async () => ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'A' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    // PATCH A is in flight and unresolved.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Two more flushes land while A is still on the wire: neither may issue a
    // fetch yet (overlapping PATCHes are unordered at the DB), and the first
    // queued value is superseded by the second — latest wins.
    fireEvent.change(notesArea(), { target: { value: 'AB' } });
    fireEvent.blur(notesArea());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(notesArea(), { target: { value: 'ABC' } });
    fireEvent.blur(notesArea());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(ok);
    });

    // Exactly one follow-up PATCH, carrying the latest text — the
    // intermediate 'AB' was never sent.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, , body] = calls(fetchMock)[1];
    expect(body).toEqual({ notes: 'ABC' });
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('a failure with newer text queued behind it sends the newer text — the queued write wins', async () => {
    let resolveFirst!: (response: unknown) => void;
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'doomed save' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(notesArea(), { target: { value: 'newer text' } });
    fireEvent.blur(notesArea());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ ok: false, status: 500, json: async () => ({}) });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, , body] = calls(fetchMock)[1];
    expect(body).toEqual({ notes: 'newer text' });
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('surfaces a failed save with a retry that re-sends the same payload', async () => {
    const fetchMock = stubFetch(500);
    render(<DayNotes dayId="day-1" initialNotes={null} />);

    fireEvent.change(notesArea(), { target: { value: 'important note' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByText('Failed to save')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, , body] = calls(fetchMock)[1];
    expect(body).toEqual({ notes: 'important note' });
  });
});
