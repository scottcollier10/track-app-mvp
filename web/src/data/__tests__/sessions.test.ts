/**
 * @jest-environment node
 *
 * Tests for getSessionWithLaps's day context — the "Session 2 of 4" header and
 * its prev/next nav.
 *
 * The invariant worth a test file is ONE number: N. A coach clicks "Session 3"
 * on the day page and must land on a page that calls itself Session 3. If the
 * two views ever number the same day differently, nothing errors, nothing looks
 * broken, and the coach is simply looking at the wrong session.
 *
 * So @/lib/supabase/server is mocked, but @/data/track-days is NOT: these tests
 * run the REAL getTrackDayWithSessions and the REAL bySessionStart against the
 * same day row the day page would receive, and assert the session page's index
 * equals the day page's index for every session — including the tied-timestamp
 * case bySessionStart's id tiebreak exists for.
 */

import { getSessionWithLaps } from '../sessions';
import { getTrackDayWithSessions } from '../track-days';
import { createServerSupabase } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;

/** Tables touched by the last call, in order. Proves what was (and wasn't) fetched. */
let tablesQueried: string[];

/** What the stubbed sessions `.single()` resolves with. Set per test. */
let sessionResult: { data: unknown; error: unknown };

/** What the stubbed track_days `.maybeSingle()` resolves with. Set per test. */
let dayResult: { data: unknown; error: unknown };

function makeSessionRow(id: string, date: string, trackDayId: string | null) {
  return {
    id,
    date,
    total_time_ms: 1200000,
    best_lap_ms: 91000,
    coach_notes: null,
    ai_coaching_summary: null,
    source: 'csv',
    track_day_id: trackDayId,
    driver: { id: 'driver-1', name: 'Dana Reyes', email: 'dana@example.com' },
    track: {
      id: 'track-1',
      name: 'Road America',
      location: 'Elkhart Lake, WI',
      length_meters: 6515,
      config: null,
    },
  };
}

/** The shape getTrackDayWithSessions's embed produces for one session. */
function makeDaySessionRow(id: string, date: string) {
  return {
    id,
    date,
    driver_id: 'driver-1',
    track_id: 'track-1',
    track_day_id: 'day-1',
    best_lap_ms: 91000,
    total_time_ms: 1200000,
    ai_coaching_summary: null,
    coach_notes: null,
    created_at: null,
    notes: null,
    representativeness: null,
    representativeness_note: null,
    source: 'csv',
    laps: [{ lap_number: 1, lap_time_ms: 91000 }],
  };
}

function makeDayRow(sessions: ReturnType<typeof makeDaySessionRow>[]) {
  return {
    id: 'day-1',
    driver_id: 'driver-1',
    track_id: 'track-1',
    // A PLAIN track-local calendar date. The back-link label formats this with
    // formatTrackDate; jest pins TZ=America/Chicago so a formatDate slip here
    // would print Jul 11.
    date: '2026-07-12',
    created_at: '2026-07-12T00:00:00Z',
    driver: { id: 'driver-1', name: 'Dana Reyes', email: 'dana@example.com' },
    track: { id: 'track-1', name: 'Road America', location: 'Elkhart Lake, WI' },
    sessions,
  };
}

/**
 * A realistic four-session HPDE day, handed over in an order the database is
 * under no obligation to make chronological — so a missing sort shows up.
 */
const FOUR_SESSION_DAY = [
  makeDaySessionRow('s-c', '2026-07-12T18:00:00Z'),
  makeDaySessionRow('s-a', '2026-07-12T14:00:00Z'),
  makeDaySessionRow('s-d', '2026-07-12T20:00:00Z'),
  makeDaySessionRow('s-b', '2026-07-12T16:00:00Z'),
];

/**
 * Two sessions sharing a start time — a CSV with a date-only column, or a
 * double-entered session. Rows arrive with 's-tie-b' FIRST, so the id tiebreak
 * has to move it: without one, Array.prototype.sort is stable and leaves the
 * pair in arrival order, and the numbering becomes "whatever the row set said".
 */
const TIED_TIMESTAMP_DAY = [
  makeDaySessionRow('s-tie-b', '2026-07-12T16:00:00Z'),
  makeDaySessionRow('s-tie-a', '2026-07-12T16:00:00Z'),
  makeDaySessionRow('s-first', '2026-07-12T14:00:00Z'),
];

function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from(table: string) {
      tablesQueried.push(table);
      const builder = {
        select: () => builder,
        eq: () => builder,
        // Terminal only for the laps query; sessions and track_days end on
        // single()/maybeSingle(), so one builder serves all three.
        order: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve(sessionResult),
        maybeSingle: () => Promise.resolve(dayResult),
      };
      return builder;
    },
  };
  return stub as unknown as ReturnType<typeof createServerSupabase>;
}

beforeEach(() => {
  jest.clearAllMocks();
  tablesQueried = [];
  sessionResult = { data: null, error: null };
  dayResult = { data: null, error: null };
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
});

describe('getSessionWithLaps day context', () => {
  it('places a middle session with both neighbours', async () => {
    sessionResult = {
      data: makeSessionRow('s-b', '2026-07-12T16:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: makeDayRow([...FOUR_SESSION_DAY]), error: null };

    const { data } = await getSessionWithLaps('s-b');

    expect(data?.dayContext).toEqual({
      trackDayId: 'day-1',
      date: '2026-07-12',
      trackName: 'Road America',
      index: 1, // rendered as "Session 2 of 4"
      count: 4,
      prevSessionId: 's-a',
      nextSessionId: 's-c',
    });
  });

  it('gives the first session of the day no previous', async () => {
    sessionResult = {
      data: makeSessionRow('s-a', '2026-07-12T14:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: makeDayRow([...FOUR_SESSION_DAY]), error: null };

    const { data } = await getSessionWithLaps('s-a');

    expect(data?.dayContext?.index).toBe(0);
    expect(data?.dayContext?.count).toBe(4);
    expect(data?.dayContext?.prevSessionId).toBeNull();
    expect(data?.dayContext?.nextSessionId).toBe('s-b');
  });

  it('gives the last session of the day no next', async () => {
    sessionResult = {
      data: makeSessionRow('s-d', '2026-07-12T20:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: makeDayRow([...FOUR_SESSION_DAY]), error: null };

    const { data } = await getSessionWithLaps('s-d');

    expect(data?.dayContext?.index).toBe(3);
    expect(data?.dayContext?.count).toBe(4);
    expect(data?.dayContext?.prevSessionId).toBe('s-c');
    expect(data?.dayContext?.nextSessionId).toBeNull();
  });

  it('returns a null day context for a session with no track day', async () => {
    sessionResult = {
      data: makeSessionRow('orphan-1', '2026-07-12T16:00:00Z', null),
      error: null,
    };

    const { data, error } = await getSessionWithLaps('orphan-1');

    // Degraded, not broken: the page still has its laps, it just drops the day
    // chrome and falls back to the flat /sessions back-link.
    expect(error).toBeNull();
    expect(data?.dayContext).toBeNull();
    expect(data?.id).toBe('orphan-1');
    // And no pointless round trip to track_days for a day that cannot exist.
    expect(tablesQueried).not.toContain('track_days');
  });

  it('keeps the session when the day query fails', async () => {
    sessionResult = {
      data: makeSessionRow('s-b', '2026-07-12T16:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: null, error: { message: 'permission denied for table track_days' } };

    const { data, error } = await getSessionWithLaps('s-b');

    // A day that will not load costs the coach NAVIGATION. Failing the whole
    // page over its chrome would hide the lap evidence that is the point of it.
    expect(error).toBeNull();
    expect(data?.dayContext).toBeNull();
    expect(data?.laps).toEqual([]);
  });

  it('claims no position when the session is not among the day\u2019s sessions', async () => {
    sessionResult = {
      data: makeSessionRow('s-missing', '2026-07-12T16:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: makeDayRow([...FOUR_SESSION_DAY]), error: null };

    const { data } = await getSessionWithLaps('s-missing');

    // findIndex would hand back -1 and the header would read "Session 0 of 4".
    expect(data?.dayContext).toBeNull();
  });
});

/**
 * THE test. Everything above checks the session page against itself; these check
 * it against the day page.
 *
 * The day page renders "Session {i + 1}" from getTrackDayWithSessions(...).sessions
 * (see /days/[id] -> SessionProgressionStrip). So for the same day row, every
 * session's dayContext.index must equal its position in that array.
 */
describe('session numbering matches the day page', () => {
  async function dayPageOrder(dayRow: unknown): Promise<string[]> {
    dayResult = { data: dayRow, error: null };
    const { data: day } = await getTrackDayWithSessions('day-1');
    return day!.sessions.map((s) => s.id);
  }

  it('agrees with the day page for every session of a four-session day', async () => {
    const order = await dayPageOrder(makeDayRow([...FOUR_SESSION_DAY]));
    expect(order).toEqual(['s-a', 's-b', 's-c', 's-d']);

    for (const [dayPageIndex, sessionId] of order.entries()) {
      sessionResult = {
        data: makeSessionRow(sessionId, '2026-07-12T14:00:00Z', 'day-1'),
        error: null,
      };
      dayResult = { data: makeDayRow([...FOUR_SESSION_DAY]), error: null };

      const { data } = await getSessionWithLaps(sessionId);
      expect(data?.dayContext?.index).toBe(dayPageIndex);
      expect(data?.dayContext?.count).toBe(order.length);
    }
  });

  it('agrees with the day page when two sessions share a start time', async () => {
    const order = await dayPageOrder(makeDayRow([...TIED_TIMESTAMP_DAY]));

    // bySessionStart's id tiebreak decides the tie, and decides it the SAME way
    // for both pages. Drop the tiebreak and stable sort leaves 's-tie-b' second,
    // making it Session 2 here and Session 3 wherever the rows arrive sorted.
    expect(order).toEqual(['s-first', 's-tie-a', 's-tie-b']);

    for (const [dayPageIndex, sessionId] of order.entries()) {
      sessionResult = {
        data: makeSessionRow(sessionId, '2026-07-12T16:00:00Z', 'day-1'),
        error: null,
      };
      dayResult = { data: makeDayRow([...TIED_TIMESTAMP_DAY]), error: null };

      const { data } = await getSessionWithLaps(sessionId);
      expect(data?.dayContext?.index).toBe(dayPageIndex);
    }

    // Spelled out, because "index 2" is the abstraction and "Session 3" is what
    // the coach reads: the tied session that arrived FIRST is numbered LAST.
    sessionResult = {
      data: makeSessionRow('s-tie-b', '2026-07-12T16:00:00Z', 'day-1'),
      error: null,
    };
    dayResult = { data: makeDayRow([...TIED_TIMESTAMP_DAY]), error: null };
    const { data } = await getSessionWithLaps('s-tie-b');
    expect(data?.dayContext?.index).toBe(2);
    expect(data?.dayContext?.prevSessionId).toBe('s-tie-a');
    expect(data?.dayContext?.nextSessionId).toBeNull();
  });
});
