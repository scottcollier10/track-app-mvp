import { cleanLaps } from '../analytics-v2';

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
