import {
  buildSeedSql,
  dayDate,
  dayStartIso,
  dayUuid,
  driverUuid,
  sessionUuid,
  TRACK_TIMEZONES,
} from '../../../scripts/seed/generate-demo-seed';
import { SCENARIOS, scenarioSessions } from '../../../scripts/seed/demo-scenarios';

describe('uuid helpers', () => {
  it('are stable and namespaced', () => {
    expect(driverUuid(1)).toBe('dd000000-0000-4000-a000-000000000001');
    expect(sessionUuid(2, 3)).toBe('dd000000-0002-4000-a000-000000000003');
  });

  it('gives days their own namespace, never colliding with a session id', () => {
    expect(dayUuid(2, 3)).toBe('dd000000-0002-4000-b000-000000000003');
    expect(dayUuid(2, 3)).not.toBe(sessionUuid(2, 3));
  });
});

describe('dayStartIso', () => {
  const now = new Date('2026-07-22T12:00:00Z');

  it('is the FIRST session of the day, not the last', () => {
    const day = {
      weeksAgo: 0,
      day: 'sat' as const,
      trackName: 'Laguna Seca',
      sessions: [{ hourUtc: 17, lapTimesMs: [1] }, { hourUtc: 23, lapTimesMs: [1] }],
    };
    expect(dayStartIso(day, now)).toBe('2026-07-18T17:00:00.000Z');
  });
});

describe('dayDate', () => {
  it('buckets by TRACK-LOCAL date, not the UTC prefix of the timestamp', () => {
    // 02:00 UTC is 19:00 the PREVIOUS day in America/Los_Angeles.
    expect(dayDate('2026-07-19T02:00:00.000Z', 'Laguna Seca')).toBe('2026-07-18');
    expect(dayDate('2026-07-18T17:00:00.000Z', 'Laguna Seca')).toBe('2026-07-18');
  });

  it('covers every track the cast uses', () => {
    for (const s of SCENARIOS) {
      for (const day of s.days) {
        expect(TRACK_TIMEZONES[day.trackName]).toBeTruthy();
      }
    }
  });

  it('throws on an unmapped track rather than silently bucketing by UTC', () => {
    expect(() => dayDate('2026-07-18T17:00:00.000Z', 'Barber')).toThrow(/TRACK_TIMEZONES/);
  });
});

describe('buildSeedSql', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const sql = buildSeedSql(SCENARIOS, 'coach@example.com', now);
  const lines = sql.split('\n');
  const dayInserts = lines.filter(l => l.startsWith('INSERT INTO track_days'));
  const sessionInserts = lines.filter(l => l.startsWith('INSERT INTO sessions'));

  it('is deterministic for a fixed now', () => {
    expect(buildSeedSql(SCENARIOS, 'coach@example.com', now)).toBe(sql);
  });

  it('resolves coach by email, never a hard-coded id', () => {
    expect(sql).toContain("email = 'coach@example.com'");
    expect(sql).toContain('RAISE EXCEPTION'); // coach + track guards
  });

  it('is transactional and idempotent', () => {
    expect(sql.trim().startsWith('BEGIN;')).toBe(true);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');        // drivers, sessions
    expect(sql).toContain('ON CONFLICT (driver_id) DO UPDATE'); // driver_profiles
    expect(sql).toContain('DELETE FROM laps WHERE session_id IN'); // lap refresh
  });

  it('seeds every scenario with coach_id and correct totals', () => {
    for (const s of SCENARIOS) {
      expect(sql).toContain(s.name);
      expect(sql).toContain(s.email);
    }
    const kai = SCENARIOS[0];
    const flat = scenarioSessions(kai);
    const latest = flat[flat.length - 1].session;
    const total = latest.lapTimesMs.reduce((a, b) => a + b, 0);
    const best = Math.min(...latest.lapTimesMs);
    expect(sql).toContain(String(total));
    expect(sql).toContain(String(best));
  });

  it('counts flattened sessions, not days, in driver_profiles.total_sessions', () => {
    const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
    expect(sql).toContain(
      `INSERT INTO driver_profiles (driver_id, experience_level, total_sessions) VALUES ` +
      `('${driverUuid(elena.n)}', 'advanced', ${scenarioSessions(elena).length})`,
    );
  });

  it('escapes single quotes in the coach email', () => {
    const escaped = buildSeedSql(SCENARIOS, "o'brien@example.com", now);
    expect(escaped).toContain("o''brien@example.com");
    expect(escaped).not.toContain("'o'brien");
  });

  it('removes stale demo sessions not in the current set', () => {
    expect(sql).toContain('DELETE FROM sessions WHERE driver_id IN');
    expect(sql).toContain('AND id NOT IN');
  });

  describe('ordered clear', () => {
    const at = (needle: string) => {
      const i = sql.indexOf(needle);
      expect(i).toBeGreaterThan(-1);
      return i;
    };

    it('drops focus_items (cascading assessments) BEFORE deleting stale sessions', () => {
      // focus_item_assessments.session_id is a plain FK: a live assessment
      // blocks the session delete below it.
      expect(at('DELETE FROM focus_items WHERE driver_id IN')).toBeLessThan(
        at('DELETE FROM sessions WHERE driver_id IN'),
      );
    });

    it('unhooks sessions from their days before deleting the days', () => {
      expect(at('UPDATE sessions SET track_day_id = NULL WHERE driver_id IN')).toBeLessThan(
        at('DELETE FROM track_days WHERE driver_id IN'),
      );
    });

    it('deletes ALL demo track_days wholesale — no id filter', () => {
      const del = lines.find(l => l.startsWith('DELETE FROM track_days'));
      expect(del).toBeDefined();
      expect(del).not.toContain('NOT IN');
      const driverIds = SCENARIOS.map(s => `'${driverUuid(s.n)}'`).join(', ');
      expect(del).toBe(`DELETE FROM track_days WHERE driver_id IN (${driverIds});`);
    });

    it('clears the days before inserting the new ones', () => {
      expect(at('DELETE FROM track_days WHERE driver_id IN')).toBeLessThan(
        at('INSERT INTO track_days'),
      );
    });
  });

  describe('track_days emission', () => {
    it('emits one plain INSERT per day, with NO ON CONFLICT', () => {
      const expected = SCENARIOS.reduce((n, s) => n + s.days.length, 0);
      expect(dayInserts).toHaveLength(expected);
      for (const line of dayInserts) expect(line).not.toContain('ON CONFLICT');
      expect(sql).toContain('PLAIN INSERTs with NO ON CONFLICT');
    });

    it('dates each day from localDateForTimezone of its first session', () => {
      // Wed 2026-07-22 -> most recent Sat 07-18, Sun 07-19; a week back 07-11 / 07-12.
      const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
      const dates = elena.days.map((_, i) => {
        const line = dayInserts.find(l => l.includes(`'${dayUuid(elena.n, i + 1)}'`))!;
        return line.match(/, '(\d{4}-\d{2}-\d{2})', /)![1];
      });
      expect(dates).toEqual(['2026-07-04', '2026-07-18', '2026-07-19']);

      const kai = SCENARIOS.find(s => s.name === 'Kai Garcia')!;
      expect(dayInserts.find(l => l.includes(`'${dayUuid(kai.n, 1)}'`))).toContain("'2026-07-11'");
      expect(dayInserts.find(l => l.includes(`'${dayUuid(kai.n, 2)}'`))).toContain("'2026-07-18'");
    });

    it('carries day notes, and NULL where there are none', () => {
      const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
      const sunday = dayInserts.find(l => l.includes(`'${dayUuid(elena.n, 3)}'`))!;
      expect(sunday).toContain(`'${elena.days[2].notes}'`);
      const saturday = dayInserts.find(l => l.includes(`'${dayUuid(elena.n, 2)}'`))!;
      expect(saturday).toMatch(/, NULL\);$/);
    });

    it('resolves the track by name, never a hard-coded id', () => {
      for (const line of dayInserts) {
        expect(line).toContain('(SELECT id FROM tracks WHERE name = ');
      }
    });
  });

  describe('sessions carry their day', () => {
    it('names track_day_id in both the column list and the DO UPDATE SET', () => {
      for (const line of sessionInserts) {
        expect(line).toContain('INSERT INTO sessions (id, driver_id, track_day_id, track_id,');
        expect(line).toContain('track_day_id = EXCLUDED.track_day_id');
      }
    });

    it('points every session at a day id that was actually emitted', () => {
      const emittedDayIds = new Set(
        SCENARIOS.flatMap(s => s.days.map((_, i) => dayUuid(s.n, i + 1))),
      );
      expect(sessionInserts).toHaveLength(
        SCENARIOS.reduce((n, s) => n + scenarioSessions(s).length, 0),
      );
      for (const line of sessionInserts) {
        const dayId = line.match(/VALUES \('[^']+', '[^']+', '([^']+)'/)![1];
        expect(emittedDayIds.has(dayId)).toBe(true);
      }
    });

    it('groups each day s sessions under that day s id, in day order', () => {
      const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
      let n = 0;
      elena.days.forEach((day, dayIdx) => {
        for (const _sess of day.sessions) {
          n += 1;
          const line = sessionInserts.find(l => l.includes(`'${sessionUuid(elena.n, n)}'`))!;
          expect(line).toContain(`'${dayUuid(elena.n, dayIdx + 1)}'`);
        }
      });
      expect(n).toBe(scenarioSessions(elena).length);
    });

    it('emits representativeness and its note always, NULL included, and updates both', () => {
      const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
      // Sunday's second session is the 'partial' one (index 10 flattened).
      const flagged = sessionInserts.find(l => l.includes(`'${sessionUuid(elena.n, 10)}'`))!;
      expect(flagged).toContain(`'partial', '${elena.days[2].sessions[1].representativenessNote}'`);
      const unflagged = sessionInserts.find(l => l.includes(`'${sessionUuid(elena.n, 1)}'`))!;
      expect(unflagged).toContain(`'manual', NULL, NULL)`);
      for (const line of sessionInserts) {
        expect(line).toContain('representativeness = EXCLUDED.representativeness');
        expect(line).toContain('representativeness_note = EXCLUDED.representativeness_note');
      }
    });
  });
});
