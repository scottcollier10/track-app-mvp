/**
 * @jest-environment jsdom
 *
 * The day page's summary slot — zone 3, above Day notes. What matters here:
 *
 *  - The five states are `daySummaryView`'s, not the component's. The tests
 *    below feed row sets and assert what renders; if the component ever
 *    re-derived "which row is current" locally, state 5 (a draft sitting
 *    beside an approved row) is where that divergence shows up first.
 *  - The "Edited after approval" chip is `editedAfterApproval`'s condition and
 *    only that: lit when updated_at is later than approved_at, dark when they
 *    match. It is the phase's whole disclosure budget.
 *  - Writes are serialized through ONE queue — the debounced final_text PATCH
 *    and Approve alike. An approve that overtakes a pending PATCH lights the
 *    chip with no coach edit at all, so the order is asserted directly.
 *  - A 409 from any write is the stale-tab case: the coach sees
 *    SUMMARY_REPLACED's message and a Refresh, never a generic save error.
 *  - A failed generation writes no row: the slot shows the failure and a
 *    retry, and nothing that looks like a summary.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DaySummarySlot from '../DaySummarySlot';
import { SUMMARY_REPLACED } from '@/lib/day-summaries';
import type { DaySummary } from '@/lib/types';

const DEBOUNCE_MS = 800;

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function makeSummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    id: 'sum-1',
    track_day_id: 'day-1',
    draft_text: 'Session 2 was the day’s tidiest.',
    final_text: 'Session 2 was the day’s tidiest.',
    status: 'draft',
    approved_at: null,
    approved_by: null,
    created_at: '2026-07-12T18:00:00Z',
    updated_at: '2026-07-12T18:00:00Z',
    model: 'claude-sonnet-4-6',
    prompt_context: {},
    informing_session_ids: [],
    informing_assessment_ids: [],
    ...overrides,
  };
}

const approvedRow = (overrides: Partial<DaySummary> = {}) =>
  makeSummary({
    id: 'sum-approved',
    status: 'approved',
    approved_by: 'coach-1',
    approved_at: '2026-07-12T19:00:00Z',
    updated_at: '2026-07-12T19:00:00Z',
    final_text: 'Approved wording.',
    ...overrides,
  });

function calls(
  fetchMock: jest.Mock
): Array<[string, string | undefined, Record<string, unknown> | null]> {
  return fetchMock.mock.calls.map(([input, init]: [RequestInfo, RequestInit | undefined]) => [
    String(input),
    init?.method,
    init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
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

const summaryText = () => screen.getByLabelText('Day summary') as HTMLTextAreaElement;
const button = (name: string) => screen.getByRole('button', { name });

describe('DaySummarySlot', () => {
  it('state 1 (none): renders Generate day summary button and nothing to edit', () => {
    render(<DaySummarySlot dayId="day-1" summaries={[]} />);

    expect(button('Generate day summary')).toBeInTheDocument();
    expect(screen.queryByLabelText('Day summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('generating POSTs to the day summary route, shows pending, and refreshes on success', async () => {
    const fetchMock = stubFetch();
    render(<DaySummarySlot dayId="day-1" summaries={[]} />);

    fireEvent.click(button('Generate day summary'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/days/day-1/summary');
    expect(method).toBe('POST');
    expect(body).toBeNull();
    // Pending sits on the button itself — the generation takes seconds.
    expect(button('Generating…')).toBeDisabled();

    await act(async () => {});
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('state 2 (draft): editable text, unapproved-AI-draft label, Approve + Regenerate', () => {
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    expect(summaryText().value).toBe('Session 2 was the day’s tidiest.');
    expect(summaryText()).not.toBeDisabled();
    expect(screen.getByText('AI draft — not approved')).toBeInTheDocument();
    expect(button('Approve')).toBeInTheDocument();
    expect(button('Regenerate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate day summary' })).not.toBeInTheDocument();
  });

  it('state 3 (approved): final_text rendered, approver + date, Regenerate; no draft label', () => {
    render(
      <DaySummarySlot dayId="day-1" summaries={[approvedRow()]} approverName="Alex Reed" />
    );

    expect(summaryText().value).toBe('Approved wording.');
    expect(screen.getByText('Approved by Alex Reed · Jul 12, 2026')).toBeInTheDocument();
    expect(screen.queryByText('AI draft — not approved')).not.toBeInTheDocument();
    // Already approved: nothing left to approve, but a rewrite is available.
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(button('Regenerate')).toBeInTheDocument();
  });

  it('state 3 chip: "Edited after approval" iff editedAfterApproval(row)', () => {
    // Freshly approved: the DB stamps both instants from the same now().
    const { unmount } = render(
      <DaySummarySlot dayId="day-1" summaries={[approvedRow()]} approverName="Alex Reed" />
    );
    expect(screen.queryByText('Edited after approval')).not.toBeInTheDocument();
    unmount();

    render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[approvedRow({ updated_at: '2026-07-12T20:30:00Z' })]}
        approverName="Alex Reed"
      />
    );
    expect(screen.getByText('Edited after approval')).toBeInTheDocument();
  });

  it('state 5 (approved + draft): approved stays current; the draft reads as a revision in progress', () => {
    render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[
          makeSummary({ id: 'sum-draft', final_text: 'Newer draft wording.' }),
          approvedRow(),
        ]}
        approverName="Alex Reed"
      />
    );

    // The approved row is what the day still says.
    expect(summaryText().value).toBe('Approved wording.');
    expect(screen.getByText('Approved by Alex Reed · Jul 12, 2026')).toBeInTheDocument();

    const revision = screen.getByTestId('pending-draft');
    expect(revision).toHaveTextContent('Revision in progress');
    expect(revision).toHaveTextContent('Newer draft wording.');
    // The only Approve on the page promotes the REVISION, not the approved row.
    expect(revision).toContainElement(button('Approve'));
  });

  it('state 4 (generation failed): error + retry, and no summary row rendered', async () => {
    const fetchMock = stubFetch(500);
    render(<DaySummarySlot dayId="day-1" summaries={[]} />);

    fireEvent.click(button('Generate day summary'));
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent('Could not generate a day summary.');
    expect(screen.queryByLabelText('Day summary')).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();

    fireEvent.click(button('Retry'));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][0]).toBe('/api/days/day-1/summary');
  });

  it('a failed regenerate leaves the existing row rendered', async () => {
    stubFetch(500);
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.click(button('Regenerate'));
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent('Could not generate a day summary.');
    expect(summaryText().value).toBe('Session 2 was the day’s tidiest.');
  });

  it('autosave PATCHes finalText, debounced', async () => {
    const fetchMock = stubFetch();
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'Coach-tightened wording.' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/day-summaries/sum-1');
    expect(method).toBe('PATCH');
    expect(body).toEqual({ finalText: 'Coach-tightened wording.' });

    await act(async () => {});
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('blur flushes a pending edit, and unmount flushes one too', async () => {
    const fetchMock = stubFetch();
    const { unmount } = render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'blurred edit' } });
    fireEvent.blur(summaryText());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls(fetchMock)[0][2]).toEqual({ finalText: 'blurred edit' });
    await act(async () => {});

    fireEvent.change(summaryText(), { target: { value: 'edit before navigating' } });
    unmount();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][2]).toEqual({ finalText: 'edit before navigating' });
    await act(async () => {});
  });

  it('approve sends no text payload, and refreshes on success', async () => {
    const fetchMock = stubFetch();
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.click(button('Approve'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/day-summaries/sum-1/approve');
    expect(method).toBe('POST');
    // The text is already stored; carrying it here would race the PATCH.
    expect(body).toBeNull();

    await act(async () => {});
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('approve is serialized behind a pending edit: the PATCH goes first', async () => {
    let resolvePatch!: (response: unknown) => void;
    const ok = { ok: true, status: 200, json: async () => ({}) };
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePatch = resolve;
          })
      )
      .mockImplementation(async () => ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    // Typing, then Approve inside the debounce window — the ordinary way this
    // control is used. The edit must reach the DB BEFORE the approval, or
    // set_updated_at pushes updated_at past approved_at and the "Edited after
    // approval" chip lights with no coach edit after approval at all.
    fireEvent.change(summaryText(), { target: { value: 'last-second tightening' } });
    fireEvent.click(button('Approve'));

    // The click flushed the debounce: the PATCH is on the wire, alone.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls(fetchMock)[0][0]).toBe('/api/day-summaries/sum-1');
    expect(calls(fetchMock)[0][1]).toBe('PATCH');

    await act(async () => {
      resolvePatch(ok);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][0]).toBe('/api/day-summaries/sum-1/approve');
    expect(calls(fetchMock)[1][1]).toBe('POST');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('an approve queued behind an edit keeps its place — the edit is not coalesced away', async () => {
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

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    // A first PATCH occupies the wire.
    fireEvent.change(summaryText(), { target: { value: 'first' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A second edit and then Approve both queue. "Latest wins" applies only
    // between texts: the approval must not jump ahead of the edit it followed.
    fireEvent.change(summaryText(), { target: { value: 'second' } });
    fireEvent.click(button('Approve'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(ok);
    });

    // The queue drains in order: the second edit, THEN the approval.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls(fetchMock)[1][0]).toBe('/api/day-summaries/sum-1');
    expect(calls(fetchMock)[1][2]).toEqual({ finalText: 'second' });
    expect(calls(fetchMock)[2][0]).toBe('/api/day-summaries/sum-1/approve');
  });

  it('serializes overlapping edits: later edits queue and only the latest is sent', async () => {
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

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'A' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(summaryText(), { target: { value: 'AB' } });
    fireEvent.blur(summaryText());
    fireEvent.change(summaryText(), { target: { value: 'ABC' } });
    fireEvent.blur(summaryText());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(ok);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][2]).toEqual({ finalText: 'ABC' });
  });

  it('409 from the autosave PATCH renders the replaced message and a Refresh', async () => {
    stubFetch(409);
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'edit from a stale tab' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});

    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();
    // The control area is gone: nothing here can be approved or re-saved.
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();

    fireEvent.click(button('Refresh'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('409 from approve renders the replaced message', async () => {
    stubFetch(409);
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.click(button('Approve'));
    await act(async () => {});

    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('a failed save surfaces retry, and the retry re-sends the same payload', async () => {
    const fetchMock = stubFetch(500);
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'important edit' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByText('Failed to save')).toBeInTheDocument();
    // A 500 is not a 409: no replaced message, and the controls stay.
    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();

    fireEvent.click(button('Retry'));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][2]).toEqual({ finalText: 'important edit' });
  });

  it('re-seeds the textarea when a regeneration makes a different row current', () => {
    const { rerender } = render(
      <DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />
    );
    expect(summaryText().value).toBe('Session 2 was the day’s tidiest.');

    // What router.refresh() delivers after a regenerate: a new row, the old
    // one superseded and therefore invisible to daySummaryView.
    rerender(
      <DaySummarySlot
        dayId="day-1"
        summaries={[makeSummary({ id: 'sum-2', final_text: 'A fresh generation.' })]}
      />
    );
    expect(summaryText().value).toBe('A fresh generation.');
  });
});
