import {
  bySessionStart,
  localDateForTimezone,
  dayAggregateAnnotation,
  dayBestLapMs,
  dayConsistencyTrend,
  deltaBaselineIndex,
  displayedSigmaDeltaSeconds,
  displayedSigmaSeconds,
  focusItemsForSession,
  formatConsistencyTrend,
  representativeSessions,
  sessionDelta,
  uniqueTrackDayLinks,
  validLapTimesMs,
} from '@/lib/track-days';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';

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

describe('validLapTimesMs', () => {
  it('keeps positive lap times in order and drops the rest', () => {
    expect(
      validLapTimesMs([
        { lap_time_ms: 91000 },
        { lap_time_ms: 0 },
        { lap_time_ms: 92000 },
        { lap_time_ms: -5000 },
        { lap_time_ms: null },
        { lap_time_ms: 91500 },
      ])
    ).toEqual([91000, 92000, 91500]);
  });

  it('returns an empty array for a session with no laps', () => {
    expect(validLapTimesMs([])).toEqual([]);
  });

  /**
   * The bug this helper exists to close: a SIX-lap session with one 0.
   *
   * csv-parser only rejects a lap time that fails parseInt, so "0" survives
   * ("0" is truthy, so it clears the missing-field check too), the import route
   * adds no positivity check, and laps.lap_time_ms carries no CHECK > 0. Such a
   * session used to render three ways — dropped from the driver page's trend
   * (5 laps), σ computed WITH the zero on the day page, and σ over 5 laps behind
   * a satisfied 6-lap gate on the session page.
   *
   * Every site now gates on and computes σ from this one array, so all of them
   * make the SAME call: five countable laps, no σ claim.
   */
  it('is the one array every σ gate counts, so a six-lap session with one 0 claims nothing', () => {
    const sixLapsOneZero = [91000, 0, 92000, 91000, 92000, 91000].map((lap_time_ms, i) => ({
      lap_number: i + 1,
      lap_time_ms,
    }));
    const sixGood = [91000, 92000, 91000, 92000, 91000, 92000];

    const lapTimesMs = validLapTimesMs(sixLapsOneZero);
    expect(sixLapsOneZero).toHaveLength(6);
    expect(lapTimesMs).toEqual([91000, 92000, 91000, 92000, 91000]);

    // The session page's gate (canClaimConsistency over lapTimes) — the
    // one that used to be satisfied by the raw row count.
    expect(lapTimesMs.length).toBeLessThan(MIN_LAPS_FOR_INSIGHTS);

    // The driver page's day list and the day page's KPI: both feed this array to
    // dayConsistencyTrend, so neither session qualifies as an endpoint...
    expect(
      dayConsistencyTrend([
        { date: '2026-07-11T14:00:00Z', lapTimesMs },
        { date: '2026-07-11T16:00:00Z', lapTimesMs: sixGood },
      ])
    ).toBeNull();

    // ...and the progression strip's per-card delta agrees.
    expect(
      sessionDelta(
        { bestLapMs: 91000, lapTimesMs },
        { bestLapMs: 91000, lapTimesMs: sixGood }
      ).consistencyDeltaSeconds
    ).toBeNull();

    // Sanity: the same six laps with no zero DO clear the gate, so the null
    // above is the zero's doing and not a broken fixture.
    expect(
      dayConsistencyTrend([
        { date: '2026-07-11T14:00:00Z', lapTimesMs: sixGood },
        { date: '2026-07-11T16:00:00Z', lapTimesMs: sixGood },
      ])
    ).not.toBeNull();
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

// The one exclusion rule: only not_representative excludes. partial and null count.
describe('representativeSessions', () => {
  it('excludes only not_representative; null and partial count fully', () => {
    const sessions = [
      { id: 's1', representativeness: 'representative' },
      { id: 's2', representativeness: 'partial' },
      { id: 's3', representativeness: null },
      { id: 's4', representativeness: 'not_representative' },
    ];
    expect(representativeSessions(sessions).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('day aggregates under representativeness', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060];
  const loose = [90000, 92000, 91000, 90500, 93000, 90800];
  const mid = [90000, 90400, 90200, 90300, 90100, 90500];

  it('pre-P2 days (all-null flags) produce byte-identical aggregates', () => {
    // The no-op pin: a session flagged null (every pre-P2 session) must compute
    // exactly what the same session computed before the field existed.
    expect(
      dayBestLapMs([
        { bestLapMs: 95200, representativeness: null },
        { bestLapMs: 94100, representativeness: null },
      ])
    ).toBe(dayBestLapMs([{ bestLapMs: 95200 }, { bestLapMs: 94100 }]));

    expect(
      dayConsistencyTrend([
        { date: '2026-07-11T14:00:00Z', lapTimesMs: loose, representativeness: null },
        { date: '2026-07-11T16:00:00Z', lapTimesMs: tight, representativeness: null },
      ])
    ).toEqual(
      dayConsistencyTrend([
        { date: '2026-07-11T14:00:00Z', lapTimesMs: loose },
        { date: '2026-07-11T16:00:00Z', lapTimesMs: tight },
      ])
    );
  });

  it('dayBestLapMs ignores a not_representative session holding the fastest lap', () => {
    expect(
      dayBestLapMs([
        { bestLapMs: 90000, representativeness: 'not_representative' },
        { bestLapMs: 94100, representativeness: null },
        { bestLapMs: 95000, representativeness: 'partial' },
      ])
    ).toBe(94100);
  });

  it('dayConsistencyTrend skips not_representative sessions when picking first/last qualifying', () => {
    // Chronologically loose -> mid -> tight, but the loose opener is flagged:
    // the trend must start at mid, not loose.
    const trend = dayConsistencyTrend([
      { date: '2026-07-11T09:00:00Z', lapTimesMs: loose, representativeness: 'not_representative' },
      { date: '2026-07-11T12:00:00Z', lapTimesMs: mid, representativeness: null },
      { date: '2026-07-11T15:00:00Z', lapTimesMs: tight, representativeness: 'partial' },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeCloseTo(sessionConsistencySeconds(mid)!, 4);
    expect(trend!.lastSeconds).toBeCloseTo(sessionConsistencySeconds(tight)!, 4);

    // And when the exclusion leaves fewer than two qualifying sessions, there is
    // no honest trend at all.
    expect(
      dayConsistencyTrend([
        { date: '2026-07-11T09:00:00Z', lapTimesMs: loose, representativeness: 'not_representative' },
        { date: '2026-07-11T12:00:00Z', lapTimesMs: mid, representativeness: null },
      ])
    ).toBeNull();
  });

  it('dayAggregateAnnotation renders "(3 of 4 sessions)" only for strict subsets, null otherwise', () => {
    expect(dayAggregateAnnotation(4, 3)).toBe('(3 of 4 sessions)');
    expect(dayAggregateAnnotation(4, 4)).toBeNull();
    expect(dayAggregateAnnotation(1, 1)).toBeNull();
    expect(dayAggregateAnnotation(0, 0)).toBeNull();
  });
});

describe('deltaBaselineIndex', () => {
  it('returns nearest earlier non-excluded session index; null for session 1 or when all priors are excluded', () => {
    const day = [
      { representativeness: null },
      { representativeness: 'not_representative' },
      { representativeness: 'partial' },
      { representativeness: null },
    ];
    // Session 1 has nothing earlier to compare against.
    expect(deltaBaselineIndex(day, 0)).toBeNull();
    // Session 2's neighbour is fine.
    expect(deltaBaselineIndex(day, 1)).toBe(0);
    // Session 3 skips its flagged neighbour back to session 1.
    expect(deltaBaselineIndex(day, 2)).toBe(0);
    // Session 4's neighbour is partial — partial counts.
    expect(deltaBaselineIndex(day, 3)).toBe(2);

    // Every prior excluded: no baseline, never "compare against the flagged one".
    expect(
      deltaBaselineIndex(
        [{ representativeness: 'not_representative' }, { representativeness: null }],
        1
      )
    ).toBeNull();
  });
});

describe('focusItemsForSession', () => {
  // A two-session day at a Chicago track. s1 is the morning session, s2 the
  // afternoon — origin ordering between them is bySessionStart's.
  const s1 = { id: 's1', date: '2026-07-12T15:00:00Z' };
  const s2 = { id: 's2', date: '2026-07-12T20:00:00Z' };
  const originSessions = new Map([
    ['s1', s1],
    ['s2', s2],
  ]);
  const dayDate = '2026-07-12';
  const trackTimezone = 'America/Chicago';

  const item = (
    id: string,
    status: string,
    created_at: string,
    created_after_session_id: string | null
  ) => ({ id, status, created_at, created_after_session_id });

  const eligibility = (
    items: ReturnType<typeof item>[],
    session: { id: string; date: string },
    assessedItemIds: Set<string> = new Set()
  ) =>
    focusItemsForSession({
      items,
      assessedItemIds,
      session,
      originSessions,
      dayDate,
      trackTimezone,
    });

  it('origin-session item appears from the next session onward, never in its origin session', () => {
    const originS1 = item('fi-1', 'active', '2026-07-12T15:30:00Z', 's1');
    expect(eligibility([originS1], s1).inPlay).toEqual([]);
    expect(eligibility([originS1], s2).inPlay).toEqual([originS1]);
  });

  it('null-origin item created the same local date is inPlay (tie included)', () => {
    // 18:00Z is 1pm in Chicago — same local date as the day. The tie counts.
    const sameDay = item('fi-2', 'active', '2026-07-12T18:00:00Z', null);
    expect(eligibility([sameDay], s1).inPlay).toEqual([sameDay]);
  });

  it('null-origin item created after the day date is not inPlay', () => {
    // 18:00Z on the 13th is the NEXT Chicago date — the item did not exist yet
    // as far as this day is concerned.
    const later = item('fi-3', 'active', '2026-07-13T18:00:00Z', null);
    expect(eligibility([later], s2).inPlay).toEqual([]);
  });

  it('item assessed at this session and since achieved is reviewed but not inPlay', () => {
    const achieved = item('fi-4', 'achieved', '2026-07-10T18:00:00Z', 's1');
    const result = eligibility([achieved], s2, new Set(['fi-4']));
    expect(result.reviewed).toEqual([achieved]);
    expect(result.inPlay).toEqual([]);
  });

  it('paused/dropped items are neither, unless assessed at this session', () => {
    const paused = item('fi-5', 'paused', '2026-07-10T18:00:00Z', 's1');
    const dropped = item('fi-6', 'dropped', '2026-07-10T19:00:00Z', 's1');

    const untouched = eligibility([paused, dropped], s2);
    expect(untouched.reviewed).toEqual([]);
    expect(untouched.inPlay).toEqual([]);

    // Assessed AT this session, the coach's review still shows regardless of
    // where the item's status has moved since.
    const assessed = eligibility([paused, dropped], s2, new Set(['fi-6']));
    expect(assessed.reviewed).toEqual([dropped]);
    expect(assessed.inPlay).toEqual([]);
  });

  it('an active item both assessed here and in play coming in lands in BOTH groups', () => {
    const working = item('fi-7', 'active', '2026-07-12T15:30:00Z', 's1');
    const result = eligibility([working], s2, new Set(['fi-7']));
    expect(result.reviewed).toEqual([working]);
    expect(result.inPlay).toEqual([working]);
  });

  it('an origin id missing from the map falls back to the created-date rule', () => {
    // The origin session was deleted (or not fetched): unknown origin, same
    // fallback as a null origin. Created on the day -> inPlay; created after -> not.
    const orphanSameDay = item('fi-8', 'active', '2026-07-12T18:00:00Z', 's-gone');
    const orphanLater = item('fi-9', 'active', '2026-07-13T18:00:00Z', 's-gone');
    expect(eligibility([orphanSameDay, orphanLater], s1).inPlay).toEqual([orphanSameDay]);
  });

  it('orders reviewed items by creation time', () => {
    const older = item('fi-b', 'achieved', '2026-07-10T10:00:00Z', 's1');
    const newer = item('fi-a', 'active', '2026-07-12T15:30:00Z', 's1');
    const result = eligibility([newer, older], s2, new Set(['fi-a', 'fi-b']));
    expect(result.reviewed.map((i) => i.id)).toEqual(['fi-b', 'fi-a']);
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
  /**
   * What the import loop actually collects: an /api/import-session body,
   * nothing else. driverName is the route's — `drivers.name` read back off the
   * row the session was filed under — never the name column of the CSV row
   * that produced the request. Same driver either way; not always the same
   * string, and only the DB one matches the /days/[id] page the link opens.
   */
  const imported = (
    sessionId: string,
    trackDayId: string | null | undefined,
    driverName: string
  ) => ({
    sessionId,
    trackDayId,
    driverName,
    message: 'Session imported successfully',
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
    // The name is what distinguishes the links; it is raw drivers.name here,
    // and the panel runs it through formatDriverName like every other name in
    // the app. src/components/import/__tests__/CsvImport.test.tsx covers the
    // rendered chip, including the case where the CSV spelled it differently.
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
