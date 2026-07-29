import {
  bySessionStart,
  localDateForTimezone,
  dayBestLapMs,
  dayConsistencyTrend,
  displayedSigmaDeltaSeconds,
  displayedSigmaSeconds,
  formatConsistencyTrend,
  sessionDelta,
  uniqueTrackDayLinks,
} from '@/lib/track-days';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';

describe('bySessionStart', () => {
  it('orders sessions by start time, oldest first', () => {
    const sorted = [
      { date: '2026-07-11T15:00:00Z' },
      { date: '2026-07-11T09:00:00Z' },
      { date: '2026-07-11T12:00:00Z' },
    ].sort(bySessionStart);
    expect(sorted.map((s) => s.date)).toEqual([
      '2026-07-11T09:00:00Z',
      '2026-07-11T12:00:00Z',
      '2026-07-11T15:00:00Z',
    ]);
  });

  it('compares instants, not strings — equal times in different offsets tie', () => {
    // The reason this is a comparator and not a localeCompare: PostgREST hands
    // back UTC today, but an offset-suffixed timestamp must still sort right.
    expect(bySessionStart({ date: '2026-07-11T14:00:00Z' }, { date: '2026-07-11T09:00:00-05:00' })).toBe(0);
    expect(
      bySessionStart({ date: '2026-07-11T09:00:00-05:00' }, { date: '2026-07-11T13:00:00Z' })
    ).toBeGreaterThan(0);
  });

  it('breaks a tied start time on session id, so the order never depends on row order', () => {
    // Two sessions CAN share a timestamp (a date-only CSV column, a
    // double-entered session). This ordering IS the "Session N of M" numbering,
    // so an unbroken tie would let the day page and the session page number the
    // same two sessions differently.
    const tied = [
      { id: 'b', date: '2026-07-11T09:00:00Z' },
      { id: 'a', date: '2026-07-11T09:00:00Z' },
    ];
    expect([...tied].sort(bySessionStart).map((s) => s.id)).toEqual(['a', 'b']);
    expect([...tied].reverse().sort(bySessionStart).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('still ties when neither side carries an id', () => {
    // Callers without an id (SessionForTrend) keep the old behaviour rather
    // than each resolving the tie their own way.
    expect(bySessionStart({ date: '2026-07-11T09:00:00Z' }, { date: '2026-07-11T09:00:00Z' })).toBe(0);
  });
});

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

describe('displayedSigmaSeconds / displayedSigmaDeltaSeconds', () => {
  it('snaps a σ to the one decimal it is displayed at', () => {
    expect(displayedSigmaSeconds(0.6490512)).toBe(0.6);
    expect(displayedSigmaSeconds(0.5510089)).toBe(0.6);
  });

  it('returns exactly zero when both σ render identically', () => {
    // 0.649 and 0.551 both print "±0.6s"; their RAW difference prints "-0.1s".
    expect(displayedSigmaDeltaSeconds(0.6490512, 0.5510089)).toBe(0);
    // And no signed zero: a raw difference of -0.0197 must not become "-0.0s".
    expect(Object.is(displayedSigmaDeltaSeconds(0.6397399, 0.6200219), -0)).toBe(false);
    expect(displayedSigmaDeltaSeconds(0.6397399, 0.6200219).toFixed(1)).toBe('0.0');
  });

  it('keeps the sign of a change that is real at display resolution', () => {
    expect(displayedSigmaDeltaSeconds(0.64, 0.44).toFixed(1)).toBe('-0.2');
    expect(displayedSigmaDeltaSeconds(0.44, 0.64).toFixed(1)).toBe('0.2');
  });
});

describe('formatConsistencyTrend', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060];
  const loose = [90000, 92000, 91000, 90500, 93000, 90800];

  it('renders first -> last σ at display resolution', () => {
    expect(formatConsistencyTrend({ firstSeconds: 0.6490512, lastSeconds: 0.4102 })).toBe(
      '±0.6s → ±0.4s'
    );
  });

  it('returns null when there is no honest trend to report', () => {
    // dayConsistencyTrend already refuses to invent one; the formatter must not
    // dress that up as "±0.0s → ±0.0s".
    expect(formatConsistencyTrend(null)).toBeNull();
    expect(
      formatConsistencyTrend(dayConsistencyTrend([{ date: '2026-07-11T16:00:00Z', lapTimesMs: tight }]))
    ).toBeNull();
  });

  it('formats a real day end to end', () => {
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T16:00:00Z', lapTimesMs: tight },
      { date: '2026-07-11T14:00:00Z', lapTimesMs: loose },
    ]);
    expect(formatConsistencyTrend(trend)).toBe(
      `±${sessionConsistencySeconds(loose)!.toFixed(1)}s → ±${sessionConsistencySeconds(tight)!.toFixed(1)}s`
    );
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

describe('uniqueTrackDayLinks', () => {
  /** What the import loop actually collects: an /api/import-session 201 body plus the CSV row's driver name. */
  const imported = (
    sessionId: string,
    trackDayId: string | null | undefined,
    driverName: string
  ) => ({
    sessionId,
    trackDayId,
    message: 'Session imported successfully',
    driverName,
  });

  it('collapses a whole CSV of sessions on one day to a single link', () => {
    // The common case: a coach uploads one event, the route returns the same
    // track day for every session. Four identical links would be nonsense.
    expect(
      uniqueTrackDayLinks([
        imported('session-1', 'day-1', 'taylor.brooks'),
        imported('session-2', 'day-1', 'taylor.brooks'),
        imported('session-3', 'day-1', 'taylor.brooks'),
      ])
    ).toEqual([{ trackDayId: 'day-1', driverName: 'taylor.brooks' }]);
  });

  it('pairs each day with its driver, so the links can be told apart', () => {
    // Two drivers at the same event are two track days (days are per driver).
    // The name is what distinguishes the links; it is raw here, and the panel
    // runs it through formatDriverName like every other name in the app.
    expect(
      uniqueTrackDayLinks([
        imported('session-1', 'day-a', 'taylor.brooks'),
        imported('session-2', 'day-b', 'jamie rodriguez'),
        imported('session-3', 'day-a', 'taylor.brooks'),
        imported('session-4', 'day-b', 'jamie rodriguez'),
      ])
    ).toEqual([
      { trackDayId: 'day-a', driverName: 'taylor.brooks' },
      { trackDayId: 'day-b', driverName: 'jamie rodriguez' },
    ]);
  });

  it('keeps distinct days in first-seen (CSV ROW) order — NOT chronological', () => {
    // Stable and deterministic, and nothing more: this file listed day-2's rows
    // first, so day-2 comes back first even if it is the later date. Callers
    // must not number these; "track day 1" would then name the second day.
    expect(
      uniqueTrackDayLinks([
        imported('session-1', 'day-2', 'bree'),
        imported('session-2', 'day-1', 'avery'),
        imported('session-3', 'day-2', 'bree'),
        imported('session-4', 'day-3', 'casey'),
      ]).map((link) => link.trackDayId)
    ).toEqual(['day-2', 'day-1', 'day-3']);
  });

  it('drops responses with no usable id rather than linking to /days/undefined', () => {
    // A missing id is not supposed to happen; if the route ever changes shape,
    // a cast would produce a link that looks fine until it is clicked.
    expect(
      uniqueTrackDayLinks([
        imported('session-1', 'day-1', 'avery'),
        imported('session-2', undefined, 'bree'),
        imported('session-3', null, 'casey'),
        imported('session-4', '', 'dana'),
      ])
    ).toEqual([{ trackDayId: 'day-1', driverName: 'avery' }]);
  });

  it('returns an empty list when nothing imported', () => {
    expect(uniqueTrackDayLinks([])).toEqual([]);
  });
});
