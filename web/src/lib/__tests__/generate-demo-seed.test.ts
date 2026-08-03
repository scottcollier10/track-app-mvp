import { readFileSync } from 'fs';
import {
  assessmentUuid,
  buildSeedSql,
  dayDate,
  dayStartIso,
  daySummaryInputFor,
  dayUuid,
  driverUuid,
  focusItemUuid,
  sessionUuid,
  summaryUuid,
  verifyScenarios,
  TRACK_TIMEZONES,
} from '../../../scripts/seed/generate-demo-seed';
import {
  SCENARIOS,
  scenarioSessions,
  weekendDate,
  type Scenario,
} from '../../../scripts/seed/demo-scenarios';
import { assembleDaySummaryContext } from '@/lib/day-summaries';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { displayedSigmaSeconds } from '@/lib/track-days';
import {
  GOLDEN_COACH_EMAIL,
  GOLDEN_NOW,
  GOLDEN_PATH,
  renderGoldenFile,
} from '../../../scripts/seed/golden-seed';

/**
 * Split a SQL VALUES tuple on TOP-LEVEL commas — commas inside a quoted string
 * ("Hot day, 95F by lunch"), inside a subselect, or inside an array constructor
 * (`ARRAY['a', 'b']::uuid[]`) are not separators. Needed because the arity check
 * below is the only thing standing between a dropped column name and a
 * 4-column/5-value INSERT that dies in the prod SQL editor.
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
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
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

/**
 * Top-level statements — split on semicolons OUTSIDE a string literal.
 *
 * The line-oriented helpers above stopped being enough at Task 7: a seeded
 * day_summaries row carries a five-section draft_text, so its INSERT spans
 * lines. Every checked-in assertion about "each single-row INSERT" has to see
 * it, and a line filter silently would not — which is a whole statement's worth
 * of columns going unchecked while the suite stays green.
 *
 * The dollar-quoted guard block gets chopped into fragments by this; that is
 * harmless, because every caller filters for fragments starting `INSERT INTO `.
 * Leading blank and `--` comment lines are dropped so those filters see the
 * statement and not the section header the generator prints above it.
 */
function statementsOf(sql: string): string[] {
  const out: string[] = [];
  let inStr = false;
  let start = 0;
  const push = (raw: string) => {
    const parts = raw.split('\n');
    let i = 0;
    while (i < parts.length && (parts[i].trim() === '' || parts[i].trim().startsWith('--'))) i++;
    const body = parts.slice(i).join('\n');
    if (body !== '') out.push(body);
  };
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) {
      if (c === "'") {
        if (sql[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    // `--` runs to end of line and the lexer takes it whole, so an apostrophe
    // in a section header ("the import route's keys-only upsert") is not a
    // string delimiter. Not skipping them desynchronizes `inStr` for the whole
    // rest of the file — which looks like "there are no INSERTs after the
    // first comment", not like an error.
    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
    } else if (c === "'") inStr = true;
    else if (c === ';') {
      push(sql.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out;
}

/** Strip the surrounding quotes off a SQL string literal, undoubling apostrophes. */
const unquote = (v: string) => v.slice(1, -1).replace(/''/g, "'");

/** The uuids inside an `ARRAY['a', 'b']::uuid[]` literal. */
const uuidArrayValues = (v: string): string[] => {
  // Anchored on the WHOLE literal: the cast ends in `[]` too, so a lastIndexOf(']')
  // would take the array's own bracket to be the cast's and drag `']::uuid` into
  // the final id.
  const m = v.match(/^ARRAY\[(.*)\]::uuid\[\]$/);
  expect(m).not.toBeNull();
  const inner = m![1];
  return inner === '' ? [] : inner.split(', ').map(unquote);
};

describe('uuid helpers', () => {
  it('are stable and namespaced', () => {
    expect(driverUuid(1)).toBe('dd000000-0000-4000-a000-000000000001');
    expect(sessionUuid(2, 3)).toBe('dd000000-0002-4000-a000-000000000003');
  });

  it('gives days their own namespace, never colliding with a session id', () => {
    expect(dayUuid(2, 3)).toBe('dd000000-0002-4000-b000-000000000003');
    expect(dayUuid(2, 3)).not.toBe(sessionUuid(2, 3));
  });

  it('gives focus items, assessments and summaries their own namespaces too', () => {
    expect(focusItemUuid(2, 3)).toBe('dd000000-0002-4000-c000-000000000003');
    expect(assessmentUuid(2, 3, 4, 5)).toBe('dd000000-0002-4000-d003-000004000005');
    expect(summaryUuid(2)).toBe('dd000000-0002-4000-e000-000000000001');
    expect(
      new Set([focusItemUuid(2, 3), assessmentUuid(2, 3, 0, 0), summaryUuid(2), dayUuid(2, 3), sessionUuid(2, 3)]).size,
    ).toBe(5);
  });

  it('keeps assessment ids distinct per item, per day AND per session-in-day', () => {
    // The DB is UNIQUE on (focus_item_id, session_id), so two items assessed at
    // one session are legal rows — and (day 1, session 0) vs (day 0, session 1)
    // are different sessions. A packing that collided on either would emit one
    // id twice and abort the refresh on the primary key.
    expect(
      new Set([
        assessmentUuid(1, 1, 0, 1),
        assessmentUuid(1, 2, 0, 1),
        assessmentUuid(1, 1, 1, 0),
      ]).size,
    ).toBe(3);
  });

  it('refuses an item number that does not fit its two digits', () => {
    expect(() => assessmentUuid(1, 100, 0, 0)).toThrow(/malformed uuid/);
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
  const focusInserts = lines.filter(l => l.startsWith('INSERT INTO focus_items'));
  const assessmentInserts = lines.filter(l => l.startsWith('INSERT INTO focus_item_assessments'));
  const summaryInserts = statementsOf(sql).filter(st => st.startsWith('INSERT INTO day_summaries'));
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
    // Over STATEMENTS, not lines: the day_summaries INSERT carries a
    // multi-line draft_text, and a line filter would skip the one statement
    // with the most columns in the file.
    const inserts = statementsOf(sql).filter(
      st => st.startsWith('INSERT INTO ') && st.includes(' VALUES ('),
    );
    expect(inserts.length).toBeGreaterThan(0);
    const tables = new Set(inserts.map(st => st.slice(12, st.indexOf(' ('))));
    expect(tables).toEqual(
      new Set(['drivers', 'driver_profiles', 'track_days', 'sessions', 'focus_items', 'focus_item_assessments', 'day_summaries']),
    );
    for (const st of inserts) {
      const cols = columnsOf(st);
      expect({ table: st.slice(12, st.indexOf(' (')), n: valuesOf(st).length })
        .toEqual({ table: st.slice(12, st.indexOf(' (')), n: cols.length });
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

  describe('the coaching loop', () => {
    /** The ids the sessions block actually wrote, read off the artifact. */
    const insertedSessionIds = new Set(sessionInserts.map(l => unquote(valuesOf(l)[0])));

    it('emits one focus_items INSERT per scenario item, and one per assessment', () => {
      expect(focusInserts).toHaveLength(
        SCENARIOS.reduce((n, s) => n + s.focusItems.length, 0),
      );
      expect(assessmentInserts).toHaveLength(
        SCENARIOS.reduce((n, s) => n + s.focusItems.reduce((m, i) => m + i.assessments.length, 0), 0),
      );
      // Both are non-trivially non-empty: a cast that lost its focus trail
      // would otherwise satisfy the two counts above.
      expect(focusInserts.length).toBeGreaterThan(3);
      expect(assessmentInserts.length).toBeGreaterThan(5);
    });

    it('carries every item s text, status and origin, NULL origin included', () => {
      for (const s of SCENARIOS) {
        for (const item of s.focusItems) {
          const line = focusInserts.find(l => l.includes(`'${focusItemUuid(s.n, item.n)}'`))!;
          expect(line).toBeDefined();
          const cols = columnsOf(line);
          const vals = valuesOf(line);
          const origin = vals[cols.indexOf('created_after_session_id')];
          expect({
            driver: unquote(vals[cols.indexOf('driver_id')]),
            text: unquote(vals[cols.indexOf('text')]),
            status: unquote(vals[cols.indexOf('status')]),
            hasOrigin: origin !== 'NULL',
          }).toEqual({
            driver: driverUuid(s.n),
            text: item.text,
            status: item.status,
            hasOrigin: item.origin !== null,
          });
          if (origin !== 'NULL') expect(insertedSessionIds.has(unquote(origin))).toBe(true);
        }
      }
    });

    it('seeds a NULL-origin item — "added outside a session" is a real state', () => {
      const nulls = focusInserts.filter(
        l => valuesOf(l)[columnsOf(l).indexOf('created_after_session_id')] === 'NULL',
      );
      expect(nulls.length).toBeGreaterThan(0);
    });

    it('anchors every assessment to its item and to a session that was inserted', () => {
      for (const s of SCENARIOS) {
        for (const item of s.focusItems) {
          for (const a of item.assessments) {
            const id = assessmentUuid(s.n, item.n, a.dayIdx, a.sessionIdx);
            const line = assessmentInserts.find(l => l.includes(`'${id}'`))!;
            expect(line).toBeDefined();
            const cols = columnsOf(line);
            const vals = valuesOf(line);
            const note = vals[cols.indexOf('note')];
            expect({
              item: unquote(vals[cols.indexOf('focus_item_id')]),
              judgment: unquote(vals[cols.indexOf('judgment')]),
              note: note === 'NULL' ? undefined : unquote(note),
              sessionSeeded: insertedSessionIds.has(unquote(vals[cols.indexOf('session_id')])),
            }).toEqual({
              item: focusItemUuid(s.n, item.n),
              judgment: a.judgment,
              note: a.note,
              sessionSeeded: true,
            });
          }
        }
      }
    });

    it('never writes two assessments for one (item, session) — the DB s unique cell', () => {
      const cells = assessmentInserts.map(l => {
        const cols = columnsOf(l);
        const vals = valuesOf(l);
        return `${vals[cols.indexOf('focus_item_id')]}/${vals[cols.indexOf('session_id')]}`;
      });
      expect(new Set(cells).size).toBe(cells.length);
      const ids = assessmentInserts.map(l => valuesOf(l)[0]);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('stamps created_at explicitly and equal to updated_at', () => {
      // A defaulted created_at is refresh time, which puts a NULL-origin item
      // out of play at every past session; a defaulted updated_at beside a
      // backdated created_at marks every seeded judgment "corrected".
      for (const line of [...focusInserts, ...assessmentInserts]) {
        const cols = columnsOf(line);
        const vals = valuesOf(line);
        const created = vals[cols.indexOf('created_at')];
        expect(created).not.toBe('now()');
        expect(unquote(created)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(vals[cols.indexOf('updated_at')]).toBe(created);
      }
    });

    it('dates each item by its ORIGIN session, and a NULL-origin one by the driver s first', () => {
      // created_at is what decides which sessions an item is in play for, so
      // dating one off the wrong session moves it between panels without
      // changing anything a reader would look at.
      const sessionDate = new Map(
        sessionInserts.map(l => {
          const cols = columnsOf(l);
          const vals = valuesOf(l);
          return [unquote(vals[cols.indexOf('id')]), unquote(vals[cols.indexOf('date')])];
        }),
      );
      for (const s of SCENARIOS) {
        for (const item of s.focusItems) {
          const line = focusInserts.find(l => l.includes(`'${focusItemUuid(s.n, item.n)}'`))!;
          const cols = columnsOf(line);
          const vals = valuesOf(line);
          const origin = vals[cols.indexOf('created_after_session_id')];
          // No origin session to date it from, so it is dated from the driver's
          // first — early enough to be in play at every session the demo shows.
          const datedFrom = origin === 'NULL' ? sessionUuid(s.n, 1) : unquote(origin);
          expect(unquote(vals[cols.indexOf('created_at')])).toBe(sessionDate.get(datedFrom));
        }
      }
    });

    it('emits the whole loop AFTER the sessions it references and with NO ON CONFLICT', () => {
      const firstFocus = lines.indexOf(focusInserts[0]);
      expect(firstFocus).toBeGreaterThan(lines.lastIndexOf(sessionInserts[sessionInserts.length - 1]));
      for (const line of [...focusInserts, ...assessmentInserts]) {
        expect(line).not.toContain('ON CONFLICT');
      }
      // ...and the ordered clear dropped them first, which is what licenses that.
      expect(lineIndex('DELETE FROM focus_items WHERE driver_id IN')).toBeLessThan(firstFocus);
    });

    it('gives Jordan and Sam NO focus items — the controls stay controls', () => {
      for (const name of ['Jordan Lee', 'Sam Whitaker']) {
        const s = SCENARIOS.find(x => x.name === name)!;
        expect(s.focusItems).toEqual([]);
        for (const line of [...focusInserts, ...assessmentInserts]) {
          expect(line).not.toContain(`'${driverUuid(s.n)}'`);
          expect(line).not.toContain(`'${focusItemUuid(s.n, 1)}'`);
        }
      }
    });

    /**
     * demo-scenarios.test.ts validates the CHECKED-IN cast, so a typo committed
     * to this repo turns that test red. This is the generate-time backstop for
     * the cast a repo owner edits and then runs the generator against without
     * running jest first — and what it has to produce is a message naming the
     * driver and the coordinate, because the alternative is an anonymous
     * `Cannot read properties of undefined (reading 'id')` several frames down.
     */
    it('THROWS naming the driver and the coordinate on a reference the cast does not have', () => {
      const badRef: Scenario = {
        n: 8,
        name: 'Kai Garcia',
        email: 'bad.ref@trackapp.demo',
        experienceLevel: 'beginner',
        days: [
          {
            weeksAgo: 0, day: 'sat', trackName: 'Laguna Seca',
            sessions: [{ hourUtc: 17, lapTimesMs: [90000, 90500] }],
          },
        ],
        focusItems: [
          {
            n: 1,
            text: 'Anchored to a session the cast never had',
            status: 'active',
            origin: null,
            assessments: [{ dayIdx: 1, sessionIdx: 9, judgment: 'improved' }],
          },
        ],
        expect: { flagKinds: [], baselineState: 'building', ready: false },
      };
      expect(() => buildSeedSql([badRef], 'coach@example.com', now)).toThrow(
        'Kai Garcia: focus reference names day 1 session 9, which the cast does not have.',
      );
    });
  });

  describe('the seeded day summary', () => {
    const elena = SCENARIOS.find(s => s.name === 'Elena Ross')!;
    const summary = summaryInserts[0];
    const cols = summary ? columnsOf(summary) : [];
    const vals = summary ? valuesOf(summary) : [];
    const value = (col: string) => vals[cols.indexOf(col)];

    it('emits exactly one, on the driver s LATEST day', () => {
      expect(summaryInserts).toHaveLength(1);
      expect(SCENARIOS.filter(s => s.summary)).toHaveLength(1);
      expect(unquote(value('id'))).toBe(summaryUuid(elena.n));
      expect(unquote(value('track_day_id'))).toBe(dayUuid(elena.n, elena.days.length));
    });

    it('is inserted after its day, and after the assessments it cites', () => {
      const start = sql.indexOf(summary);
      expect(start).toBeGreaterThan(
        sql.indexOf(`INSERT INTO track_days (id, driver_id, track_id, date, notes) VALUES ('${dayUuid(elena.n, elena.days.length)}'`),
      );
      expect(start).toBeGreaterThan(sql.lastIndexOf('INSERT INTO focus_item_assessments'));
    });

    it("records model 'seed' — the row never claims a generation that did not run", () => {
      expect(value('model')).toBe("'seed'");
    });

    it('is born approved, attributed by the coach EMAIL subquery and stamped now()', () => {
      expect(value('status')).toBe("'approved'");
      expect(value('approved_by')).toBe("(SELECT id FROM coaches WHERE email = 'coach@example.com')");
      // NOT a backdated literal: updated_at defaults to now() in the same
      // statement, and the day page lights "Edited after approval" the moment
      // updated_at > approved_at.
      expect(value('approved_at')).toBe('now()');
    });

    it('carries a final_text that differs from draft_text by exactly one sentence', () => {
      const draft = unquote(value('draft_text'));
      const final = unquote(value('final_text'));
      expect(draft).toBe(elena.summary!.draftText);
      expect(final).toBe(elena.summary!.finalText);
      expect(final).not.toBe(draft);
      const differing = draft
        .split('\n\n')
        .filter((section, i) => section !== final.split('\n\n')[i]);
      expect(differing).toHaveLength(1);
      expect(differing[0].startsWith('## Day overview')).toBe(true);
    });

    it('writes five sections that match the prompt s own headings, in order', () => {
      const headings = unquote(value('draft_text')).split('\n').filter(l => l.startsWith('## '));
      expect(headings).toEqual([
        '## Day overview',
        '## Coaching progression',
        '## Important context',
        '## Strengths demonstrated',
        '## Carry-forward',
      ]);
    });

    it('stores prompt_context as jsonb that parses to the CORE s own output', () => {
      const raw = value('prompt_context');
      expect(raw.endsWith('::jsonb')).toBe(true);
      const parsed = JSON.parse(unquote(raw.slice(0, -'::jsonb'.length)));
      // The core, run here over the same scenario input — not the generator's
      // copy of the answer. This is what proves the JSON survived BOTH escaping
      // layers (JSON string, then SQL string literal) intact.
      expect(parsed).toEqual(
        assembleDaySummaryContext(daySummaryInputFor(elena, elena.days.length - 1, now)),
      );
      // ...and that it is a real context, not an empty object that deep-equals
      // an equally empty expectation.
      expect(parsed.day.driverName).toBe('Elena Ross');
      expect(parsed.sessions).toHaveLength(4);
      expect(parsed.focusItems.length).toBeGreaterThan(1);
    });

    /**
     * The deep-equal above cannot see a bug INSIDE daySummaryInputFor: it builds
     * both sides from that one function, so a wrong input is wrong identically
     * twice and the comparison still passes. These read the emitted context
     * against the scenario and the sessions block instead.
     */
    it('describes the day itself, independently of the input builder', () => {
      const parsed = JSON.parse(
        unquote(value('prompt_context').slice(0, -'::jsonb'.length)),
      );
      const latest = elena.days[elena.days.length - 1];
      expect(parsed.day.trackName).toBe(latest.trackName);
      expect(parsed.day.notes).toBe(latest.notes);
      expect(parsed.day.sessionCount).toBe(latest.sessions.length);
      expect(parsed.sessions.map((x: { label: string }) => x.label)).toEqual([
        'Session 1', 'Session 2', 'Session 3', 'Session 4',
      ]);
      expect(parsed.sessions.map((x: { bestLapMs: number }) => x.bestLapMs)).toEqual(
        latest.sessions.map(x => Math.min(...x.lapTimesMs)),
      );

      // The representativeness pair, from the SCENARIO. The seeded draft_text
      // makes a factual claim about exactly this field ("Session 2 is flagged
      // partial"), so the prose and the provenance beside it have to agree —
      // and that is the one coupling the golden fixture's own header says it
      // cannot state on its own.
      expect(parsed.sessions.map((x: { representativeness: string | null }) => x.representativeness))
        .toEqual(latest.sessions.map(x => x.representativeness ?? null));
      expect(parsed.sessions.map((x: { representativenessNote: string | null }) => x.representativenessNote))
        .toEqual(latest.sessions.map(x => x.representativenessNote ?? null));
      // ...both sides of which are `null` for an unflagged cast, so pin the
      // claim itself rather than letting a lost flag satisfy the two above.
      expect(parsed.sessions[1].representativeness).toBe('partial');
      expect(unquote(value('draft_text'))).toContain('Session 2 is flagged partial');

      // The laps reached the context: countableLapCount is the count σ was
      // gated on, and consistencySeconds is what that lap array actually says —
      // asked with the app's own math, not a copy of it, over the scenario's
      // arrays rather than the input builder's.
      expect(parsed.sessions.map((x: { countableLapCount: number }) => x.countableLapCount))
        .toEqual(latest.sessions.map(x => x.lapTimesMs.length));
      expect(parsed.sessions.map((x: { consistencySeconds: number | null }) => x.consistencySeconds))
        .toEqual(latest.sessions.map(x => {
          const sigma = sessionConsistencySeconds(x.lapTimesMs);
          expect(sigma).not.toBeNull();
          return sigma === null ? null : displayedSigmaSeconds(sigma);
        }));

      // Every item the driver carries reaches the prompt, and each one's origin
      // label is dated by the day the item was actually created on.
      expect(parsed.focusItems).toHaveLength(elena.focusItems.length);
      for (const item of elena.focusItems) {
        const emitted = parsed.focusItems.find((x: { text: string }) => x.text === item.text);
        expect(emitted).toBeDefined();
        const originDay = item.origin === null ? null : elena.days[item.origin.dayIdx];
        expect(emitted.origin).toBe(
          originDay === null
            ? null
            : `from ${originDay.trackName}, ${dayDate(dayStartIso(originDay, now), originDay.trackName)}`,
        );
        // Each judgment is stamped at the session it was GIVEN at — not at the
        // driver's first, which is the only other timestamp in reach here and
        // the one a dropped subscript would land on.
        expect(emitted.assessments.map((a: { createdAt: string }) => a.createdAt)).toEqual(
          item.assessments.map(a => {
            const day = elena.days[a.dayIdx];
            return weekendDate(now, day.weeksAgo, day.day, day.sessions[a.sessionIdx].hourUtc);
          }),
        );
      }
    });

    it('states plainly that there are no coaching notes, rather than inventing them', () => {
      // coaching_notes is NOT in Task 6's ordered clear, so seeding notes would
      // duplicate them on every refresh. The seeded day genuinely has none, and
      // the prompt has to say so — a faked note here is a claim about a row that
      // does not exist.
      const parsed = JSON.parse(
        unquote(value('prompt_context').slice(0, -'::jsonb'.length)),
      );
      expect(parsed.coachingNotes).toEqual([]);
      expect(sql).not.toContain('INSERT INTO coaching_notes');
    });

    it('snapshots the cross-day carry-in the demo exists to show', () => {
      const parsed = JSON.parse(
        unquote(value('prompt_context').slice(0, -'::jsonb'.length)),
      );
      const carried = parsed.focusItems.find((i: { status: string }) => i.status === 'achieved');
      expect(carried.assessments.map((a: { judgment: string }) => a.judgment)).toEqual([
        'keep_working', 'improved', 'improved',
      ]);
      // The first two were given on OTHER days, and the context says so rather
      // than borrowing this day's numbering for them.
      expect(carried.assessments.map((a: { sessionLabel: string }) => a.sessionLabel)).toEqual([
        'a session on another day (1 of 2)',
        'a session on another day (2 of 2)',
        'Session 4',
      ]);
    });

    it('records informing ids that all resolve to a row inserted EARLIER', () => {
      const sessionIds = uuidArrayValues(value('informing_session_ids'));
      const assessmentIds = uuidArrayValues(value('informing_assessment_ids'));
      expect(sessionIds.length).toBeGreaterThan(0);
      expect(assessmentIds.length).toBeGreaterThan(0);

      // The line the summary is emitted on. Compared against the line of each
      // id's own INSERT, not against the first place the id appears anywhere:
      // a session id appears far earlier inside the ordered clear's
      // `AND id NOT IN (...)` keep-list, so an indexOf on the bare id is
      // satisfied by a DELETE and says nothing about emission order.
      const summaryLine = lineIndex(`'${summaryUuid(elena.n)}'`);
      // ONE lookup answers both halves. Resolving the line separately from the
      // "was it inserted" check is how this passes vacuously: a `find` that
      // missed yields `undefined`, and `lines.indexOf(undefined)` is -1, which
      // is earlier than everything.
      const insertedBefore = (inserts: string[], id: string) => {
        const insert = inserts.find(l => unquote(valuesOf(l)[0]) === id);
        expect({ id, inserted: insert !== undefined }).toEqual({ id, inserted: true });
        return { id, before: lines.indexOf(insert as string) < summaryLine };
      };
      for (const id of sessionIds) {
        expect(insertedBefore(sessionInserts, id)).toEqual({ id, before: true });
      }
      for (const id of assessmentIds) {
        expect(insertedBefore(assessmentInserts, id)).toEqual({ id, before: true });
      }
    });

    it('informs from exactly the day s own sessions, in the context s order', () => {
      const parsed = JSON.parse(
        unquote(value('prompt_context').slice(0, -'::jsonb'.length)),
      );
      expect(uuidArrayValues(value('informing_session_ids'))).toEqual(
        parsed.sessions.map((s: { id: string }) => s.id),
      );
      expect(uuidArrayValues(value('informing_assessment_ids'))).toEqual(
        parsed.focusItems.flatMap((i: { assessments: Array<{ id: string }> }) =>
          i.assessments.map(a => a.id),
        ),
      );
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
      focusItems: [
        {
          n: 1,
          text: "Don't lift through O'Neil's Bend",
          status: 'active',
          origin: null,
          assessments: [
            {
              dayIdx: 0, sessionIdx: 0, judgment: 'keep_working',
              note: "He's still lifting; it's the car's balance, he says.",
            },
          ],
        },
      ],
      summary: {
        draftText: "## Day overview\nOne session, and the coach's note says it wasn't a timed run.",
        finalText: "## Day overview\nOne session; the coach's note says it wasn't timed.",
      },
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

    it('doubles apostrophes in the focus item text and the assessment note', () => {
      expect(trickySql).toContain("'Don''t lift through O''Neil''s Bend'");
      expect(trickySql).toContain(
        "'He''s still lifting; it''s the car''s balance, he says.'",
      );
    });

    it('doubles apostrophes in BOTH summary texts', () => {
      expect(trickySql).toContain(
        "'## Day overview\nOne session, and the coach''s note says it wasn''t a timed run.'",
      );
      expect(trickySql).toContain(
        "'## Day overview\nOne session; the coach''s note says it wasn''t timed.'",
      );
    });

    /**
     * TWO escaping layers on one value: JSON.stringify, then the SQL literal.
     * The apostrophes ride inside the JSON — a `"Don't lift"` value whose quote
     * is not doubled by sqlText closes the literal mid-object and takes the
     * rest of the statement with it.
     */
    it('doubles apostrophes INSIDE the jsonb prompt_context, and it still parses', () => {
      const stmt = statementsOf(trickySql).find(st => st.startsWith('INSERT INTO day_summaries'))!;
      const raw = valuesOf(stmt)[columnsOf(stmt).indexOf('prompt_context')];
      expect(raw).toContain(`Don''t lift through O''Neil''s Bend`);
      const parsed = JSON.parse(unquote(raw.slice(0, -'::jsonb'.length)));
      expect(parsed.focusItems[0].text).toBe("Don't lift through O'Neil's Bend");
      expect(parsed.focusItems[0].assessments[0].note).toBe(
        "He's still lifting; it's the car's balance, he says.",
      );
      expect(parsed.day.trackName).toBe(TRICKY_TRACK);
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
