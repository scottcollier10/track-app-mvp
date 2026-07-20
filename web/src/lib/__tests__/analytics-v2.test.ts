import {
  cleanLaps,
  sessionConsistencySeconds,
  sessionFadeSeconds,
  consistencyBaseline,
  isOffConsistencyBaseline,
} from '../analytics-v2';

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
