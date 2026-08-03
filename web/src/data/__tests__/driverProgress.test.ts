/**
 * @jest-environment node
 *
 * Tests for getDriverProgressByTrack's per-event derivations.
 *
 * The reason this file exists: driverProgress asks "is this lap time a lap at
 * all?" before it computes peakWindowAvg, and for a long time it asked inline
 * (`.filter((t) => t > 0)`) instead of through isCountableLapMs. With no test
 * here the collapse onto the shared predicate could not be shown to preserve
 * behaviour, so it was left as a fifth copy. These tests pin the boundary the
 * predicate draws, so the delegation is verifiable rather than trusted.
 *
 * Note what does NOT pin it: sessionConsistencySeconds runs cleanLaps
 * internally, which drops non-positive times on its own — so consistency is
 * identical whether or not this file filters. peakWindowAvg is the derivation
 * that actually depends on the predicate, and it is the one asserted below.
 */

import { getDriverProgressByTrack } from '../driverProgress';
import { createServerSupabase } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;

/** What the stubbed sessions query resolves with. Set per test. */
let sessionsResult: { data: unknown; error: unknown };

const TRACK = { id: 'track-1', name: 'Thunderhill' };

function lapRows(timesMs: number[]) {
  return timesMs.map((lap_time_ms, i) => ({ lap_number: i + 1, lap_time_ms }));
}

function sessionRow(
  id: string,
  date: string,
  bestLapMs: number | null,
  timesMs: number[]
) {
  return { id, date, best_lap_ms: bestLapMs, track: TRACK, laps: lapRows(timesMs) };
}

/**
 * A thenable query builder: driverProgress holds the chain in a variable, adds
 * .gte/.lte conditionally, then awaits it, so every method has to return the
 * same object and the object has to be awaitable.
 */
function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    then: (
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(sessionsResult).then(onFulfilled, onRejected),
  };
  return { from: () => builder } as unknown as ReturnType<typeof createServerSupabase>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  sessionsResult = { data: null, error: null };
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
});

describe('getDriverProgressByTrack', () => {
  it('keeps a 0ms row out of the peak window while still counting it as a lap', async () => {
    // A 0 is what a timing export writes for a lap it never closed. It is not a
    // lap time, so the best-3 average must not see it — a peak window that
    // averages in a zero reports a 60s three-lap average for a 90s car.
    //
    // lapCount stays 6, deliberately: it counts ROWS imported, which is what the
    // coach's session list shows, and is a different question from "which times
    // are laps".
    sessionsResult = {
      data: [sessionRow('s-1', '2026-07-12', 90000, [90000, 90100, 90050, 0, 90080, 90020])],
      error: null,
    };

    const { data } = await getDriverProgressByTrack('driver-1', 'track-1');

    const event = data!.events[0];
    expect(event.lapCount).toBe(6);
    // The three fastest countable times: 90000, 90020, 90050.
    expect(event.peakWindowAvg).toBeCloseTo((90000 + 90020 + 90050) / 3, 6);
  });

  it('derives the event series, best-lap position and first-to-latest deltas', async () => {
    sessionsResult = {
      data: [
        sessionRow('s-1', '2026-07-05', 90500, [91000, 90800, 90500, 90900, 90700]),
        sessionRow('s-2', '2026-07-12', 89800, [90100, 89800, 90000, 90050, 89900]),
      ],
      error: null,
    };

    const { data, error } = await getDriverProgressByTrack('driver-1', 'track-1');

    expect(error).toBeNull();
    expect(data!.trackName).toBe('Thunderhill');
    expect(data!.events.map((e) => e.sessionId)).toEqual(['s-1', 's-2']);
    // Best lap arrived on lap 3 of the first event and lap 2 of the latest.
    expect(data!.firstEvent!.bestLapNumber).toBe(3);
    expect(data!.latestEvent!.bestLapNumber).toBe(2);
    // Negative = faster, and finding pace one lap sooner.
    expect(data!.deltas).toEqual({ bestLapDelta: -700, lapNumberDelta: -1 });
  });
});
