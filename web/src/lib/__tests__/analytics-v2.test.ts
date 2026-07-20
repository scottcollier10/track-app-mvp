import { cleanLaps, sessionConsistencySeconds, sessionFadeSeconds } from '../analytics-v2';

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
