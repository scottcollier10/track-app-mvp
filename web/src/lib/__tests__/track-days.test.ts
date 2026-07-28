import {
  localDateForTimezone,
  dayBestLapMs,
  dayConsistencyTrend,
  sessionDelta,
} from '@/lib/track-days';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';

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
  it('throws on an invalid timestamp rather than defaulting to today', () => {
    expect(() => localDateForTimezone('garbage', 'America/Chicago')).toThrow(RangeError);
  });
});

describe('dayBestLapMs', () => {
  it('returns the fastest best lap across sessions', () => {
    expect(dayBestLapMs([{ bestLapMs: 95200 }, { bestLapMs: 94100 }, { bestLapMs: null }])).toBe(94100);
  });
  it('returns null when no session has a best lap', () => {
    expect(dayBestLapMs([{ bestLapMs: null }])).toBeNull();
  });
  it('ignores non-positive best laps', () => {
    expect(dayBestLapMs([{ bestLapMs: 0 }, { bestLapMs: -5 }, { bestLapMs: 94100 }])).toBe(94100);
  });
});

describe('dayConsistencyTrend', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060]; // ~±0.03s, 6 laps
  const mid = [90000, 90400, 90200, 90300, 90100, 90500]; // between tight and loose, 6 laps
  const loose = [90000, 92000, 91000, 90500, 93000, 90800]; // wider, 6 laps
  it('returns first and last eligible session sigma', () => {
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T14:00:00Z', lapTimesMs: loose },
      { date: '2026-07-11T16:00:00Z', lapTimesMs: tight },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeGreaterThan(trend!.lastSeconds);
  });
  it('uses the true last eligible session, not the second one', () => {
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T09:00:00Z', lapTimesMs: loose },
      { date: '2026-07-11T12:00:00Z', lapTimesMs: mid },
      { date: '2026-07-11T15:00:00Z', lapTimesMs: tight },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeCloseTo(sessionConsistencySeconds(loose)!, 4);
    expect(trend!.lastSeconds).toBeCloseTo(sessionConsistencySeconds(tight)!, 4);
  });
  it('reports a worsening day as first tighter than last', () => {
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T09:00:00Z', lapTimesMs: tight },
      { date: '2026-07-11T12:00:00Z', lapTimesMs: mid },
      { date: '2026-07-11T15:00:00Z', lapTimesMs: loose },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeLessThan(trend!.lastSeconds);
  });
  it('sorts by date, so newest-first input gives the chronological answer', () => {
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T15:00:00Z', lapTimesMs: tight },
      { date: '2026-07-11T12:00:00Z', lapTimesMs: mid },
      { date: '2026-07-11T09:00:00Z', lapTimesMs: loose },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeCloseTo(sessionConsistencySeconds(loose)!, 4);
    expect(trend!.lastSeconds).toBeCloseTo(sessionConsistencySeconds(tight)!, 4);
  });
  it('does not mutate the caller array order', () => {
    const sessions = [
      { date: '2026-07-11T15:00:00Z', lapTimesMs: tight },
      { date: '2026-07-11T09:00:00Z', lapTimesMs: loose },
    ];
    dayConsistencyTrend(sessions);
    expect(sessions.map((s) => s.date)).toEqual(['2026-07-11T15:00:00Z', '2026-07-11T09:00:00Z']);
  });
  it('ignores sessions under the lap gate', () => {
    expect(
      dayConsistencyTrend([
        { date: '2026-07-11T14:00:00Z', lapTimesMs: [90000, 90100] },
        { date: '2026-07-11T16:00:00Z', lapTimesMs: tight },
      ])
    ).toBeNull(); // only 1 eligible
  });
  it('returns null with fewer than two eligible sessions', () => {
    expect(dayConsistencyTrend([{ date: '2026-07-11T16:00:00Z', lapTimesMs: tight }])).toBeNull();
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
  it('nulls the best-lap delta when either session has no best lap', () => {
    expect(
      sessionDelta({ bestLapMs: null, lapTimesMs: loose }, { bestLapMs: 94200, lapTimesMs: tight })
        .bestLapDeltaMs
    ).toBeNull();
    expect(
      sessionDelta({ bestLapMs: 95000, lapTimesMs: loose }, { bestLapMs: null, lapTimesMs: tight })
        .bestLapDeltaMs
    ).toBeNull();
  });
});
