/**
 * @jest-environment node
 *
 * Tests for POST /api/import-session
 *
 * Guards the track-day wiring: a session must always be filed under the day the
 * import resolved. These are silent-corruption regressions — a dropped
 * track_day_id produces no error, just orphan sessions that vanish from the UI.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { createServerSupabase } from '@/lib/supabase/server';
import { resolveTrackDay } from '@/data/track-days';

jest.mock('@/lib/auth/current-coach');
jest.mock('@/lib/supabase/server');
jest.mock('@/data/track-days');

const mockGetCurrentCoach = getCurrentCoach as jest.MockedFunction<typeof getCurrentCoach>;
const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;
const mockResolveTrackDay = resolveTrackDay as jest.MockedFunction<typeof resolveTrackDay>;

const coach = { id: 'coach-1', email: 'coach@example.com' } as Awaited<
  ReturnType<typeof getCurrentCoach>
>;

type QueryResult = { data: unknown; error: unknown };

/** Payloads handed to .insert(), keyed by table. */
let inserts: Record<string, unknown[]>;
/** What awaiting a chain on a given table resolves to. */
let results: Record<string, QueryResult>;

interface QueryBuilder {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  single: () => QueryBuilder;
  insert: (payload: unknown) => QueryBuilder;
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
}

/**
 * Minimal stand-in for the Supabase query builder: every method returns the
 * builder, and awaiting it resolves to the table's canned result. Enough for
 * this route's chains (.select().eq().single(), .insert().select().single(),
 * and a bare .insert()).
 */
function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from(table: string): QueryBuilder {
      const builder: QueryBuilder = {
        select: () => builder,
        eq: () => builder,
        single: () => builder,
        insert: (payload: unknown) => {
          (inserts[table] ||= []).push(payload);
          return builder;
        },
        then: (onFulfilled, onRejected) =>
          Promise.resolve(results[table] ?? { data: null, error: null }).then(
            onFulfilled,
            onRejected
          ),
      };
      return builder;
    },
  };
  return stub as unknown as ReturnType<typeof createServerSupabase>;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/import-session', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validPayload = {
  driverEmail: 'driver@example.com',
  trackId: 'track-1',
  date: '2026-07-28T14:30:00Z',
  totalTimeMs: 600000,
  bestLapMs: 95000,
  laps: [
    { lapNumber: 1, lapTimeMs: 99000 },
    { lapNumber: 2, lapTimeMs: 95000 },
  ],
};

const trackDay = {
  id: 'day-1',
  driver_id: 'driver-1',
  track_id: 'track-1',
  date: '2026-07-28',
  created_at: '2026-07-28T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  inserts = {};
  results = {
    drivers: {
      data: { id: 'driver-1', email: 'driver@example.com', name: 'driver' },
      error: null,
    },
    tracks: {
      data: { id: 'track-1', name: 'Test Track', timezone: 'America/New_York' },
      error: null,
    },
    sessions: { data: { id: 'session-1', source: 'csv_import' }, error: null },
    laps: { data: null, error: null },
  };

  mockGetCurrentCoach.mockResolvedValue(coach);
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
  mockResolveTrackDay.mockResolvedValue({ data: trackDay, error: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/import-session', () => {
  it('rejects a malformed date before any write happens', async () => {
    const res = await POST(makeRequest({ ...validPayload, date: 'not-a-date' }));

    expect(res.status).toBe(400);
    expect(mockResolveTrackDay).not.toHaveBeenCalled();
    expect(mockCreateServerSupabase).not.toHaveBeenCalled();
  });

  it('returns 500 and skips the session insert when the track day cannot be resolved', async () => {
    mockResolveTrackDay.mockResolvedValue({
      data: null,
      error: new Error('duplicate key value violates unique constraint'),
    });

    const res = await POST(makeRequest(validPayload));

    expect(res.status).toBe(500);
    expect(inserts.sessions).toBeUndefined();
    expect(inserts.laps).toBeUndefined();
  });

  it('files the session under the resolved track day and returns its id', async () => {
    const res = await POST(makeRequest(validPayload));
    const json = await res.json();

    expect(res.status).toBe(201);

    // The day is resolved from the track-local calendar date, not the raw timestamp.
    expect(mockResolveTrackDay).toHaveBeenCalledWith('driver-1', 'track-1', '2026-07-28');

    // The FK must reach the row. A refactor that quietly drops it fails here.
    expect(inserts.sessions).toHaveLength(1);
    expect(inserts.sessions[0]).toMatchObject({
      driver_id: 'driver-1',
      track_id: 'track-1',
      track_day_id: 'day-1',
      date: validPayload.date,
    });

    expect(json.sessionId).toBe('session-1');
    expect(json.trackDayId).toBe('day-1');
  });
});
