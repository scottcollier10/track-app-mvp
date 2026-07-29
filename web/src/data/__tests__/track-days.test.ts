/**
 * @jest-environment node
 *
 * Tests for the track-days data layer.
 *
 * These lock the two invariants of resolveTrackDay's upsert. Both are silent
 * killers, which is why they get tests and not just comments:
 *
 *  - The payload must carry ONLY the three key columns. PostgREST compiles the
 *    upsert to `ON CONFLICT DO UPDATE SET <payload columns>`, so any coach-authored
 *    day field listed there is nulled out on every re-import.
 *  - ignoreDuplicates must stay at its default (false). With it on, the conflict
 *    branch returns zero rows and .single() makes every re-import of a day a 500.
 *
 * They also lock getTrackDayWithSessions's null-vs-error contract, which
 * /days/[id] depends on to tell a 404 apart from a broken query.
 */

import { getTrackDayWithSessions, resolveTrackDay } from '../track-days';
import { createServerSupabase } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;

/** Arguments seen by the last .upsert() call: [payload, options]. */
let upsertCalls: unknown[][];

/** What the stubbed .maybeSingle() resolves with. Set per test. */
let maybeSingleResult: { data: unknown; error: unknown };

const trackDayRow = {
  id: 'day-1',
  driver_id: 'driver-1',
  track_id: 'track-1',
  date: '2026-07-28',
  created_at: '2026-07-28T00:00:00Z',
};

function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from() {
      const builder = {
        upsert: (...args: unknown[]) => {
          upsertCalls.push(args);
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        single: () =>
          Promise.resolve({ data: trackDayRow, error: null }),
        maybeSingle: () => Promise.resolve(maybeSingleResult),
      };
      return builder;
    },
  };
  return stub as unknown as ReturnType<typeof createServerSupabase>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  upsertCalls = [];
  maybeSingleResult = { data: null, error: null };
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveTrackDay', () => {
  it('upserts ONLY the three key columns', async () => {
    await resolveTrackDay('driver-1', 'track-1', '2026-07-28');

    expect(upsertCalls).toHaveLength(1);
    const [payload] = upsertCalls[0] as [Record<string, unknown>];

    // Exact key set, not toMatchObject: adding a fourth column here must FAIL,
    // because ON CONFLICT DO UPDATE would then overwrite it on every re-import.
    expect(Object.keys(payload).sort()).toEqual(
      ['date', 'driver_id', 'track_id'].sort()
    );
    expect(payload).toEqual({
      driver_id: 'driver-1',
      track_id: 'track-1',
      date: '2026-07-28',
    });
  });

  it('passes onConflict only — never ignoreDuplicates', async () => {
    await resolveTrackDay('driver-1', 'track-1', '2026-07-28');

    const [, options] = upsertCalls[0] as [unknown, Record<string, unknown>];

    // Exact object: an added ignoreDuplicates (of any value) must FAIL here.
    expect(options).toEqual({ onConflict: 'driver_id,track_id,date' });
    expect(Object.keys(options)).not.toContain('ignoreDuplicates');
  });
});

describe('getTrackDayWithSessions', () => {
  it('reports a missing day as absence, not failure', async () => {
    // .maybeSingle() returns a null row with no error when nothing matches.
    maybeSingleResult = { data: null, error: null };

    const { data, error } = await getTrackDayWithSessions('no-such-day');

    expect(data).toBeNull();
    // The contract /days/[id] is built on. If absence ever came back as an
    // Error, the page would show the coach "Error Loading Track Day" (with a
    // raw Postgres message) for a day that simply is not there, instead of a
    // 404. RLS-invisible rows land in this same branch.
    expect(error).toBeNull();
  });

  it('reports a real query failure as an Error', async () => {
    maybeSingleResult = { data: null, error: { message: 'permission denied for table track_days' } };

    const { data, error } = await getTrackDayWithSessions('day-1');

    expect(data).toBeNull();
    // Paired with the test above: both return a null row, and only this one is
    // an error. That difference is the whole point.
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('permission denied for table track_days');
  });
});
