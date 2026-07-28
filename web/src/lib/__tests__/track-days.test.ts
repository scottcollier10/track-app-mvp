import {
  localDateForTimezone,
  dayBestLapMs,
  dayConsistencyTrend,
  sessionDelta,
} from '@/lib/track-days';

describe('localDateForTimezone', () => {
  it('converts a UTC timestamp to the track-local calendar date', () => {
    // 2026-07-12 03:30 UTC is still 2026-07-11 in Chicago (UTC-5)
    expect(localDateForTimezone('2026-07-12T03:30:00Z', 'America/Chicago')).toBe('2026-07-11');
  });
  it('falls back to UTC when timezone is null', () => {
    expect(localDateForTimezone('2026-07-12T03:30:00Z', null)).toBe('2026-07-12');
  });
  it('falls back to UTC on an invalid timezone', () => {
    expect(localDateForTimezone('2026-07-12T03:30:00Z', 'Not/AZone')).toBe('2026-07-12');
  });
});

describe('dayBestLapMs', () => {
  it('returns the fastest best lap across sessions', () => {
    expect(dayBestLapMs([{ best_lap_ms: 95200 }, { best_lap_ms: 94100 }, { best_lap_ms: null }])).toBe(94100);
  });
  it('returns null when no session has a best lap', () => {
    expect(dayBestLapMs([{ best_lap_ms: null }])).toBeNull();
  });
});

describe('dayConsistencyTrend', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060]; // ~±0.03s, 6 laps
  const loose = [90000, 92000, 91000, 90500, 93000, 90800]; // wider, 6 laps
  it('returns first and last eligible session sigma', () => {
    const trend = dayConsistencyTrend([loose, tight]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeGreaterThan(trend!.lastSeconds);
  });
  it('ignores sessions under the lap gate', () => {
    expect(dayConsistencyTrend([[90000, 90100], tight])).toBeNull(); // only 1 eligible
  });
  it('returns null with fewer than two eligible sessions', () => {
    expect(dayConsistencyTrend([tight])).toBeNull();
  });
});

describe('sessionDelta', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060];
  const loose = [90000, 92000, 91000, 90500, 93000, 90800];
  it('computes best-lap and consistency deltas vs previous session', () => {
    const d = sessionDelta(
      { bestLapMs: 95000, lapTimesMs: loose },
      { bestLapMs: 94200, lapTimesMs: tight }
    );
    expect(d.bestLapDeltaMs).toBe(-800);
    expect(d.consistencyDeltaSeconds).toBeLessThan(0);
  });
  it('nulls the consistency delta when either session is under the lap gate', () => {
    const d = sessionDelta(
      { bestLapMs: 95000, lapTimesMs: [90000, 90100] },
      { bestLapMs: 94200, lapTimesMs: tight }
    );
    expect(d.bestLapDeltaMs).toBe(-800);
    expect(d.consistencyDeltaSeconds).toBeNull();
  });
});
