import { weekendDate, SCENARIOS, toStudentHistory } from '../../../scripts/seed/demo-scenarios';
import { evaluateStudent } from '@/lib/analytics-v2';

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

describe('demo scenarios trip exactly their intended flags', () => {
  const now = new Date('2026-07-22T12:00:00Z');

  it('has 6 scenarios with unique n, names, and @trackapp.demo emails', () => {
    expect(SCENARIOS).toHaveLength(6);
    expect(new Set(SCENARIOS.map(s => s.n)).size).toBe(6);
    for (const s of SCENARIOS) expect(s.email).toMatch(/@trackapp\.demo$/);
  });

  it.each(SCENARIOS.map(s => [s.name, s] as const))('%s', (_name, s) => {
    const result = evaluateStudent(toStudentHistory(s, now));
    expect(result.flags.map(f => f.kind).sort()).toEqual([...s.expect.flagKinds].sort());
    if (s.expect.sustained !== undefined) {
      expect(result.flags[0]?.sustained).toBe(s.expect.sustained);
    }
    expect(result.baselineState).toBe(s.expect.baselineState);
    expect(result.ready).toBe(s.expect.ready);
  });

  it('covers all six dashboard states', () => {
    const kinds = SCENARIOS.flatMap(s => s.expect.flagKinds);
    expect(kinds).toEqual(expect.arrayContaining(['faded', 'regressed', 'off_baseline']));
    expect(SCENARIOS.some(s => s.expect.ready)).toBe(true);
    expect(SCENARIOS.some(s => s.expect.baselineState === 'building' && !s.expect.flagKinds.length)).toBe(true);
    expect(SCENARIOS.some(s => s.expect.baselineState === 'ok' && !s.expect.flagKinds.length && !s.expect.ready)).toBe(true);
  });
});
