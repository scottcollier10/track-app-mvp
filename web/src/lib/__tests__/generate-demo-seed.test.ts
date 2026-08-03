import { readFileSync } from 'fs';
import {
  buildSeedSql,
  dayDate,
  dayStartIso,
  dayUuid,
  driverUuid,
  sessionUuid,
  verifyScenarios,
  TRACK_TIMEZONES,
} from '../../../scripts/seed/generate-demo-seed';
import {
  SCENARIOS,
  scenarioSessions,
  weekendDate,
  type Scenario,
} from '../../../scripts/seed/demo-scenarios';
import {
  GOLDEN_COACH_EMAIL,
  GOLDEN_NOW,
  GOLDEN_PATH,
  renderGoldenFile,
} from '../../../scripts/seed/golden-seed';

/**
 * Split a SQL VALUES tuple on TOP-LEVEL commas — commas inside a quoted string
 * ("Hot day, 95F by lunch") or inside a subselect are not separators. Needed
 * because the arity check below is the only thing standing between a dropped
 * column name and a 4-column/5-value INSERT that dies in the prod SQL editor.
 */
function splitTopLevel(values: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = 0;
  for (let i = 0; i < values.length; i++) {
    const c = values[i];
    if (inStr) {
      if (c === "'") {
        if (values[i + 1] === "'") i++; // an escaped apostrophe, not the end
        else inStr = false;
      }
      continue;
    }
    if (c === "'") inStr = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(values.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(values.slice(start).trim());
  return parts;
}

/** The column names of a single-row `INSERT INTO t (a, b, c) VALUES (...)`. */
function columnsOf(line: string): string[] {
  return line.match(/^INSERT INTO \w+ \(([^)]+)\)/)![1].split(', ');
}

/** The top-level values of that same INSERT, positionally aligned with columnsOf. */
function valuesOf(line: string): string[] {
  const open = ' VALUES (';
  const start = line.indexOf(open) + open.length;
  let depth = 1;
  let inStr = false;
  let i = start;
  for (; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "'") {
        if (line[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (c === "'") inStr = true;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) break;
  }
  return splitTopLevel(line.slice(start, i));
}

/** Strip the surrounding quotes off a SQL string literal, undoubling apostrophes. */
const unquote = (v: string) => v.slice(1, -1).replace(/''/g, "'");

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

  /**
   * The dayDate guard only catches a missing KEY. A wrong VALUE is silent:
   * localDateForTimezone falls back to UTC on an unparseable IANA name, and a
   * real-but-wrong zone like 'UTC' does not even need the fallback. Both mistakes
   * put a session under the wrong day, which is what 20260731 was written to fix.
   *
   * 02:00 UTC is the probe because it is the one instant that tells the two
   * apart: every zone in the table is west of UTC, so it MUST report the
   * previous calendar day. UTC (and anything that degrades to it) reports the
   * same day.
   */
  it('every TRACK_TIMEZONES value really is west of UTC, not a typo that degraded to it', () => {
    const names = Object.keys(TRACK_TIMEZONES);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(dayDate('2026-07-19T02:00:00.000Z', name)).toBe('2026-07-18');
      // ...and the 17-23 UTC session window still lands on the SAME day.
      expect(dayDate('2026-07-18T17:00:00.000Z', name)).toBe('2026-07-18');
    }
  });
});

describe('verifyScenarios', () => {
  const now = new Date('2026-07-22T12:00:00Z');

  it('passes the real cast', () => {
    expect(verifyScenarios(SCENARIOS, now)).toHaveLength(SCENARIOS.length);
  });

  it('THROWS on a scenario whose expectations do not match the analytics', () => {
    // The generate-time gate: nothing may be emitted for a cast that no longer
    // trips the flags the demo is built to show.
    const wrong: Scenario = {
      ...SCENARIOS[0],
      expect: { ...SCENARIOS[0].expect, ready: !SCENARIOS[0].expect.ready },
    };
    expect(() => verifyScenarios([wrong], now)).toThrow(/nothing emitted/);
  });
});

describe('the golden seed fixture', () => {
  /**
   * The emitted SQL *is* the artifact — it gets pasted into the production SQL
   * editor by hand — so it is pinned byte for byte. See the fixture's own
   * header: regenerating it is a decision, not a chore.
   */
  it('matches scripts/seed/demo-seed.golden.sql exactly', () => {
    expect(readFileSync(GOLDEN_PATH, 'utf8')).toBe(renderGoldenFile());
  });

  it('is generated from the same fixed now the rest of this file asserts against', () => {
    expect(GOLDEN_NOW.toISOString()).toBe('2026-07-22T12:00:00.000Z');
    expect(GOLDEN_COACH_EMAIL).toBe('coach@example.com');
  });
});

describe('buildSeedSql', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const sql = buildSeedSql(SCENARIOS, 'coach@example.com', now);
  const lines = sql.split('\n');
  const dayInserts = lines.filter(l => l.startsWith('INSERT INTO track_days'));
  const sessionInserts = lines.filter(l => l.startsWith('INSERT INTO sessions'));
  const driverInserts = lines.filter(l => l.startsWith('INSERT INTO drivers'));
  const lineIndex = (needle: string) => {
    const i = lines.findIndex(l => l.includes(needle));
    expect(i).toBeGreaterThan(-1);
    return i;
  };

  /** Session id -> [lap_number, lap_time_ms][], in emission order. */
  const emittedLaps = (() => {
    const byId = new Map<string, Array<[number, number]>>();
    for (const line of lines) {
      const m = line.match(/^\('([0-9a-f-]+)', (\d+), (\d+)\)[,;]$/);
      if (!m) continue;
      if (!byId.has(m[1])) byId.set(m[1], []);
      byId.get(m[1])!.push([Number(m[2]), Number(m[3])]);
    }
    return byId;
  })();

  it('is deterministic for a fixed now', () => {
    expect(buildSeedSql(SCENARIOS, 'coach@example.com', now)).toBe(sql);
  });

  it('resolves coach by email, never a hard-coded id', () => {
    // Anchored on the drivers INSERT, which is the only statement that WRITES a
    // coach_id — a literal uuid there would be caught by nothing in the guard block.
    expect(driverInserts).toHaveLength(SCENARIOS.length);
    for (const line of driverInserts) {
      const coachId = valuesOf(line)[columnsOf(line).indexOf('coach_id')];
      expect(coachId).toBe("(SELECT id FROM coaches WHERE email = 'coach@example.com')");
    }
  });

  it('guards that the coach AND every track exist before touching anything', () => {
    const guard = sql.slice(sql.indexOf('DO $seed_guard$'), sql.indexOf('END $seed_guard$;'));
    expect(guard).toContain("IF NOT EXISTS (SELECT 1 FROM coaches WHERE email = 'coach@example.com')");
    const trackNames = [...new Set(SCENARIOS.flatMap(s => s.days.map(d => d.trackName)))];
    for (const name of trackNames) {
      expect(guard).toContain(`IF NOT EXISTS (SELECT 1 FROM tracks WHERE name = '${name}') THEN`);
    }
    // One RAISE per guard: coach + every track, nothing dropped.
    expect(guard.match(/RAISE EXCEPTION/g)).toHaveLength(trackNames.length + 1);
    // And the guards run before the first destructive statement.
    expect(sql.indexOf('END $seed_guard$;')).toBeLessThan(sql.indexOf('DELETE FROM'));
  });

  it('is transactional', () => {
    expect(sql.trim().startsWith('BEGIN;')).toBe(true);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
  });

  it('upserts drivers and profiles rather than skipping rows that already exist', () => {
    for (const line of driverInserts) {
      expect(line).toContain(
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, coach_id = EXCLUDED.coach_id;',
      );
    }
    for (const line of lines.filter(l => l.startsWith('INSERT INTO driver_profiles'))) {
      expect(line).toContain(
        'ON CONFLICT (driver_id) DO UPDATE SET experience_level = EXCLUDED.experience_level, total_sessions = EXCLUDED.total_sessions;',
      );
    }
  });

  it("refreshes every seeded column on a re-run — the header's idempotency claim", () => {
    // Not a substring check: the DO UPDATE SET must name EVERY column the
    // INSERT writes, minus the conflict key and the constant `source`. A column
    // seeded but not updated is a value that silently never refreshes.
    for (const line of sessionInserts) {
      const updated = line
        .match(/ON CONFLICT \(id\) DO UPDATE SET (.*);$/)![1]
        .split(', ')
        .map(a => a.split(' = ')[0]);
      const seeded = columnsOf(line).filter(c => c !== 'id' && c !== 'source');
      expect(updated).toEqual(seeded);
      for (const col of updated) expect(line).toContain(`${col} = EXCLUDED.${col}`);
    }
  });

  it('gives every single-row INSERT the same number of values as column names', () => {
    const inserts = lines.filter(l => l.startsWith('INSERT INTO ') && l.includes(' VALUES ('));
    expect(inserts.length).toBeGreaterThan(0);
    for (const line of inserts) {
      const cols = columnsOf(line);
      expect({ table: line.slice(12, line.indexOf(' (')), n: valuesOf(line).length })
        .toEqual({ table: line.slice(12, line.indexOf(' (')), n: cols.length });
    }
  });

  it('seeds every scenario driver by name and email', () => {
    for (const s of SCENARIOS) {
      const line = driverInserts.find(l => l.includes(`'${driverUuid(s.n)}'`))!;
      const vals = valuesOf(line);
      const cols = columnsOf(line);
      expect(unquote(vals[cols.indexOf('name')])).toBe(s.name);
      expect(unquote(vals[cols.indexOf('email')])).toBe(s.email);
    }
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

  describe('ordered clear', () => {
    const driverIdList = SCENARIOS.map(s => `'${driverUuid(s.n)}'`).join(', ');
    /**
     * The keep-list, read off the artifact itself rather than recomputed from
     * sessionUuid: "the ids we refuse to delete are exactly the ids we are
     * about to insert" is the invariant, and deriving both sides from the same
     * helper would satisfy it even when the helper is wrong.
     */
    const insertedSessionIds = sessionInserts.map(l => valuesOf(l)[0]);

    const at = (needle: string) => {
      const i = sql.indexOf(needle);
      expect(i).toBeGreaterThan(-1);
      return i;
    };

    it('inserts each session id exactly once', () => {
      expect(new Set(insertedSessionIds).size).toBe(insertedSessionIds.length);
      expect(insertedSessionIds).toHaveLength(
        SCENARIOS.reduce((n, s) => n + scenarioSessions(s).length, 0),
      );
    });

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
      expect(del).toBe(`DELETE FROM track_days WHERE driver_id IN (${driverIdList});`);
    });

    it('clears the days before inserting the new ones', () => {
      expect(at('DELETE FROM track_days WHERE driver_id IN')).toBeLessThan(
        at('INSERT INTO track_days'),
      );
    });

    it('removes stale demo sessions, keeping EXACTLY the ids it is about to insert', () => {
      // Anchored on the sessions DELETE specifically — the laps DELETE above it
      // carries its own "AND id NOT IN", so a substring check here proves nothing.
      const i = lines.indexOf(`DELETE FROM sessions WHERE driver_id IN (${driverIdList})`);
      expect(i).toBeGreaterThan(-1);
      expect(lines[i + 1]).toBe(`  AND id NOT IN (${insertedSessionIds.join(', ')});`);
    });

    it('removes the laps of those stale sessions under the same keep-list', () => {
      const i = lines.indexOf('DELETE FROM laps WHERE session_id IN (');
      expect(i).toBeGreaterThan(-1);
      expect(lines[i + 1]).toBe(`  SELECT id FROM sessions WHERE driver_id IN (${driverIdList})`);
      expect(lines[i + 2]).toBe(`    AND id NOT IN (${insertedSessionIds.join(', ')})`);
      expect(lines[i + 3]).toBe(');');
    });

    it('refreshes the laps of the KEPT sessions too — the statement re-running depends on', () => {
      // A separate statement from the stale-lap delete above: without it a
      // second run dies on laps_session_id_lap_number_key. It is scoped to the
      // ids being re-inserted, with NO "NOT IN".
      const refresh = lines.filter(l => l.startsWith("DELETE FROM laps WHERE session_id IN ('"));
      expect(refresh).toEqual([
        `DELETE FROM laps WHERE session_id IN (${insertedSessionIds.join(', ')});`,
      ]);
      expect(lines.indexOf(refresh[0])).toBeGreaterThan(
        lines.lastIndexOf(sessionInserts[sessionInserts.length - 1]),
      );
      expect(lines.indexOf(refresh[0])).toBeLessThan(
        lineIndex('INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES'),
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

    it('names exactly the five day columns it writes', () => {
      for (const line of dayInserts) {
        expect(columnsOf(line)).toEqual(['id', 'driver_id', 'track_id', 'date', 'notes']);
      }
    });

    it('dates each day from localDateForTimezone of its first session', () => {
      // Wed 2026-07-22 -> most recent Sat 07-18, Sun 07-19; a week back 07-11 / 07-12.
      const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
      const dates = elena.days.map((_, i) => {
        const line = dayInserts.find(l => l.includes(`'${dayUuid(elena.n, i + 1)}'`))!;
        return unquote(valuesOf(line)[columnsOf(line).indexOf('date')]);
      });
      expect(dates).toEqual(['2026-07-04', '2026-07-18', '2026-07-19']);

      const kai = SCENARIOS.find(s => s.name === 'Kai Garcia')!;
      expect(dayInserts.find(l => l.includes(`'${dayUuid(kai.n, 1)}'`))).toContain("'2026-07-11'");
      expect(dayInserts.find(l => l.includes(`'${dayUuid(kai.n, 2)}'`))).toContain("'2026-07-18'");
    });

    it('carries day notes, and NULL where there are none', () => {
      for (const s of SCENARIOS) {
        s.days.forEach((day, i) => {
          const line = dayInserts.find(l => l.includes(`'${dayUuid(s.n, i + 1)}'`))!;
          const notes = valuesOf(line)[columnsOf(line).indexOf('notes')];
          expect(notes === 'NULL' ? undefined : unquote(notes)).toBe(day.notes);
        });
      }
    });

    it('resolves the track by name, never a hard-coded id', () => {
      for (const line of dayInserts) {
        expect(valuesOf(line)[columnsOf(line).indexOf('track_id')]).toMatch(
          /^\(SELECT id FROM tracks WHERE name = '.+'\)$/,
        );
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
        const dayId = unquote(valuesOf(line)[columnsOf(line).indexOf('track_day_id')]);
        expect(emittedDayIds.has(dayId)).toBe(true);
      }
    });

    /**
     * sessions.track_day_id is a plain, NON-DEFERRABLE FK. A session INSERT that
     * runs before the INSERT of the day it names aborts the transaction at apply
     * time, and nothing in this repo would have said so first.
     */
    it('emits each day INSERT before every session that references it', () => {
      for (const line of sessionInserts) {
        const dayId = unquote(valuesOf(line)[columnsOf(line).indexOf('track_day_id')]);
        const dayLine = dayInserts.find(l => l.includes(`('${dayId}',`))!;
        expect(dayLine).toBeDefined();
        expect(lines.indexOf(dayLine)).toBeLessThan(lines.indexOf(line));
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

  describe('session aggregates and laps', () => {
    /** Every flattened session of the cast, paired with the line that seeds it. */
    const seeded = SCENARIOS.flatMap(s =>
      scenarioSessions(s).map(({ day, dayIdx, session }, i) => {
        const id = sessionUuid(s.n, i + 1);
        const line = sessionInserts.find(l => l.startsWith(`INSERT INTO sessions (`) && l.includes(`VALUES ('${id}',`))!;
        return { s, day, dayIdx, session, id, line, label: `${s.name} #${i + 1}` };
      }),
    );

    it('finds a seeded row for every session in the cast', () => {
      for (const row of seeded) expect(row.line).toBeDefined();
    });

    it('stores best_lap_ms as the MIN and total_time_ms as the SUM of that session s laps', () => {
      // Positional, off the parsed VALUES tuple: a `toContain(String(best))`
      // passes on the wrong column, because `best` also appears verbatim as one
      // of the lap values further down the script.
      for (const { line, session, label } of seeded) {
        const cols = columnsOf(line);
        const vals = valuesOf(line);
        const actual = {
          label,
          best: Number(vals[cols.indexOf('best_lap_ms')]),
          total: Number(vals[cols.indexOf('total_time_ms')]),
        };
        expect(actual).toEqual({
          label,
          best: Math.min(...session.lapTimesMs),
          total: session.lapTimesMs.reduce((a, b) => a + b, 0),
        });
      }
    });

    it('timestamps each session at its own hour', () => {
      for (const { line, day, session, label } of seeded) {
        const cols = columnsOf(line);
        const date = unquote(valuesOf(line)[cols.indexOf('date')]);
        expect({ label, date }).toEqual({
          label,
          date: weekendDate(now, day.weeksAgo, day.day, session.hourUtc),
        });
      }
    });

    it('gives the sessions WITHIN a day distinct, strictly ascending timestamps', () => {
      // A day whose sessions all share a timestamp renders as one indistinct
      // block: bySessionStart's "Session N" numbering falls back to the id tiebreak
      // and the day-KPI sigma trend stops describing first -> last.
      const byDay = new Map<string, string[]>();
      for (const { s, dayIdx, line } of seeded) {
        const key = dayUuid(s.n, dayIdx + 1);
        const date = unquote(valuesOf(line)[columnsOf(line).indexOf('date')]);
        byDay.set(key, [...(byDay.get(key) ?? []), date]);
      }
      expect(byDay.size).toBe(SCENARIOS.reduce((n, s) => n + s.days.length, 0));
      for (const [key, dates] of byDay) {
        expect({ key, dates }).toEqual({ key, dates: [...dates].sort() });
        expect({ key, distinct: new Set(dates).size }).toEqual({ key, distinct: dates.length });
      }
    });

    it('gives every session EXACTLY its own laps, numbered 1..N in order', () => {
      for (const { id, session, label } of seeded) {
        expect({ label, laps: emittedLaps.get(id) }).toEqual({
          label,
          laps: session.lapTimesMs.map((t, i) => [i + 1, t]),
        });
      }
    });

    it('emits laps for no session other than the ones it seeds', () => {
      expect([...emittedLaps.keys()].sort()).toEqual(seeded.map(r => r.id).sort());
      const total = seeded.reduce((n, r) => n + r.session.lapTimesMs.length, 0);
      expect([...emittedLaps.values()].reduce((n, v) => n + v.length, 0)).toBe(total);
    });
  });

  describe('SQL escaping', () => {
    /**
     * Task 7 pours coach prose through this generator — focus-item text,
     * assessment notes, a seeded day_summaries.draft_text — where `don't` and
     * `driver's` are near-certain. One unescaped apostrophe is a syntactically
     * broken script pasted into the prod SQL editor, so every string site is
     * driven through a fixture that contains one.
     *
     * A synthetic scenario rather than an apostrophe in the real cast: the cast
     * is verified against the analytics and its names show up in the demo UI,
     * and neither should be bent to make a quoting test possible.
     */
    const TRICKY_TRACK = "O'Neil's Bend";
    const TRICKY: Scenario = {
      n: 9,
      name: "Ronan O'Brien",
      email: "ronan.o'brien@trackapp.demo",
      experienceLevel: 'intermediate',
      days: [
        {
          weeksAgo: 0,
          day: 'sat',
          trackName: TRICKY_TRACK,
          notes: "Didn't touch the car's alignment; he's chasing turn 3's entry.",
          sessions: [
            {
              hourUtc: 17,
              lapTimesMs: [90000, 90500],
              representativeness: 'partial',
              representativenessNote: "Rain — wasn't a timed run, and it's the coach's call.",
            },
          ],
        },
      ],
      expect: { flagKinds: [], baselineState: 'building', ready: false },
    };

    const trickySql = (() => {
      // dayDate refuses an unmapped track, by design. Register the fixture's
      // track for the length of this block only.
      TRACK_TIMEZONES[TRICKY_TRACK] = 'America/Los_Angeles';
      try {
        return buildSeedSql([TRICKY], "coach.o'malley@example.com", now);
      } finally {
        delete TRACK_TIMEZONES[TRICKY_TRACK];
      }
    })();

    it('leaves no lone apostrophe in any executable line', () => {
      // Every apostrophe in a statement must be either a delimiter or half of a
      // doubled pair: strip complete string literals and nothing quoted is left.
      // `--` comment lines are exempt and genuinely are — the lexer takes the
      // rest of the line whole, so the driver name echoed into a section header
      // cannot open a string.
      const statements = trickySql
        .split('\n')
        .filter(l => !l.trimStart().startsWith('--'))
        .join('\n');
      expect(statements.replace(/'(?:[^']|'')*'/g, '')).not.toContain("'");
    });

    it('doubles apostrophes in the driver name and email', () => {
      expect(trickySql).toContain("'Ronan O''Brien'");
      expect(trickySql).toContain("'ronan.o''brien@trackapp.demo'");
    });

    it('doubles apostrophes in the day note', () => {
      expect(trickySql).toContain(
        "'Didn''t touch the car''s alignment; he''s chasing turn 3''s entry.'",
      );
    });

    it('doubles apostrophes in the representativeness note', () => {
      expect(trickySql).toContain(
        "'Rain — wasn''t a timed run, and it''s the coach''s call.'",
      );
    });

    it('doubles apostrophes in the track name, in the guard and both INSERTs', () => {
      expect(trickySql).toContain("SELECT 1 FROM tracks WHERE name = 'O''Neil''s Bend'");
      const day = trickySql.split('\n').find(l => l.startsWith('INSERT INTO track_days'))!;
      expect(day).toContain("(SELECT id FROM tracks WHERE name = 'O''Neil''s Bend')");
      const session = trickySql.split('\n').find(l => l.startsWith('INSERT INTO sessions'))!;
      expect(session).toContain("(SELECT id FROM tracks WHERE name = 'O''Neil''s Bend')");
    });

    it('doubles apostrophes in the coach email, in the guard and the subselect', () => {
      expect(trickySql).toContain(
        "(SELECT id FROM coaches WHERE email = 'coach.o''malley@example.com')",
      );
      expect(trickySql).toContain(
        "RAISE EXCEPTION 'Coach % not found — check coaches.email', 'coach.o''malley@example.com';",
      );
    });

    it('still parses back to the values it was given', () => {
      const line = trickySql.split('\n').find(l => l.startsWith('INSERT INTO drivers'))!;
      const vals = valuesOf(line);
      const cols = columnsOf(line);
      expect(unquote(vals[cols.indexOf('name')])).toBe(TRICKY.name);
      expect(unquote(vals[cols.indexOf('email')])).toBe(TRICKY.email);
    });
  });
});
