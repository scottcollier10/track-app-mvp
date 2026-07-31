/**
 * @jest-environment jsdom
 *
 * The debrief sheet is where a coach WRITES during a track day, so the things
 * under test are the ones that corrupt data or mislead silently:
 *
 *  - A judgment-only tap must send a body with NO note key at all. The
 *    assessments route preserves the stored note only when the key is absent —
 *    sending `note: null` (the obvious accident) actively erases it, and
 *    nothing looks wrong on screen.
 *  - The delta block's baseline comes from deltaBaselineIndex and is NAMED, and
 *    its two empty states are different claims: "first session" vs "every
 *    earlier session was excluded".
 *  - An identical best lap is a delta of 0.000s, never an absent comparison.
 *  - A failed write must surface as failed with a retry, not dissolve.
 *
 * Lap fixtures reuse the strip test's hand-checkable pairs:
 *   [91000, 92000] x3 -> σ 0.5477s (renders ±0.5s)
 *   [90500] x6        -> σ 0.0s
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DebriefSheet, { type DebriefSession } from '../DebriefSheet';
import type { FocusItemWithAssessments } from '@/lib/types';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const WOBBLY = [91000, 92000, 91000, 92000, 91000, 92000]; // σ 0.5s
const FLAT = [90500, 90500, 90500, 90500, 90500, 90500]; // σ 0.0s

function makeSession(
  id: string,
  bestLapMs: number | null,
  lapTimesMs: number[],
  overrides: Partial<DebriefSession> = {},
  sectorData?: Array<Record<string, number>>
): DebriefSession {
  return {
    id,
    best_lap_ms: bestLapMs,
    date: '2026-07-28T14:00:00Z',
    driver_id: 'driver-1',
    track_id: 'track-1',
    track_day_id: 'day-1',
    total_time_ms: lapTimesMs.reduce((s, t) => s + t, 0),
    ai_coaching_summary: null,
    coach_notes: null,
    created_at: null,
    notes: null,
    representativeness: null,
    representativeness_note: null,
    source: 'csv',
    laps: lapTimesMs.map((lap_time_ms, i) => ({
      lap_number: i + 1,
      lap_time_ms,
      sector_data: sectorData?.[i] ?? null,
    })),
    ...overrides,
  };
}

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
    // Well before the day, so the date fallback keeps the item in play.
    created_at: '2026-07-01T12:00:00Z',
    created_after_session_id: null,
    updated_at: '2026-07-01T12:00:00Z',
    focus_item_assessments: [],
    ...overrides,
  };
}

/** Two-session day: S1 at 14:00, S2 at 16:00 — the sheet opens on S2 by default. */
function twoSessionDay(
  s1Overrides: Partial<DebriefSession> = {},
  s2Overrides: Partial<DebriefSession> = {}
): DebriefSession[] {
  return [
    makeSession('s-1', 92500, WOBBLY, { date: '2026-07-28T14:00:00Z', ...s1Overrides }),
    makeSession('s-2', 91000, FLAT, { date: '2026-07-28T16:00:00Z', ...s2Overrides }),
  ];
}

interface SheetOverrides {
  sessions?: DebriefSession[];
  index?: number;
  focusItems?: FocusItemWithAssessments[];
  onClose?: () => void;
}

function renderSheet(overrides: SheetOverrides = {}) {
  return render(
    <DebriefSheet
      driverId="driver-1"
      sessions={overrides.sessions ?? twoSessionDay()}
      index={overrides.index ?? 1}
      dayDate="2026-07-28"
      trackTimezone={null}
      focusItems={overrides.focusItems ?? []}
      originSessions={[]}
      onClose={overrides.onClose ?? jest.fn()}
    />
  );
}

/** Every /api call the sheet made, as [url, method, parsed body] triples. */
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

describe('DebriefSheet zones', () => {
  it('renders all four zones: context flags, comparison, assess, add', () => {
    renderSheet({ focusItems: [makeItem('item-1', 'Brake later into T5')] });

    // 1. Context chips — the three flags.
    expect(screen.getByRole('button', { name: 'Representative' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not representative' })).toBeInTheDocument();

    // 2. Comparison, with a NAMED baseline.
    expect(screen.getByTestId('delta-baseline')).toHaveTextContent('vs Session 1');

    // 3. Assess — the item's text and all four judgment buttons.
    expect(screen.getByText('Brake later into T5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep working' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regressed' })).toBeInTheDocument();

    // 4. Add focus item.
    expect(screen.getByRole('button', { name: 'Add focus item' })).toBeInTheDocument();
  });
});

describe('DebriefSheet delta block', () => {
  it('says "first session of the day" on session 1, not the excluded-baseline message', () => {
    renderSheet({ index: 0 });

    expect(
      screen.getByText('No comparison baseline yet — first session of the day')
    ).toBeInTheDocument();
    expect(screen.queryByText('— no earlier representative session')).not.toBeInTheDocument();
  });

  it('says "no earlier representative session" when every earlier session is excluded', () => {
    renderSheet({
      sessions: twoSessionDay({ representativeness: 'not_representative' }),
      index: 1,
    });

    expect(screen.getByText('— no earlier representative session')).toBeInTheDocument();
    expect(screen.queryByTestId('delta-baseline')).not.toBeInTheDocument();
  });

  it('propagates a partial baseline into the name, note included', () => {
    renderSheet({
      sessions: twoSessionDay({
        representativeness: 'partial',
        representativeness_note: 'Red flag on lap 4',
      }),
      index: 1,
    });

    expect(screen.getByTestId('delta-baseline')).toHaveTextContent(
      'vs Session 1 · partial — Red flag on lap 4'
    );
  });

  it('renders best-lap, σ deltas and lap counts against the named baseline', () => {
    renderSheet({ index: 1 });

    expect(screen.getByTestId('delta-best-lap')).toHaveTextContent('-1.500s'); // 91000 - 92500
    expect(screen.getByTestId('delta-sigma')).toHaveTextContent('-0.5s'); // 0.0 - 0.5
    expect(screen.getByTestId('delta-laps')).toHaveTextContent('6 laps vs 6 laps');
  });

  it('renders an identical best lap as 0.000s, never as an absent comparison', () => {
    renderSheet({
      sessions: [
        makeSession('s-1', 91000, WOBBLY, { date: '2026-07-28T14:00:00Z' }),
        makeSession('s-2', 91000, FLAT, { date: '2026-07-28T16:00:00Z' }),
      ],
      index: 1,
    });

    expect(screen.getByTestId('delta-best-lap')).toHaveTextContent('0.000s');
    expect(screen.getByTestId('delta-best-lap')).not.toHaveTextContent('--');
    // A tie is not a loss: no + sign either.
    expect(screen.getByTestId('delta-best-lap')).not.toHaveTextContent('+');
  });

  it('shows an ideal-lap Δ only when BOTH sessions carry sector data', () => {
    // Baseline ideal: 29000 + 31000 = 60000. Current ideal: 28000 + 31000 = 59000.
    const baselineSectors = WOBBLY.map((_, i) =>
      i % 2 === 0 ? { s1: 30000, s2: 31000 } : { s1: 29000, s2: 32000 }
    );
    const currentSectors = FLAT.map(() => ({ s1: 28000, s2: 31000 }));

    const { unmount } = render(
      <DebriefSheet
        driverId="driver-1"
        sessions={[
          makeSession('s-1', 92500, WOBBLY, { date: '2026-07-28T14:00:00Z' }, baselineSectors),
          makeSession('s-2', 91000, FLAT, { date: '2026-07-28T16:00:00Z' }, currentSectors),
        ]}
        index={1}
        dayDate="2026-07-28"
        trackTimezone={null}
        focusItems={[]}
        originSessions={[]}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('delta-ideal')).toHaveTextContent('ideal-lap Δ');
    expect(screen.getByTestId('delta-ideal')).toHaveTextContent('-1.000s');
    unmount();

    // Only ONE side has sectors: no ideal-lap comparison exists to print.
    renderSheet({
      sessions: [
        makeSession('s-1', 92500, WOBBLY, { date: '2026-07-28T14:00:00Z' }, baselineSectors),
        makeSession('s-2', 91000, FLAT, { date: '2026-07-28T16:00:00Z' }),
      ],
      index: 1,
    });
    expect(screen.queryByTestId('delta-ideal')).not.toBeInTheDocument();
  });
});

describe('DebriefSheet assessments', () => {
  it('sends a judgment-only tap with NO note key, then refreshes', async () => {
    const fetchMock = stubFetch();
    renderSheet({ focusItems: [makeItem('item-1', 'Brake later into T5')] });

    fireEvent.click(screen.getByRole('button', { name: 'Improved' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/focus-items/item-1/assessments');
    expect(method).toBe('PUT');
    expect(body).toEqual({ sessionId: 's-2', judgment: 'improved' });
    // The load-bearing assertion: the KEY is absent, not merely null. The route
    // preserves the stored note only for an absent key; null erases it.
    expect(Object.prototype.hasOwnProperty.call(body, 'note')).toBe(false);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('shows the stored judgment on a reviewed item, still tappable to correct', () => {
    renderSheet({
      focusItems: [
        makeItem('item-1', 'Brake later into T5', {
          focus_item_assessments: [
            {
              id: 'a-1',
              focus_item_id: 'item-1',
              session_id: 's-2',
              judgment: 'keep_working',
              note: null,
              created_at: '2026-07-28T17:00:00Z',
              updated_at: '2026-07-28T17:00:00Z',
            },
          ],
        }),
      ],
    });

    expect(screen.getByRole('button', { name: 'Keep working' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Improved' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('sends the note WITH the current judgment only when the coach edited it', async () => {
    const fetchMock = stubFetch();
    renderSheet({
      focusItems: [
        makeItem('item-1', 'Brake later into T5', {
          focus_item_assessments: [
            {
              id: 'a-1',
              focus_item_id: 'item-1',
              session_id: 's-2',
              judgment: 'keep_working',
              note: null,
              created_at: '2026-07-28T17:00:00Z',
              updated_at: '2026-07-28T17:00:00Z',
            },
          ],
        }),
      ],
    });

    // Unedited note: the save control is not armed.
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Assessment note'), {
      target: { value: 'Still early on entry' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, , body] = calls(fetchMock)[0];
    expect(body).toEqual({
      sessionId: 's-2',
      judgment: 'keep_working',
      note: 'Still early on entry',
    });
  });

  it('surfaces a failed write with a retry that re-sends it', async () => {
    const fetchMock = stubFetch(500);
    renderSheet({ focusItems: [makeItem('item-1', 'Brake later into T5')] });

    fireEvent.click(screen.getByRole('button', { name: 'Improved' }));

    await waitFor(() => expect(screen.getByText('Failed to save')).toBeInTheDocument());
    expect(mockRefresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The retry re-sends the SAME judgment-only body — still no note key.
    const [, , body] = calls(fetchMock)[1];
    expect(body).toEqual({ sessionId: 's-2', judgment: 'improved' });
  });
});

describe('DebriefSheet add focus item', () => {
  it('creates the item anchored to THIS session, then clears and refreshes', async () => {
    const fetchMock = stubFetch(201);
    renderSheet({});

    const input = screen.getByLabelText('New focus item');
    fireEvent.change(input, { target: { value: 'Look further ahead in the esses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add focus item' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, method, body] = calls(fetchMock)[0];
    expect(url).toBe('/api/focus-items');
    expect(method).toBe('POST');
    expect(body).toEqual({
      driverId: 'driver-1',
      text: 'Look further ahead in the esses',
      createdAfterSessionId: 's-2',
    });

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect((input as HTMLInputElement).value).toBe('');
  });
});
