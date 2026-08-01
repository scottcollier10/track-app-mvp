/**
 * Tests for session insights calculations (honest metrics: std-dev seconds, no /100 composites)
 */

import {
  canClaimConsistency,
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
  MIN_LAPS_FOR_INSIGHTS,
} from '../insights';

describe('MIN_LAPS_FOR_INSIGHTS', () => {
  it('is 6 — the single gate for the interpretive layer', () => {
    expect(MIN_LAPS_FOR_INSIGHTS).toBe(6);
  });
});

describe('canClaimConsistency', () => {
  it('claims at exactly MIN_LAPS_FOR_INSIGHTS countable laps', () => {
    expect(canClaimConsistency(Array(MIN_LAPS_FOR_INSIGHTS).fill(90000))).toBe(true);
    expect(canClaimConsistency(Array(MIN_LAPS_FOR_INSIGHTS - 1).fill(90000))).toBe(false);
  });
});

describe('getSessionInsightsFromMs', () => {
  describe('consistency (std-dev seconds)', () => {
    it('returns 0 for identical lap times', () => {
      const result = getSessionInsightsFromMs([90000, 90000, 90000, 90000, 90000, 90000]);
      expect(result.consistencySeconds).toBe(0);
    });

    it('returns sample std-dev in seconds for a normal 8-lap session', () => {
      const lapTimes = [92000, 91500, 90800, 91200, 90500, 91800, 90200, 90900];
      const result = getSessionInsightsFromMs(lapTimes);
      // sample std-dev of these values is ~0.63s
      expect(result.consistencySeconds).not.toBeNull();
      expect(result.consistencySeconds!).toBeGreaterThan(0.3);
      expect(result.consistencySeconds!).toBeLessThan(1.0);
    });

    it('filters outlier laps (>1.25x median) before computing spread', () => {
      // 180000 is a pit/out lap — clean-lap filter must drop it
      const withOutlier = getSessionInsightsFromMs([
        90000, 90500, 91000, 180000, 90200, 90800, 91200, 90600,
      ]);
      const without = getSessionInsightsFromMs([
        90000, 90500, 91000, 90200, 90800, 91200, 90600,
      ]);
      expect(withOutlier.consistencySeconds).toBeCloseTo(without.consistencySeconds!, 3);
    });

    it('returns null with fewer than 2 valid laps', () => {
      expect(getSessionInsightsFromMs([]).consistencySeconds).toBeNull();
      expect(getSessionInsightsFromMs([90000]).consistencySeconds).toBeNull();
    });

    it('ignores null, undefined, zero and negative values', () => {
      const result = getSessionInsightsFromMs([
        90000, null as any, 0, -100, undefined as any, 91000, 90500,
      ]);
      expect(result.consistencySeconds).not.toBeNull();
      expect(result.consistencySeconds!).toBeGreaterThan(0);
    });
  });

  describe('pace trend (unchanged behavior)', () => {
    it('detects improving pace (first 3 > last 3)', () => {
      const result = getSessionInsightsFromMs([
        95000, 94000, 93000, 92000, 91000, 90000, 91500, 90500,
      ]);
      expect(result.paceTrendLabel).toBe('improving');
      expect(result.paceTrendDetail).toContain('faster');
    });

    it('detects fading pace (first 3 < last 3)', () => {
      const result = getSessionInsightsFromMs([
        90000, 91000, 90500, 92000, 93000, 94000, 92500, 93500,
      ]);
      expect(result.paceTrendLabel).toBe('fading');
      expect(result.paceTrendDetail).toContain('slowed');
    });

    it('treats <1% delta as stable', () => {
      const result = getSessionInsightsFromMs([
        90100, 90000, 90200, 89900, 90000, 89800,
      ]);
      expect(result.paceTrendLabel).toBe('stable');
      expect(result.paceTrendDetail).toContain('stable');
    });

    it('calculates the correct time difference for improving pace', () => {
      const result = getSessionInsightsFromMs([
        95000, 94000, 93000, 92000, 91000, 90000,
      ]);
      expect(result.paceTrendDetail).toContain('3.00s');
    });

    it('reports not enough data under 6 laps', () => {
      const result = getSessionInsightsFromMs([90000, 91000, 90500, 91500, 90200]);
      expect(result.paceTrendLabel).toBe('Not enough data');
      expect(result.paceTrendDetail).toContain('at least 6 laps');
    });
  });

  it('exposes no /100 composite fields', () => {
    const result = getSessionInsightsFromMs([90000, 91000, 90500, 91500, 90200, 90700]);
    expect(result).not.toHaveProperty('consistencyScore');
    expect(result).not.toHaveProperty('drivingBehaviorScore');
  });
});

describe('INSIGHT_HELPERS', () => {
  it('has consistency and paceTrend helpers only (behavior removed)', () => {
    expect(INSIGHT_HELPERS.consistency.length).toBeGreaterThan(0);
    expect(INSIGHT_HELPERS.paceTrend.length).toBeGreaterThan(0);
    expect(INSIGHT_HELPERS).not.toHaveProperty('behavior');
  });
});
