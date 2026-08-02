/**
 * @jest-environment node
 *
 * Tests for the day-summaries data layer.
 *
 * The adapter is thin by design, so what is worth locking is what it REFUSES to
 * do:
 *
 *  - It never carries `sessions.ai_coaching_summary` into the context object.
 *    That property is enforced at COMPILE time, by the `ai_coaching_summary?:
 *    never` tripwire on DaySummarySessionInput, which the typecheck gate runs —
 *    not by the assertion below. The core projects its output fields explicitly,
 *    so the AI text would be stripped downstream even if this adapter handed
 *    over raw rows; a runtime test of the adapter cannot see the difference.
 *    The assertion is kept as labelled defence-in-depth, since what decision 5
 *    protects is the bytes in the snapshot.
 *  - It tells "no such day" apart from "the query failed". Null means the
 *    former and the routes turn it into a 404; a failure throws, because a 404
 *    would tell the coach their day is gone when the database is merely
 *    unreachable.
 */

import { buildDaySummaryContext, getDaySummaries } from '../day-summaries';
import { getTrackDayDebrief } from '@/data/track-days';
import { createServerSupabase } from '@/lib/supabase/server';
import type { TrackDayDebrief } from '@/lib/types';

jest.mock('@/lib/supabase/server');
jest.mock('@/data/track-days');

const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;
const mockGetTrackDayDebrief = getTrackDayDebrief as jest.MockedFunction<
  typeof getTrackDayDebrief
>;

const AI_TEXT = 'AI SAYS: carry more speed through 5.';

/**
 * A one-session day whose session carries AI coaching text — the row shape the
 * debrief actually returns, AI column and all.
 */
const debrief = {
  id: 'day-1',
  driver_id: 'driver-1',
  track_id: 'track-1',
  date: '2026-07-28',
  notes: 'Hot and dusty.',
  created_at: '2026-07-28T00:00:00Z',
  driver: { id: 'driver-1', name: 'Taylor Brooks', email: 'taylor@example.com' },
  track: { id: 'track-1', name: 'Thunderhill' },
  sessions: [
    {
      id: 'session-1',
      date: '2026-07-28T15:00:00Z',
      best_lap_ms: 95000,
      representativeness: null,
      representativeness_note: null,
      ai_coaching_summary: AI_TEXT,
      laps: [
        { lap_number: 1, lap_time_ms: 99000, sector_data: null },
        { lap_number: 2, lap_time_ms: 95000, sector_data: null },
      ],
    },
  ],
  focusItems: [],
  originSessions: [],
  assessmentSessions: [],
} as unknown as TrackDayDebrief;

type QueryResult = { data: unknown; error: unknown };

/** Arguments seen by .in(), per call. */
let inCalls: unknown[][];
/** Arguments seen by .eq() and .order(), per call. */
let eqCalls: unknown[][];
let orderCalls: unknown[][];
let results: Record<string, QueryResult>;

function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: (...args: unknown[]) => {
          eqCalls.push(args);
          return builder;
        },
        order: (...args: unknown[]) => {
          orderCalls.push(args);
          return builder;
        },
        in: (...args: unknown[]) => {
          inCalls.push(args);
          return builder;
        },
        then: (
          onFulfilled: (value: QueryResult) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
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

beforeEach(() => {
  jest.clearAllMocks();
  // The failure paths log the Postgres code before wrapping; silenced so a
  // passing run stays readable.
  jest.spyOn(console, 'error').mockImplementation(() => {});
  inCalls = [];
  eqCalls = [];
  orderCalls = [];
  results = { coaching_notes: { data: [], error: null }, day_summaries: { data: [], error: null } };
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
  mockGetTrackDayDebrief.mockResolvedValue({ data: debrief, error: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('buildDaySummaryContext', () => {
  it('returns null for a day that does not exist or is not the coach\'s', async () => {
    mockGetTrackDayDebrief.mockResolvedValue({ data: null, error: null });

    await expect(buildDaySummaryContext('day-1')).resolves.toBeNull();
    // No day, no notes query.
    expect(inCalls).toHaveLength(0);
  });

  it('throws when the debrief query fails, rather than reporting the day missing', async () => {
    mockGetTrackDayDebrief.mockResolvedValue({
      data: null,
      error: new Error('connection to server was lost'),
    });

    await expect(buildDaySummaryContext('day-1')).rejects.toThrow('connection to server was lost');
  });

  it('fetches the day\'s coach notes and folds them into the context', async () => {
    results.coaching_notes = {
      data: [
        {
          id: 'note-1',
          session_id: 'session-1',
          author: 'coach',
          body: 'Hands settled by lap 4.',
          created_at: '2026-07-28T15:05:00Z',
        },
      ],
      error: null,
    };

    const ctx = await buildDaySummaryContext('day-1');

    // Scoped to THIS day's sessions — a note query by driver would drag other
    // days' notes into the snapshot.
    expect(inCalls).toEqual([['session_id', ['session-1']]]);
    expect(ctx?.coachingNotes).toEqual([
      {
        sessionId: 'session-1',
        author: 'coach',
        body: 'Hands settled by lap 4.',
        createdAt: '2026-07-28T15:05:00Z',
      },
    ]);
    expect(ctx?.day).toEqual({
      trackName: 'Thunderhill',
      date: '2026-07-28',
      driverName: 'Taylor Brooks',
      sessionCount: 1,
      notes: 'Hot and dusty.',
    });
  });

  it('carries no AI-authored text into the snapshot (defence in depth)', async () => {
    const ctx = await buildDaySummaryContext('day-1');

    // The real guard is the compile-time tripwire (see the file docblock); this
    // cannot fail while the core projects explicitly. Kept because the whole
    // object, serialized, is the closest a runtime test gets to the property
    // that matters — what lands in prompt_context and what the model is shown.
    expect(JSON.stringify(ctx)).not.toContain(AI_TEXT);
    expect(ctx?.sessions[0]).not.toHaveProperty('ai_coaching_summary');
  });

  it('skips the notes query for a day with no sessions', async () => {
    mockGetTrackDayDebrief.mockResolvedValue({
      data: { ...debrief, sessions: [] } as unknown as TrackDayDebrief,
      error: null,
    });

    const ctx = await buildDaySummaryContext('day-1');

    // `.in()` on an empty list is a round trip that can only return nothing.
    expect(inCalls).toHaveLength(0);
    expect(ctx?.sessions).toEqual([]);
    expect(ctx?.coachingNotes).toEqual([]);
  });

  it('throws when the notes query fails', async () => {
    results.coaching_notes = { data: null, error: { message: 'notes query failed' } };

    await expect(buildDaySummaryContext('day-1')).rejects.toThrow('notes query failed');
  });
});

describe('getDaySummaries', () => {
  it('returns every generation for the day, newest first', async () => {
    const rows = [{ id: 'summary-2' }, { id: 'summary-1' }];
    results.day_summaries = { data: rows, error: null };

    await expect(getDaySummaries('day-1')).resolves.toEqual(rows);

    expect(eqCalls).toEqual([['track_day_id', 'day-1']]);
    // Newest first, and UNFILTERED by status: daySummaryView is the only thing
    // that decides which row is current.
    expect(orderCalls).toEqual([['created_at', { ascending: false }]]);
  });

  it('throws on a query failure instead of reporting no summaries', async () => {
    results.day_summaries = { data: null, error: { message: 'select failed' } };

    await expect(getDaySummaries('day-1')).rejects.toThrow('select failed');
  });
});
