import {
  cleanLaps,
  sessionConsistencySeconds,
  sessionFadeSeconds,
  consistencyBaseline,
  isOffConsistencyBaseline,
  isRegressedVsTrackPB,
  idealLapMs,
  gapToIdealSeconds,
  evaluateStudent,
} from '../analytics-v2';
import type { LapSectors, StudentHistory } from '../analytics-v2';

describe('cleanLaps', () => {
  it('drops null, zero, and negative lap times', () => {
    expect(cleanLaps([90000, 0, -5, null as unknown as number, 90500])).toEqual([90000, 90500]);
  });
  it('drops out/in/pit laps slower than 1.25x the median', () => {
    expect(cleanLaps([90000, 90500, 91000, 91500, 92000, 180000])).toEqual([90000, 90500, 91000, 91500, 92000]);
  });
  it('returns [] for empty or all-invalid input', () => {
    expect(cleanLaps([])).toEqual([]);
    expect(cleanLaps([0, -1, null as unknown as number])).toEqual([]);
  });
});

describe('sessionConsistencySeconds', () => {
  it('returns sample std-dev of clean laps in seconds', () => {
    const s = sessionConsistencySeconds([90000, 90500, 91000, 91500, 92000]);
    expect(s).not.toBeNull();
    expect(s!).toBeCloseTo(0.79, 2);
  });
  it('returns 0 for identical laps', () => {
    expect(sessionConsistencySeconds([90000, 90000, 90000])).toBe(0);
  });
  it('returns null with fewer than 2 clean laps', () => {
    expect(sessionConsistencySeconds([90000])).toBeNull();
    expect(sessionConsistencySeconds([])).toBeNull();
  });
});

describe('sessionFadeSeconds', () => {
  it('reports positive seconds when the driver slows late', () => {
    const laps = [90000, 90000, 90000, 90500, 91000, 91500, 91500, 91500];
    const f = sessionFadeSeconds(laps);
    expect(f).not.toBeNull();
    expect(f!).toBeGreaterThan(1);
  });
  it('reports negative seconds when the driver builds pace', () => {
    const laps = [92000, 91500, 91000, 90500, 90000, 90000, 90000, 90000];
    expect(sessionFadeSeconds(laps)!).toBeLessThan(0);
  });
  it('returns null with fewer than 6 clean laps', () => {
    expect(sessionFadeSeconds([90000, 90000, 90000, 90000, 90000])).toBeNull();
  });
});

describe('consistencyBaseline', () => {
  it('is null below the minimum prior-session count', () => {
    expect(consistencyBaseline([0.3, 0.35])).toBeNull();
  });
  it('returns mean and upper/lower control limits', () => {
    const b = consistencyBaseline([0.30, 0.32, 0.34, 0.28])!;
    expect(b.mean).toBeCloseTo(0.31, 2);
    expect(b.upper).toBeGreaterThan(b.mean);
    expect(b.lower).toBeLessThan(b.mean);
  });
});

describe('isOffConsistencyBaseline', () => {
  it('flags a session wider than the upper control limit', () => {
    expect(isOffConsistencyBaseline(0.9, [0.30, 0.32, 0.34, 0.28])).toBe(true);
  });
  it('does not flag a normal session', () => {
    expect(isOffConsistencyBaseline(0.33, [0.30, 0.32, 0.34, 0.28])).toBe(false);
  });
  it('ignores breakouts smaller than the min delta (guards sigma~0)', () => {
    expect(isOffConsistencyBaseline(0.31, [0.30, 0.30, 0.30])).toBe(false);
  });
});

describe('isRegressedVsTrackPB', () => {
  it('flags when session best is >1% slower than the prior track PB', () => {
    expect(isRegressedVsTrackPB(92000, [90000, 90500])).toBe(true);
  });
  it('does not flag within 1% of PB', () => {
    expect(isRegressedVsTrackPB(90500, [90000, 90500])).toBe(false);
  });
  it('does not flag when there is no prior best at this track', () => {
    expect(isRegressedVsTrackPB(92000, [])).toBe(false);
  });
});

describe('idealLapMs', () => {
  it('sums the fastest split per sector across laps', () => {
    const laps: LapSectors[] = [
      { '1': 30000, '2': 31000, '3': 29000 },
      { '1': 29500, '2': 30500, '3': 29500 },
    ];
    expect(idealLapMs(laps)).toBe(89000);
  });
  it('returns null on empty input', () => {
    expect(idealLapMs([])).toBeNull();
  });
  it('returns null when every lap is null or empty', () => {
    expect(idealLapMs([null, undefined, {}])).toBeNull();
  });
  it('returns null when a sector never has a positive split', () => {
    const laps: LapSectors[] = [
      { '1': 30000, '2': 0 },
      { '1': 29500, '2': -1 },
    ];
    expect(idealLapMs(laps)).toBeNull();
  });
  it('ignores non-positive splits for an otherwise-covered sector', () => {
    const laps: LapSectors[] = [
      { '1': 30000, '2': 31000 },
      { '1': 0, '2': 30500 },
    ];
    // sector 1 best = 30000, sector 2 best = 30500
    expect(idealLapMs(laps)).toBe(60500);
  });
});

describe('gapToIdealSeconds', () => {
  it('returns fastest actual lap minus ideal in seconds', () => {
    const laps: LapSectors[] = [
      { '1': 30000, '2': 31000, '3': 29000 },
      { '1': 29500, '2': 30500, '3': 29500 },
    ];
    // ideal = 89000, fastest actual = 89500 -> gap 0.5s
    expect(gapToIdealSeconds(89500, laps)!).toBeCloseTo(0.5, 2);
  });
  it('returns null when sector data is absent', () => {
    expect(gapToIdealSeconds(89500, [])).toBeNull();
    expect(gapToIdealSeconds(89500, [null, {}])).toBeNull();
  });
  it('returns null when no valid fastest lap is given', () => {
    const laps: LapSectors[] = [{ '1': 30000, '2': 31000, '3': 29000 }];
    expect(gapToIdealSeconds(null, laps)).toBeNull();
    expect(gapToIdealSeconds(0, laps)).toBeNull();
  });
});

const base: StudentHistory = { runGroup: 'beginner', sessions: [] };

// A session where the driver clearly slows late (fade > 0.5s) with >=6 clean laps.
const fadingLaps = [90000, 90000, 90000, 90500, 91000, 91500, 91500, 91500];
// A steady session with tight, non-fading laps.
const steadyLaps = [90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000];

describe('evaluateStudent', () => {
  it('returns building-baseline state and fade-only for a thin-data student', () => {
    const h: StudentHistory = { ...base, sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: fadingLaps },
    ]};
    const r = evaluateStudent(h);
    expect(r.baselineState).toBe('building');
    expect(r.flags.map(f => f.kind)).toContain('faded');
    expect(r.flags.map(f => f.kind)).not.toContain('off_baseline');
  });

  it('ranks a multi-flag sustained student above a single-flag student', () => {
    // Single-flag: one modest, non-sustained fade in the latest session; no prior fade, no regression.
    const single: StudentHistory = { ...base, sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: steadyLaps },
      { date: '2026-01-02', trackId: 't1', bestLapMs: 90000, lapTimesMs: fadingLaps },
    ]};

    // Multi-flag sustained: track PB set early, then progressively slower bests (sustained regression),
    // and the latest two sessions both fade hard (sustained fade).
    const multi: StudentHistory = { ...base, sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: steadyLaps },
      { date: '2026-01-02', trackId: 't1', bestLapMs: 93000, lapTimesMs: fadingLaps },
      { date: '2026-01-03', trackId: 't1', bestLapMs: 94000, lapTimesMs: fadingLaps },
    ]};

    const singleScore = evaluateStudent(single).severityScore;
    const multiScore = evaluateStudent(multi).severityScore;

    expect(evaluateStudent(single).flags.length).toBe(1);
    expect(evaluateStudent(multi).flags.length).toBeGreaterThan(1);
    expect(multiScore).toBeGreaterThan(singleScore);
  });

  it('never measures the regression gap against a 0 best lap — 0 is not a PB', () => {
    // A stored best_lap_ms of 0 is reachable (csv-parser takes Math.min over
    // UNFILTERED times). The prior-bests list is filtered by isCountableLapMs
    // BEFORE Math.min runs, and that is the whole point: with a bare `!== null`
    // the flag still fires — isRegressedVsTrackPB drops the 0 on its own — but
    // the gap it reports is measured from zero, so the coach reads "Best lap
    // 93.0s off your track PB" and the severity score inherits it.
    const h: StudentHistory = { ...base, sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 0, lapTimesMs: steadyLaps },
      { date: '2026-01-02', trackId: 't1', bestLapMs: 91000, lapTimesMs: steadyLaps },
      { date: '2026-01-03', trackId: 't1', bestLapMs: 93000, lapTimesMs: steadyLaps },
    ]};

    const regressed = evaluateStudent(h).flags.find((f) => f.kind === 'regressed');

    expect(regressed).toBeDefined();
    expect(regressed!.deltaSeconds).toBeCloseTo(2.0, 3); // 93.000 vs the 91.000 PB
    expect(regressed!.why).toBe('Best lap 2.0s off your track PB');
  });
});

describe('evaluateStudent readiness', () => {
  // Prior sessions with a moderate, consistent spread (~0.79s std-dev each).
  const spreadLaps = [90000, 90500, 91000, 91500, 92000, 92000, 92000, 92000];
  // Latest session: tighter than prior mean AND holds pace late (no fade).
  const tightSteadyLaps = [90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000];

  it('returns ready with a readyWhy for a settled, tightening student', () => {
    const h: StudentHistory = { runGroup: 'beginner', sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-02', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-03', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-04', trackId: 't1', bestLapMs: 90000, lapTimesMs: tightSteadyLaps },
    ]};
    const r = evaluateStudent(h);
    expect(r.ready).toBe(true);
    expect(r.readyWhy).not.toBeNull();
  });

  it('is not ready for a thin-data student', () => {
    const h: StudentHistory = { runGroup: 'beginner', sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: tightSteadyLaps },
    ]};
    const r = evaluateStudent(h);
    expect(r.ready).toBe(false);
    expect(r.readyWhy).toBeNull();
  });

  it('is not ready when the latest session is regressing/fading', () => {
    const h: StudentHistory = { runGroup: 'beginner', sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-02', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-03', trackId: 't1', bestLapMs: 90000, lapTimesMs: spreadLaps },
      { date: '2026-01-04', trackId: 't1', bestLapMs: 90000, lapTimesMs: fadingLaps },
    ]};
    const r = evaluateStudent(h);
    expect(r.ready).toBe(false);
    expect(r.readyWhy).toBeNull();
  });
});
