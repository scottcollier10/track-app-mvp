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
 *    An approval of the SAME ROW behind a write that FAILED is dropped, for the
 *    same reason read the other way: approval publishes the row's stored text,
 *    so it must never follow an edit to that row that did not land. Everything
 *    else in the queue still drains, and in that order — a queued edit held
 *    back would land after the next edit typed and overwrite it.
 *  - A 409 from any write is the stale-tab case: the coach sees
 *    SUMMARY_REPLACED's message and a Refresh, never a generic save error. That
 *    message is always escapable — by a new current row, and by the Refresh
 *    itself, which matters because approving a draft does not change its id.
 *    Both exits forget the failed write, or the exit hands back the generic
 *    save error the banner was shown instead of.
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
      <DaySummarySlot
        dayId="day-1"
        summaries={[approvedRow()]}
        approverName="Alex Reed"
        coachId="coach-1"
      />
    );

    expect(summaryText().value).toBe('Approved wording.');
    expect(screen.getByText('Approved by Alex Reed · Jul 12, 2026')).toBeInTheDocument();
    expect(screen.queryByText('AI draft — not approved')).not.toBeInTheDocument();
    // Already approved: nothing left to approve, but a rewrite is available.
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(button('Regenerate')).toBeInTheDocument();
  });

  it('state 3: the name is only used when it belongs to the row’s approver', () => {
    // The row was approved by somebody else — a driver reassigned between
    // coaches, or a seeded row that named its own approver. The signed-in
    // coach's name here would be a confident lie about who signed off.
    const { unmount } = render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[approvedRow({ approved_by: 'coach-2' })]}
        approverName="Alex Reed"
        coachId="coach-1"
      />
    );
    expect(screen.getByText('Approved · Jul 12, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Alex Reed/)).not.toBeInTheDocument();
    unmount();

    // No id to compare against degrades the same way, never to a guess.
    render(
      <DaySummarySlot dayId="day-1" summaries={[approvedRow()]} approverName="Alex Reed" />
    );
    expect(screen.getByText('Approved · Jul 12, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Alex Reed/)).not.toBeInTheDocument();
  });

  it('state 3 chip: "Edited after approval" iff editedAfterApproval(row)', () => {
    // Freshly approved: the DB stamps both instants from the same now().
    const { unmount } = render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[approvedRow()]}
        approverName="Alex Reed"
        coachId="coach-1"
      />
    );
    expect(screen.queryByText('Edited after approval')).not.toBeInTheDocument();
    unmount();

    render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[approvedRow({ updated_at: '2026-07-12T20:30:00Z' })]}
        approverName="Alex Reed"
        coachId="coach-1"
      />
    );
    expect(screen.getByText('Edited after approval')).toBeInTheDocument();
  });

  it('state 5 (approved + draft): approved stays current; the draft reads as a revision in progress', async () => {
    const fetchMock = stubFetch();
    render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[
          makeSummary({ id: 'sum-draft', final_text: 'Newer draft wording.' }),
          approvedRow(),
        ]}
        approverName="Alex Reed"
        coachId="coach-1"
      />
    );

    // The approved row is what the day still says.
    expect(summaryText().value).toBe('Approved wording.');
    expect(screen.getByText('Approved by Alex Reed · Jul 12, 2026')).toBeInTheDocument();

    const revision = screen.getByTestId('pending-draft');
    expect(revision).toHaveTextContent('Revision in progress');
    expect(revision).toHaveTextContent('Newer draft wording.');
    // The only Approve on the page promotes the REVISION, not the approved row.
    // Where it sits is presentation; which row it POSTs to is the behaviour —
    // approving `current` here would re-approve the already-approved row and
    // leave the revision pending forever.
    expect(revision).toContainElement(button('Approve'));
    fireEvent.click(button('Approve'));
    expect(calls(fetchMock)[0][0]).toBe('/api/day-summaries/sum-draft/approve');
    await act(async () => {});
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

  it('a FAILED edit keeps the queue draining, so a stale edit never lands after a newer one', async () => {
    const ok = { ok: true, status: 200, json: async () => ({}) };
    let failFirst!: () => void;
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            failFirst = () => resolve({ ok: false, status: 500, json: async () => ({}) });
          })
      )
      .mockImplementation(async () => ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    // "A" occupies the wire; "AB" waits behind it.
    fireEvent.change(summaryText(), { target: { value: 'A' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    fireEvent.change(summaryText(), { target: { value: 'AB' } });
    fireEvent.blur(summaryText());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      failFirst();
    });

    // A lost write cancels the approvals behind it and NOTHING else. Holding
    // the queued edit back instead would leave it parked with the wire idle...
    const bodies = () => calls(fetchMock).map(([, , body]) => body?.finalText);
    expect(bodies()).toEqual(['A', 'AB']);

    // ...and this newer edit would then go out first and be overwritten by that
    // stale one whenever the queue next moved — the coach's latest wording lost
    // to the failure path, which is the whole reason writes are serialized.
    fireEvent.change(summaryText(), { target: { value: 'ABC' } });
    fireEvent.blur(summaryText());
    await act(async () => {});

    expect(bodies()).toEqual(['A', 'AB', 'ABC']);
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
    // And neither can it be typed into: every keystroke would debounce into
    // another PATCH against the same superseded row.
    expect(summaryText()).toBeDisabled();
    // The autosave indicator goes with them. It would be reporting on a write
    // that can never succeed, next to a message that says exactly that.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(button('Refresh'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('409 from approve renders the replaced message, announced', async () => {
    stubFetch(409);
    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.click(button('Approve'));
    await act(async () => {});

    // It arrives asynchronously and removes every control on the card, so it is
    // announced — the generation failure below it already is.
    expect(screen.getByRole('alert')).toHaveTextContent(SUMMARY_REPLACED.message);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('an impatient second Approve click sends no second approval', async () => {
    let resolveApprove!: (response: unknown) => void;
    const ok = { ok: true, status: 200, json: async () => ({}) };
    // The first approval is still on the wire. Anything that approves sum-1
    // after it is approving an already-approved row, and the write matrix
    // permits the approval fields to be written only at draft->approved — so
    // the route answers 409 and the coach gets the stale-tab banner over a
    // summary that approved perfectly well.
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveApprove = resolve;
          })
      )
      .mockImplementation(async () => ({
        ok: false,
        status: 409,
        json: async () => SUMMARY_REPLACED,
      }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.click(button('Approve'));
    fireEvent.click(button('Approve'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveApprove(ok);
    });

    // Nothing was waiting behind the first: the duplicate never joined the queue.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('a second Approve click while the first waits in the queue sends no second approval', async () => {
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

    // The click flushes the edit and queues the approval behind it, so the
    // duplicate arrives while the first approval is still waiting its turn.
    fireEvent.change(summaryText(), { target: { value: 'last-second tightening' } });
    fireEvent.click(button('Approve'));
    fireEvent.click(button('Approve'));

    await act(async () => {
      resolvePatch(ok);
    });

    expect(calls(fetchMock).map(([url]) => url)).toEqual([
      '/api/day-summaries/sum-1',
      '/api/day-summaries/sum-1/approve',
    ]);
  });

  it('an approve behind a FAILED edit never fires, and retry re-sends the lost edit', async () => {
    // The PATCH fails; the approval behind it would succeed. It must not run:
    // approval publishes the text the ROW holds, so it would publish the
    // pre-edit wording while the screen reports a save that never happened.
    const fetchMock = jest.fn(async (input: RequestInfo) =>
      String(input) === '/api/day-summaries/sum-1'
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({}) }
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    // Typing, then Approve inside the debounce window: the click flushes the
    // edit and queues the approval behind it.
    fireEvent.change(summaryText(), { target: { value: 'the wording that must be published' } });
    fireEvent.click(button('Approve'));
    await act(async () => {});

    expect(calls(fetchMock).map(([url]) => url)).toEqual(['/api/day-summaries/sum-1']);
    expect(mockRefresh).not.toHaveBeenCalled();
    // The failure is what the coach is told about — not a "Saved" borrowed from
    // the approval that followed it.
    expect(screen.getByText('Failed to save')).toBeInTheDocument();

    // And retry still means the edit: the approval did not steal `lastSent`.
    fireEvent.click(button('Retry'));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls(fetchMock)[1][0]).toBe('/api/day-summaries/sum-1');
    expect(calls(fetchMock)[1][2]).toEqual({ finalText: 'the wording that must be published' });
  });

  it('an edit that threw drops the approval behind it too', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo) => {
      if (String(input) === '/api/day-summaries/sum-1') throw new Error('offline');
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'edit from the paddock' } });
    fireEvent.click(button('Approve'));
    await act(async () => {});

    // A dropped connection loses the edit exactly as a 500 does — there is no
    // response to read `ok` from at all, and the approval must not read that
    // silence as permission to publish the pre-edit wording.
    expect(calls(fetchMock).map(([url]) => url)).toEqual(['/api/day-summaries/sum-1']);
    expect(screen.getByText('Failed to save')).toBeInTheDocument();
  });

  it('state 5: a failed edit to the approved row leaves the REVISION’s approval standing', async () => {
    // The drop is scoped to the failed write's own row, because the argument
    // for it is: approval publishes the text the ROW holds. Here the textarea
    // edits the approved row while the only Approve on screen promotes the
    // revision — a row whose text this failure never touched. Dropping that
    // click would cancel the coach's approval with nothing but a shared
    // "Failed to save" to account for it.
    const fetchMock = jest.fn(async (input: RequestInfo) =>
      String(input) === '/api/day-summaries/sum-approved'
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({}) }
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <DaySummarySlot
        dayId="day-1"
        summaries={[
          makeSummary({ id: 'sum-draft', final_text: 'Newer draft wording.' }),
          approvedRow(),
        ]}
      />
    );

    fireEvent.change(summaryText(), { target: { value: 'a tweak to the approved wording' } });
    fireEvent.click(button('Approve'));
    await act(async () => {});

    expect(calls(fetchMock).map(([url]) => url)).toEqual([
      '/api/day-summaries/sum-approved',
      '/api/day-summaries/sum-draft/approve',
    ]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('Refresh clears the replaced message even when the rows come back identical', async () => {
    stubFetch(409);
    const rows = [makeSummary()];
    const { rerender } = render(<DaySummarySlot dayId="day-1" summaries={rows} />);

    fireEvent.click(button('Approve'));
    await act(async () => {});
    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();

    fireEvent.click(button('Refresh'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    // A draft that flips to approved KEEPS its id, so the refresh can deliver
    // the very same current row: the id-change reset never fires, and a button
    // that only asked the server would redraw the banner it claims to dismiss.
    rerender(<DaySummarySlot dayId="day-1" summaries={rows} />);

    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();
    expect(button('Approve')).toBeInTheDocument();
    expect(summaryText()).not.toBeDisabled();
  });

  it('Refresh forgets the write that 409’d — no Retry that would raise the banner again', async () => {
    stubFetch(409);
    const rows = [makeSummary()];
    const { rerender } = render(<DaySummarySlot dayId="day-1" summaries={rows} />);

    fireEvent.change(summaryText(), { target: { value: 'edit from a stale tab' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();

    fireEvent.click(button('Refresh'));
    rerender(<DaySummarySlot dayId="day-1" summaries={rows} />);

    // The banner hid an indicator that is still reporting the 409. Unhiding it
    // unchanged would offer the coach a Retry for the very request that raised
    // the banner: one click back to the message they just dismissed.
    expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a new current row clears the replaced message: it IS the refresh the message asked for', async () => {
    stubFetch(409);
    const { rerender } = render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'edit from a stale tab' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();

    // What the other tab wrote, arriving on the next server render.
    rerender(
      <DaySummarySlot
        dayId="day-1"
        summaries={[makeSummary({ id: 'sum-2', final_text: 'The other tab’s draft.' })]}
      />
    );

    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();
    expect(summaryText().value).toBe('The other tab’s draft.');
    expect(summaryText()).not.toBeDisabled();
    expect(button('Approve')).toBeInTheDocument();
  });

  it('a new current row forgets the failed write too: the Retry would address the old row', async () => {
    stubFetch(500);
    const { rerender } = render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'edit that did not land' } });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByText('Failed to save')).toBeInTheDocument();

    // A regenerate lands, so the row that edit was addressing is superseded.
    rerender(
      <DaySummarySlot
        dayId="day-1"
        summaries={[makeSummary({ id: 'sum-2', final_text: 'A fresh generation.' })]}
      />
    );

    // The textarea has been re-seeded from the new row, so Retry no longer
    // means what it says: it would PATCH sum-1 with words that are no longer on
    // screen, against a row the server will only answer 409 to.
    expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

  it('regenerating cancels the pending autosave while the textarea still has focus', async () => {
    const ok = { ok: true, status: 200, json: async () => ({}) };
    // Anything written against sum-1 AFTER the regenerate is writing to a
    // superseded row, which is exactly what the route answers 409 to.
    const fetchMock = jest.fn(async (input: RequestInfo) =>
      String(input) === '/api/day-summaries/sum-1'
        ? { ok: false, status: 409, json: async () => SUMMARY_REPLACED }
        : ok
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />
    );

    // Typing, then Regenerate inside the debounce window, with the textarea
    // never blurred — jsdom's click does not move focus. The browser's own
    // order is the test below.
    fireEvent.change(summaryText(), { target: { value: 'half-typed edit' } });
    fireEvent.click(button('Regenerate'));
    await act(async () => {});
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // What that refresh delivers: the regenerated row, the edited one
    // superseded and therefore invisible to daySummaryView.
    rerender(
      <DaySummarySlot
        dayId="day-1"
        summaries={[makeSummary({ id: 'sum-2', final_text: 'A fresh generation.' })]}
      />
    );

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS);
    });
    await act(async () => {});

    // No replaced message over the draft that IS current — a banner the coach
    // would have to dismiss for a write nobody asked for.
    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();
    expect(summaryText()).not.toBeDisabled();
    expect(button('Regenerate')).toBeInTheDocument();
    // Because the timer — whose closure still held sum-1 — never fired.
    expect(calls(fetchMock).map(([url]) => url)).toEqual(['/api/days/day-1/summary']);
  });

  it('with the browser’s blur-then-click order the flushed edit does go out, and its 409 clears', async () => {
    const ok = { ok: true, status: 200, json: async () => ({}) };
    const fetchMock = jest.fn(async (input: RequestInfo) =>
      String(input) === '/api/day-summaries/sum-1'
        ? { ok: false, status: 409, json: async () => SUMMARY_REPLACED }
        : ok
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(<DaySummarySlot dayId="day-1" summaries={[makeSummary()]} />);

    fireEvent.change(summaryText(), { target: { value: 'half-typed edit' } });
    // A real browser fires focusout before the click that caused it, so the
    // edit is already flushed by the time Regenerate runs. Cancelling the timer
    // cannot help here — there is no timer left to cancel.
    fireEvent.blur(summaryText());
    fireEvent.click(button('Regenerate'));
    await act(async () => {});

    // Both writes are on the wire: generation is deliberately off the write
    // queue, so the PATCH does not hold the generation up and is not held up.
    expect(calls(fetchMock).map(([url]) => url)).toEqual([
      '/api/day-summaries/sum-1',
      '/api/days/day-1/summary',
    ]);
    // Here the PATCH lost that race, so the banner is up over a draft that is
    // about to be replaced anyway.
    expect(screen.getByText(SUMMARY_REPLACED.message)).toBeInTheDocument();

    rerender(
      <DaySummarySlot
        dayId="day-1"
        summaries={[makeSummary({ id: 'sum-2', final_text: 'A fresh generation.' })]}
      />
    );

    // The regenerated row IS the refresh the message asked for. Had it landed
    // the other way round, Refresh clears the banner by itself.
    expect(screen.queryByText(SUMMARY_REPLACED.message)).not.toBeInTheDocument();
    expect(summaryText().value).toBe('A fresh generation.');
    expect(summaryText()).not.toBeDisabled();
  });
});
