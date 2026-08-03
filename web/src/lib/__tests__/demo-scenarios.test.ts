import {
  weekendDate,
  SCENARIOS,
  scenarioSessions,
  toStudentHistory,
} from '../../../scripts/seed/demo-scenarios';
import { evaluateStudent } from '@/lib/analytics-v2';

describe('weekendDate', () => {
  // Wed 2026-07-22. Most recent Saturday = 2026-07-18.
  const now = new Date('2026-07-22T12:00:00Z');

  it('weeksAgo 0, sat = most recent Saturday at the given UTC hour', () => {
    expect(weekendDate(now, 0, 'sat', 17)).toBe('2026-07-18T17:00:00.000Z');
  });

  it('weeksAgo 0, sun = day after that Saturday', () => {
    expect(weekendDate(now, 0, 'sun', 17)).toBe('2026-07-19T17:00:00.000Z');
  });

  it('weeksAgo 2 subtracts 14 days', () => {
    expect(weekendDate(now, 2, 'sat', 21)).toBe('2026-07-04T21:00:00.000Z');
  });

  it('when now is Saturday, weeksAgo 0 sat = today', () => {
    const sat = new Date('2026-07-18T15:00:00Z');
    expect(weekendDate(sat, 0, 'sat', 23)).toBe('2026-07-18T23:00:00.000Z');
  });

  it('the session hour moves the clock, never the calendar day', () => {
    const hours = [17, 19, 21, 23];
    for (const h of hours) {
      expect(weekendDate(now, 1, 'sun', h).slice(0, 10)).toBe('2026-07-12');
    }
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

describe('day shape', () => {
  const now = new Date('2026-07-22T12:00:00Z');

  it('every day has at least one session, in strictly ascending hour order', () => {
    // dayDate reads sessions[0]; out-of-order hours would date a day off its
    // second session, and the day page's "Session N" would disagree with the seed.
    for (const s of SCENARIOS) {
      expect(s.days.length).toBeGreaterThan(0);
      for (const day of s.days) {
        expect(day.sessions.length).toBeGreaterThan(0);
        const hours = day.sessions.map(x => x.hourUtc);
        expect(hours).toEqual([...hours].sort((a, b) => a - b));
        expect(new Set(hours).size).toBe(hours.length);
      }
    }
  });

  it('every session hour is inside the 17-23 UTC same-local-date window', () => {
    for (const { session } of SCENARIOS.flatMap(scenarioSessions)) {
      expect(session.hourUtc).toBeGreaterThanOrEqual(17);
      expect(session.hourUtc).toBeLessThanOrEqual(23);
    }
  });

  it('days are chronological, oldest first, and never repeat a (week, weekday, track)', () => {
    for (const s of SCENARIOS) {
      const starts = s.days.map(d => weekendDate(now, d.weeksAgo, d.day, d.sessions[0].hourUtc));
      expect(starts).toEqual([...starts].sort());
      const keys = s.days.map(d => `${d.weeksAgo}/${d.day}/${d.trackName}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('scenarioSessions flattens days in order and toStudentHistory agrees with it', () => {
    for (const s of SCENARIOS) {
      const flat = scenarioSessions(s);
      const history = toStudentHistory(s, now);
      expect(history.sessions).toHaveLength(flat.length);
      history.sessions.forEach((sess, i) => {
        expect(sess.lapTimesMs).toBe(flat[i].session.lapTimesMs);
        expect(sess.trackId).toBe(flat[i].day.trackName);
      });
      // Flattened order is chronological, which is what evaluateStudent's
      // "latest session" depends on.
      const dates = history.sessions.map(x => x.date);
      expect(dates).toEqual([...dates].sort());
    }
  });

  const byName = (name: string) => {
    const s = SCENARIOS.find(x => x.name === name);
    if (!s) throw new Error(`no scenario ${name}`);
    return s;
  };

  it('Kai Garcia fades in the LAST session of his LATEST day', () => {
    const kai = byName('Kai Garcia');
    expect(kai.days).toHaveLength(2);
    expect(kai.days.map(d => d.sessions.length)).toEqual([4, 4]);
    const flat = scenarioSessions(kai);
    const latestDay = kai.days[kai.days.length - 1];
    expect(flat[flat.length - 1].session).toBe(latestDay.sessions[latestDay.sessions.length - 1]);
  });

  it('Elena Ross runs a two-day weekend that is two separate day rows', () => {
    const elena = byName('Elena Ross');
    expect(elena.days).toHaveLength(3);
    const weekend = elena.days.filter(d => d.weeksAgo === 0);
    expect(weekend.map(d => d.day)).toEqual(['sat', 'sun']);
    expect(weekend[0].trackName).toBe(weekend[1].trackName);
  });

  it('Jordan Lee is the n=1 check: one day, two short sessions', () => {
    const jordan = byName('Jordan Lee');
    expect(jordan.days).toHaveLength(1);
    expect(jordan.days[0].sessions).toHaveLength(2);
    for (const sess of jordan.days[0].sessions) {
      expect(sess.lapTimesMs.length).toBeLessThanOrEqual(5);
    }
  });

  it('Sam Whitaker is the control: flat days, no notes, no representativeness flags', () => {
    const sam = byName('Sam Whitaker');
    expect(sam.days).toHaveLength(3);
    for (const day of sam.days) {
      expect(day.notes).toBeUndefined();
      for (const sess of day.sessions) {
        expect(sess.representativeness).toBeUndefined();
        expect(sess.representativenessNote).toBeUndefined();
      }
    }
  });

  it('the cast exercises both representativeness flags, and only with a note', () => {
    const flagged = SCENARIOS.flatMap(scenarioSessions)
      .map(x => x.session)
      .filter(x => x.representativeness !== undefined);
    expect(flagged.map(x => x.representativeness).sort()).toEqual([
      'not_representative',
      'partial',
    ]);
    for (const sess of flagged) expect(sess.representativenessNote).toBeTruthy();
    // A note without a flag would render nowhere.
    const noteOnly = SCENARIOS.flatMap(scenarioSessions)
      .map(x => x.session)
      .filter(x => x.representativenessNote !== undefined && x.representativeness === undefined);
    expect(noteOnly).toEqual([]);
  });
});
