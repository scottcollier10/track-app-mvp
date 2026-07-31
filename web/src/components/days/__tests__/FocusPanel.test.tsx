/**
 * @jest-environment jsdom
 *
 * The focus panel is the day page's read/manage surface for the coaching loop.
 * What matters here:
 *
 *  - It makes NO assessment writes. Status transitions PATCH the item only;
 *    assessments belong to the debrief sheet. A test pins that no request ever
 *    touches an assessments URL.
 *  - The three groups come from focusPanelGroups (the lib), including the
 *    INTENDED GAP: a dropped item with no same-day assessment shows only under
 *    Paused/inactive — never under Resolved this day.
 *  - Origin labels are read off the origin session's DAY, never inferred:
 *    a null origin says "added outside a session", a resolvable one names the
 *    track and plain calendar date, an unresolvable one says nothing.
 *  - "Add focus item" here sends NO createdAfterSessionId — the panel is not
 *    session-anchored, and pinning "latest" silently is the dishonesty the
 *    design doc rejected.
 *  - Every write renders pending/failed/retry (useControlWrite idiom).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import FocusPanel from '../FocusPanel';
import type { FocusItemWithAssessments, FocusOriginSession } from '@/lib/types';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function makeItem(
  id: string,
  text: string,
  overrides: Partial<FocusItemWithAssessments> = {}
): FocusItemWithAssessments {
  return {
    id,
    driver_id: 'driver-1',
    text,
    status: 'active',
    created_at: '2026-07-01T12:00:00Z',
    created_after_session_id: null,
    updated_at: '2026-07-01T12:00:00Z',
    focus_item_assessments: [],
    ...overrides,
  };
}

function makeAssessment(
  id: string,
  focusItemId: string,
  sessionId: string,
  judgment: string
) {
  return {
    id,
    focus_item_id: focusItemId,
    session_id: sessionId,
    judgment,
    note: null,
    created_at: '2026-07-12T17:00:00Z',
    updated_at: '2026-07-12T17:00:00Z',
  };
}

/** An origin session with its day resolved — the label's whole source. */
function makeOrigin(id: string, date: string, dayDate: string, trackName: string): FocusOriginSession {
  return { id, date, track_day: { date: dayDate, track: { name: trackName } } };
}

interface PanelOverrides {
  focusItems?: FocusItemWithAssessments[];
  originSessions?: FocusOriginSession[];
  assessmentSessions?: Array<{ id: string; date: string }>;
  daySessionIds?: string[];
}

function renderPanel(overrides: PanelOverrides = {}) {
  return render(
    <FocusPanel
      driverId="driver-1"
      daySessionIds={overrides.daySessionIds ?? ['s1', 's2']}
      focusItems={overrides.focusItems ?? []}
      originSessions={overrides.originSessions ?? []}
      assessmentSessions={overrides.assessmentSessions ?? []}
    />
  );
}

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
  stubFetch();
});

const active = () => screen.getByTestId('focus-active');
const inactive = () => screen.getByTestId('focus-inactive');

describe('FocusPanel groups', () => {
  it('renders active items under Active with their text', () => {
    renderPanel({ focusItems: [makeItem('fi-1', 'Brake later into T5')] });

    expect(within(active()).getByText('Brake later into T5')).toBeInTheDocument();
    expect(screen.queryByTestId('focus-resolved')).not.toBeInTheDocument();
  });

  it('renders achieved items with same-day evidence under Resolved this day', () => {
    renderPanel({
      focusItems: [
        makeItem('fi-1', 'Smooth throttle out of T3', {
          status: 'achieved',
          focus_item_assessments: [makeAssessment('a-1', 'fi-1', 's2', 'improved')],
        }),
      ],
      assessmentSessions: [{ id: 's2', date: '2026-07-12T20:00:00Z' }],
    });

    const resolved = screen.getByTestId('focus-resolved');
    expect(within(resolved).getByText('Smooth throttle out of T3')).toBeInTheDocument();
    expect(within(resolved).getByText(/Achieved/)).toBeInTheDocument();
  });

  it('INTENDED GAP: a dropped item with no same-day assessment appears ONLY under Paused/inactive', () => {
    // Dropped via the panel, never assessed on this day's sessions: no
    // same-day evidence exists, so "Resolved this day" honestly omits it. It
    // must still be findable — that is the Paused/inactive group's whole job.
    renderPanel({
      focusItems: [makeItem('fi-1', 'Trail brake into T9', { status: 'dropped' })],
    });

    expect(screen.queryByTestId('focus-resolved')).not.toBeInTheDocument();
    // Collapsed by default: findable behind the disclosure, not hidden forever.
    expect(screen.queryByText('Trail brake into T9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Paused \/ inactive/ }));
    expect(within(inactive()).getByText('Trail brake into T9')).toBeInTheDocument();
  });

  it('Paused/inactive is driver-scoped: a long-ago paused item is reachable and reactivatable', async () => {
    const fetchMock = stubFetch();
    renderPanel({
      focusItems: [
        makeItem('fi-old', 'Heel-toe downshifts', {
          status: 'paused',
          created_at: '2026-05-01T12:00:00Z',
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /Paused \/ inactive/ }));
    fireEvent.click(within(inactive()).getByRole('button', { name: 'Reactivate' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/focus-items/fi-old');
    expect(method).toBe('PATCH');
    expect(body).toEqual({ status: 'active' });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});

describe('FocusPanel origin labels', () => {
  it('names the origin session\'s track and plain calendar date', () => {
    renderPanel({
      focusItems: [
        makeItem('fi-1', 'Brake later into T5', { created_after_session_id: 's-prev' }),
      ],
      originSessions: [makeOrigin('s-prev', '2026-06-14T19:00:00Z', '2026-06-14', 'Sonoma')],
    });

    expect(within(active()).getByText('from Sonoma, Jun 14, 2026')).toBeInTheDocument();
  });

  it('says "added outside a session" for a null origin — never infers one', () => {
    renderPanel({ focusItems: [makeItem('fi-1', 'Brake later into T5')] });

    expect(within(active()).getByText('added outside a session')).toBeInTheDocument();
  });

  it('says nothing when the origin cannot be resolved, rather than guessing', () => {
    // A non-null origin id whose session/day did not resolve: no label at all.
    // "added outside a session" would be a lie (it WAS added after one), and a
    // derived date would be an inference the design doc forbids.
    renderPanel({
      focusItems: [makeItem('fi-1', 'Brake later into T5', { created_after_session_id: 's-gone' })],
    });

    expect(screen.queryByText(/^from /)).not.toBeInTheDocument();
    expect(screen.queryByText('added outside a session')).not.toBeInTheDocument();
  });
});

describe('FocusPanel judgment timeline', () => {
  it('renders judgment markers in session-start order, not assessment row order', () => {
    renderPanel({
      focusItems: [
        makeItem('fi-1', 'Brake later into T5', {
          focus_item_assessments: [
            makeAssessment('a-2', 'fi-1', 's-later', 'improved'),
            makeAssessment('a-1', 'fi-1', 's-earlier', 'keep_working'),
          ],
        }),
      ],
      assessmentSessions: [
        { id: 's-later', date: '2026-07-12T20:00:00Z' },
        { id: 's-earlier', date: '2026-07-05T15:00:00Z' },
      ],
    });

    const timeline = within(active()).getByTestId('judgment-timeline');
    expect(
      within(timeline)
        .getAllByRole('img')
        .map((marker) => marker.getAttribute('aria-label'))
    ).toEqual(['Keep working', 'Improved']);
  });
});

describe('FocusPanel status writes', () => {
  it.each([
    ['Pause', 'paused'],
    ['Drop', 'dropped'],
    ['Achieve', 'achieved'],
  ])('%s PATCHes the item status — no session anchor, no assessment write', async (label, status) => {
    const fetchMock = stubFetch();
    renderPanel({ focusItems: [makeItem('fi-1', 'Brake later into T5')] });

    fireEvent.click(within(active()).getByRole('button', { name: label }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/focus-items/fi-1');
    expect(method).toBe('PATCH');
    expect(body).toEqual({ status });
    // The panel is read/manage ONLY: nothing it does may touch assessments.
    expect(url).not.toContain('assessments');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('surfaces a failed status write with a retry that re-sends it', async () => {
    const fetchMock = stubFetch(500);
    renderPanel({ focusItems: [makeItem('fi-1', 'Brake later into T5')] });

    fireEvent.click(within(active()).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(screen.getByText('Failed to save')).toBeInTheDocument());
    expect(mockRefresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, , body] = calls(fetchMock)[1];
    expect(body).toEqual({ status: 'paused' });
  });
});

describe('FocusPanel add item', () => {
  it('POSTs with NO createdAfterSessionId key — origin honestly unknown', async () => {
    const fetchMock = stubFetch(201);
    renderPanel({});

    const input = screen.getByLabelText('New focus item');
    fireEvent.change(input, { target: { value: 'Look through the corner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add focus item' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/focus-items');
    expect(method).toBe('POST');
    expect(body).toEqual({ driverId: 'driver-1', text: 'Look through the corner' });
    // The KEY is absent, not null: the panel has no session to anchor to, and
    // silently pinning "latest" is the inference the design doc rejects.
    expect(Object.prototype.hasOwnProperty.call(body, 'createdAfterSessionId')).toBe(false);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect((input as HTMLInputElement).value).toBe('');
  });
});
