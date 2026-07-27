import { weekendDate } from '../../../scripts/seed/demo-scenarios';

describe('weekendDate', () => {
  // Wed 2026-07-22. Most recent Saturday = 2026-07-18.
  const now = new Date('2026-07-22T12:00:00Z');

  it('weeksAgo 0, sat = most recent Saturday at 10:00 UTC', () => {
    expect(weekendDate(now, 0, 'sat')).toBe('2026-07-18T10:00:00.000Z');
  });

  it('weeksAgo 0, sun = day after that Saturday', () => {
    expect(weekendDate(now, 0, 'sun')).toBe('2026-07-19T10:00:00.000Z');
  });

  it('weeksAgo 2 subtracts 14 days', () => {
    expect(weekendDate(now, 2, 'sat')).toBe('2026-07-04T10:00:00.000Z');
  });

  it('when now is Saturday, weeksAgo 0 sat = today', () => {
    const sat = new Date('2026-07-18T15:00:00Z');
    expect(weekendDate(sat, 0, 'sat')).toBe('2026-07-18T10:00:00.000Z');
  });
});
