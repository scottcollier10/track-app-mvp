/**
 * Tests for formatting utilities
 */

import {
  formatLapTime,
  formatDuration,
  formatDelta,
  calculateDelta,
  formatTrackLength,
} from '@/lib/utils/formatters';

describe('formatLapTime', () => {
  it('formats lap time under 1 minute', () => {
    expect(formatLapTime(45123)).toBe('45.123');
  });

  it('formats lap time over 1 minute', () => {
    expect(formatLapTime(92500)).toBe('1:32.500');
  });

  it('formats lap time over 2 minutes', () => {
    expect(formatLapTime(125000)).toBe('2:05.000');
  });

  it('handles zero', () => {
    expect(formatLapTime(0)).toBe('0.000');
  });
});

describe('formatDuration', () => {
  it('formats duration under 1 minute', () => {
    expect(formatDuration(45000)).toBe('00:45');
  });

  it('formats duration over 1 minute', () => {
    expect(formatDuration(92500)).toBe('01:32');
  });

  it('formats duration over 1 hour', () => {
    expect(formatDuration(3725000)).toBe('62:05');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('00:00');
  });
});

describe('formatDelta', () => {
  it('formats positive delta with plus sign', () => {
    expect(formatDelta(1500)).toBe('+1.500');
  });

  it('formats negative delta with minus sign', () => {
    expect(formatDelta(-2300)).toBe('-2.300');
  });

  it('formats zero delta with plus sign', () => {
    expect(formatDelta(0)).toBe('+0.000');
  });
});

describe('calculateDelta', () => {
  it('calculates positive delta (slower)', () => {
    expect(calculateDelta(95000, 92000)).toBe(3000);
  });

  it('calculates negative delta (faster)', () => {
    expect(calculateDelta(90000, 92000)).toBe(-2000);
  });

  it('calculates zero delta (same)', () => {
    expect(calculateDelta(92000, 92000)).toBe(0);
  });
});

describe('formatTrackLength', () => {
  it('formats track length from meters to miles', () => {
    expect(formatTrackLength(3602)).toBe('2.24 mi');
  });

  it('handles zero', () => {
    expect(formatTrackLength(0)).toBe('0.00 mi');
  });

  it('formats large distances', () => {
    expect(formatTrackLength(8000)).toBe('4.97 mi');
  });
});
