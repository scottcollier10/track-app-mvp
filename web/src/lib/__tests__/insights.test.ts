/**
 * Tests for session insights calculations
 */

import {
  getSessionInsightsFromMs,
  getScoreLabel,
  INSIGHT_HELPERS,
} from '../insights';

describe('getSessionInsightsFromMs', () => {
  describe('normal session scenarios', () => {
    it('calculates insights for normal 8-lap session with varying times', () => {
      // Lap times around 90 seconds with some variation
      const lapTimes = [
        92000, // 1:32.000
        91500, // 1:31.500
        90800, // 1:30.800
        91200, // 1:31.200
        90500, // 1:30.500
        91800, // 1:31.800
        90200, // 1:30.200
        90900, // 1:30.900
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).not.toBeNull();
      expect(result.consistencyScore).toBeGreaterThan(90); // Should be very consistent
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.drivingBehaviorScore).toBeGreaterThan(70);
      expect(result.paceTrendLabel).toMatch(/Improving|Fading|Consistent/);
      expect(result.paceTrendDetail).toBeDefined();
      expect(typeof result.paceTrendDetail).toBe('string');
    });

    it('handles session with all identical lap times (consistency = 100)', () => {
      const lapTimes = [90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).toBe(100);
      expect(result.drivingBehaviorScore).toBe(100);
      expect(result.paceTrendLabel).toBe('Consistent →');
      expect(result.paceTrendDetail).toContain('stable');
    });

    it('handles session with one outlier lap (2x slower)', () => {
      const lapTimes = [
        90000, 90500, 91000, 180000, // Outlier - 2x slower
        90200, 90800, 91200, 90600,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).not.toBeNull();
      expect(result.consistencyScore).toBeLessThan(80); // Lower due to outlier
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toBeDefined();
      expect(result.paceTrendDetail).toBeDefined();
    });
  });

  describe('pace trend detection', () => {
    it('detects improving pace (first 3 > last 3)', () => {
      const lapTimes = [
        95000, 94000, 93000, // First 3: avg 94000
        92000, 91000, 90000, // Last 3: avg 91000
        91500, 90500,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendLabel).toContain('Improving');
      expect(result.paceTrendDetail).toContain('faster');
      expect(result.paceTrendDetail).toMatch(/\d+\.\d+s/); // Should contain time difference
    });

    it('detects declining pace (first 3 < last 3)', () => {
      const lapTimes = [
        90000, 91000, 90500, // First 3: avg 90500
        92000, 93000, 94000, // Last 3: avg 93000
        92500, 93500,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendLabel).toContain('Fading');
      expect(result.paceTrendDetail).toContain('slowed');
      expect(result.paceTrendDetail).toMatch(/\d+\.\d+s/); // Should contain time difference
    });

    it('detects consistent pace when first 3 equals last 3', () => {
      const lapTimes = [
        90000, 91000, 92000, // First 3: avg 91000
        91500, 90500,
        92000, 91000, 90000, // Last 3: avg 91000
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendLabel).toContain('Consistent');
      expect(result.paceTrendDetail).toContain('stable');
    });
  });

  describe('edge cases', () => {
    it('handles session with less than 6 laps gracefully', () => {
      const lapTimes = [90000, 91000, 90500, 91500, 90200];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendLabel).toBe('Not Enough Data');
      expect(result.paceTrendDetail).toBe(INSIGHT_HELPERS.paceTrend);
      // Consistency should still work with 2+ laps
      expect(result.consistencyScore).not.toBeNull();
      expect(result.drivingBehaviorScore).not.toBeNull();
    });

    it('handles empty array', () => {
      const lapTimes: number[] = [];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).toBeNull();
      expect(result.drivingBehaviorScore).toBeNull();
      expect(result.paceTrendLabel).toBe('Not Enough Data');
      expect(result.paceTrendDetail).toBe(INSIGHT_HELPERS.paceTrend);
    });

    it('handles single lap', () => {
      const lapTimes = [90000];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).toBeNull();
      expect(result.drivingBehaviorScore).toBeNull();
      expect(result.paceTrendLabel).toBe('Not Enough Data');
      expect(result.paceTrendDetail).toBe(INSIGHT_HELPERS.paceTrend);
    });

    it('handles two laps', () => {
      const lapTimes = [90000, 91000];

      const result = getSessionInsightsFromMs(lapTimes);

      // Should have consistency and behavior scores with 2 laps
      expect(result.consistencyScore).not.toBeNull();
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toBe('Not Enough Data');
      expect(result.paceTrendDetail).toBe(INSIGHT_HELPERS.paceTrend);
    });

    it('filters out null values in array', () => {
      const lapTimes = [
        95000,
        null as any,
        94000,
        null as any,
        93000,
        92000,
        91000,
        null as any,
        90000,
        90500,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      // Should process only the valid values (7 valid laps)
      expect(result.consistencyScore).not.toBeNull();
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toMatch(/Improving|Fading|Consistent/); // Should have a valid trend
    });

    it('filters out undefined values in array', () => {
      const lapTimes = [
        90000,
        undefined as any,
        91000,
        90500,
        undefined as any,
        91500,
        90200,
        91200,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      // Should process only the valid values
      expect(result.consistencyScore).not.toBeNull();
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toMatch(/Improving|Fading|Consistent/);
    });

    it('filters out zero and negative values', () => {
      const lapTimes = [90000, 0, 91000, -100, 90500, 91500, 90200, 91200];

      const result = getSessionInsightsFromMs(lapTimes);

      // Should process only the positive values
      expect(result.consistencyScore).not.toBeNull();
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toMatch(/Improving|Fading|Consistent/);
    });

    it('handles one fast lap followed by rest slow', () => {
      const lapTimes = [
        70000, // Fast outlier - much faster
        95000, 96000, 95500, 96500, 95200, 96200, 95800,
      ];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).not.toBeNull();
      expect(result.consistencyScore).toBeLessThanOrEqual(90); // Should show some inconsistency with large outlier
      expect(result.drivingBehaviorScore).not.toBeNull();
      expect(result.paceTrendLabel).toMatch(/Improving|Fading|Consistent/);
    });

    it('handles all laps exactly the same with 6+ laps', () => {
      const lapTimes = [90000, 90000, 90000, 90000, 90000, 90000, 90000];

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.consistencyScore).toBe(100);
      expect(result.drivingBehaviorScore).toBe(100);
      expect(result.paceTrendLabel).toBe('Consistent →');
      expect(result.paceTrendDetail).toContain('stable');
    });
  });

  describe('pace trend detail calculations', () => {
    it('calculates correct time difference for improving pace', () => {
      const lapTimes = [
        95000, 94000, 93000, // First 3: avg 94000
        92000, 91000, 90000, // Last 3: avg 91000
      ];
      // Expected difference: 94000 - 91000 = 3000ms = 3.00s

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendDetail).toContain('3.00s');
      expect(result.paceTrendDetail).toContain('faster');
    });

    it('calculates correct time difference for fading pace', () => {
      const lapTimes = [
        90000, 91000, 90500, // First 3: avg 90500
        92000, 93000, 94000, // Last 3: avg 93000
      ];
      // Expected difference: 93000 - 90500 = 2500ms = 2.50s

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendDetail).toContain('2.50s');
      expect(result.paceTrendDetail).toContain('slowed');
    });

    it('handles very small pace differences', () => {
      const lapTimes = [
        90100, 90000, 90200, // First 3: avg 90100
        89900, 90000, 89800, // Last 3: avg 89900
      ];
      // Expected difference: 90100 - 89900 = 200ms = 0.20s

      const result = getSessionInsightsFromMs(lapTimes);

      expect(result.paceTrendDetail).toContain('0.20s');
      expect(result.paceTrendDetail).toContain('faster');
    });
  });
});

describe('getScoreLabel', () => {
  describe('score boundaries', () => {
    it('returns "Excellent" for score of 100', () => {
      const result = getScoreLabel(100);

      expect(result.label).toBe('Excellent');
      expect(result.severity).toBe('excellent');
      expect(result.colorClass).toBe('text-emerald-400');
    });

    it('returns "Excellent" for score of 90', () => {
      const result = getScoreLabel(90);

      expect(result.label).toBe('Excellent');
      expect(result.severity).toBe('excellent');
      expect(result.colorClass).toBe('text-emerald-400');
    });

    it('returns "Strong" for score of 89', () => {
      const result = getScoreLabel(89);

      expect(result.label).toBe('Strong');
      expect(result.severity).toBe('good');
      expect(result.colorClass).toBe('text-green-400');
    });

    it('returns "Strong" for score of 80', () => {
      const result = getScoreLabel(80);

      expect(result.label).toBe('Strong');
      expect(result.severity).toBe('good');
      expect(result.colorClass).toBe('text-green-400');
    });

    it('returns "Needs Work" for score of 79', () => {
      const result = getScoreLabel(79);

      expect(result.label).toBe('Needs Work');
      expect(result.severity).toBe('ok');
      expect(result.colorClass).toBe('text-amber-400');
    });

    it('returns "Needs Work" for score of 75 (mid-range)', () => {
      const result = getScoreLabel(75);

      expect(result.label).toBe('Needs Work');
      expect(result.severity).toBe('ok');
      expect(result.colorClass).toBe('text-amber-400');
    });

    it('returns "Needs Work" for score of 65', () => {
      const result = getScoreLabel(65);

      expect(result.label).toBe('Needs Work');
      expect(result.severity).toBe('ok');
      expect(result.colorClass).toBe('text-amber-400');
    });

    it('returns "Inconsistent" for score of 64', () => {
      const result = getScoreLabel(64);

      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });

    it('returns "Inconsistent" for score of 50 (mid-range)', () => {
      const result = getScoreLabel(50);

      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });

    it('returns "Inconsistent" for score of 0 (edge case)', () => {
      const result = getScoreLabel(0);

      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });
  });

  describe('null and undefined handling', () => {
    it('returns "No Data" for null score', () => {
      const result = getScoreLabel(null);

      expect(result.label).toBe('No Data');
      expect(result.severity).toBe('unknown');
      expect(result.colorClass).toBe('text-gray-400');
    });

    it('returns "Inconsistent" for undefined score (treated as falsy)', () => {
      const result = getScoreLabel(undefined as any);

      // undefined is not strictly === null, so it falls through to the default case
      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });
  });

  describe('edge cases', () => {
    it('handles score of 1 (very low)', () => {
      const result = getScoreLabel(1);

      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });

    it('handles score of 99 (very high)', () => {
      const result = getScoreLabel(99);

      expect(result.label).toBe('Excellent');
      expect(result.severity).toBe('excellent');
      expect(result.colorClass).toBe('text-emerald-400');
    });

    it('handles negative score (should treat as poor)', () => {
      const result = getScoreLabel(-10);

      expect(result.label).toBe('Inconsistent');
      expect(result.severity).toBe('poor');
      expect(result.colorClass).toBe('text-red-400');
    });

    it('handles score above 100 (should treat as excellent)', () => {
      const result = getScoreLabel(150);

      expect(result.label).toBe('Excellent');
      expect(result.severity).toBe('excellent');
      expect(result.colorClass).toBe('text-emerald-400');
    });
  });
});

describe('INSIGHT_HELPERS', () => {
  it('exports consistency helper text', () => {
    expect(INSIGHT_HELPERS.consistency).toBeDefined();
    expect(typeof INSIGHT_HELPERS.consistency).toBe('string');
    expect(INSIGHT_HELPERS.consistency.length).toBeGreaterThan(0);
  });

  it('exports pace trend helper text', () => {
    expect(INSIGHT_HELPERS.paceTrend).toBeDefined();
    expect(typeof INSIGHT_HELPERS.paceTrend).toBe('string');
    expect(INSIGHT_HELPERS.paceTrend.length).toBeGreaterThan(0);
  });

  it('exports behavior helper text', () => {
    expect(INSIGHT_HELPERS.behavior).toBeDefined();
    expect(typeof INSIGHT_HELPERS.behavior).toBe('string');
    expect(INSIGHT_HELPERS.behavior.length).toBeGreaterThan(0);
  });
});
