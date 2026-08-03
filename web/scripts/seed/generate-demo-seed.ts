// Usage: npx tsx scripts/seed/generate-demo-seed.ts --coach-email=<email> [--out=path]
// Verifies every scenario against the real analytics before emitting SQL.
// Run from web/.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { evaluateStudent } from '../../src/lib/analytics-v2';
// The app's OWN day-bucketing definition. The generator computes no dates of
// its own: track_days.date has to mean here exactly what it means in the import
// route, or the demo files sessions under days the app would not have made.
import { localDateForTimezone } from '../../src/lib/track-days';
import {
  SCENARIOS,
  scenarioSessions,
  toStudentHistory,
  weekendDate,
  type Scenario,
  type ScenarioDay,
} from './demo-scenarios';

const pad = (n: number, width: number) => String(n).padStart(width, '0');

export function driverUuid(n: number): string {
  return `dd000000-0000-4000-a000-${pad(n, 12)}`;
}
export function sessionUuid(driverN: number, sessionN: number): string {
  return `dd000000-${pad(driverN, 4)}-4000-a000-${pad(sessionN, 12)}`;
}
/** Day ids share the driver-scoped shape of session ids; `b000` is their namespace. */
export function dayUuid(driverN: number, dayN: number): string {
  return `dd000000-${pad(driverN, 4)}-4000-b000-${pad(dayN, 12)}`;
}

/**
 * Track -> IANA timezone. Every entry MUST agree with what
 * 20260731_track_timezones.sql wrote into tracks.timezone — the emitted
 * track_days.date is computed here from these values, while the app buckets
 * live imports from the DB's. Two answers to "what local day is this?" is a
 * session filed under a day it did not happen on, which is the exact bug that
 * migration was written to fix.
 *
 * A SUBSET of that migration, not a copy of it: the migration also maps the
 * 'Thunderhill'/'Buttonwillow' short-name variants and 'Barber' ->
 * America/Chicago. The cast uses only the five long names below, and dayDate
 * throws on anything else, so the gap cannot produce a wrong date here.
 */
export const TRACK_TIMEZONES: Record<string, string> = {
  'Thunderhill Raceway': 'America/Los_Angeles',
  'Sonoma Raceway': 'America/Los_Angeles',
  'Buttonwillow Raceway': 'America/Los_Angeles',
  'Laguna Seca': 'America/Los_Angeles',
  'Streets of Willow': 'America/Los_Angeles',
};

/**
 * The track-local calendar date a day's sessions belong to, from the day's
 * FIRST session. Throws on a track with no timezone: falling back to UTC is how
 * a session silently lands on the wrong day, so an unmapped track fails the
 * whole run instead of emitting a plausible wrong date.
 *
 * That guard covers a missing KEY only. A wrong VALUE — a typo'd IANA name, or
 * a real-but-wrong zone like 'UTC' — cannot be caught here: localDateForTimezone
 * falls back to UTC on an unparseable name, and 'UTC' parses fine. The values
 * are pinned by a test instead ("every TRACK_TIMEZONES entry buckets 02:00 UTC
 * to the previous local day"), which is the only check that sees both mistakes.
 */
export function dayDate(firstSessionIso: string, trackName: string): string {
  const timezone = TRACK_TIMEZONES[trackName];
  if (!timezone) {
    throw new Error(
      `No timezone for track "${trackName}" — add it to TRACK_TIMEZONES here AND to ` +
      `supabase/migrations/20260731_track_timezones.sql, or the seed and the app will disagree.`,
    );
  }
  return localDateForTimezone(firstSessionIso, timezone);
}

/**
 * THE one quoting path: every string this generator emits goes through here,
 * so escaping is one concern rather than one per call site. `undefined` becomes
 * a bare NULL, never the string 'NULL' — the same discipline applied uniformly
 * whether the column is nullable or not.
 *
 * Coach prose flows through here (day notes, representativeness notes, and the
 * focus/summary text Task 7 adds), where an apostrophe is near-certain. One
 * unescaped `don't` is a syntactically broken script pasted into the prod SQL
 * editor.
 */
const sqlText = (s: string | undefined) =>
  s === undefined ? 'NULL' : `'${s.replace(/'/g, "''")}'`;

/**
 * ISO start of a day's FIRST session — the timestamp track_days.date is derived
 * from.
 *
 * First, not last, because it does not matter which: the cast's ascending-hour
 * and 17-23 UTC invariants make every session of a day agree on the track-local
 * date, so first is the cheapest of several identical answers. Both invariants
 * are asserted (demo-scenarios.test.ts pins the hour window and the ordering;
 * generate-demo-seed.test.ts pins that the window stays on one local date in
 * every mapped timezone), so a cast that ever straddled midnight local would
 * turn a test red rather than quietly make this choice load-bearing.
 *
 * The import route has no first-session rule to copy, incidentally — it buckets
 * every session on its own timestamp. This is the seed's own definition.
 */
export function dayStartIso(day: ScenarioDay, now: Date): string {
  return weekendDate(now, day.weeksAgo, day.day, day.sessions[0].hourUtc);
}

/** Verify all scenarios trip exactly their expected flags. Throws with a diff on mismatch. */
export function verifyScenarios(scenarios: Scenario[], now: Date): string[] {
  const report: string[] = [];
  const failures: string[] = [];
  for (const s of scenarios) {
    const r = evaluateStudent(toStudentHistory(s, now));
    const actual = r.flags.map(f => f.kind).sort();
    const expected = [...s.expect.flagKinds].sort();
    const ok =
      JSON.stringify(actual) === JSON.stringify(expected) &&
      r.baselineState === s.expect.baselineState &&
      r.ready === s.expect.ready &&
      (s.expect.sustained === undefined || r.flags[0]?.sustained === s.expect.sustained);
    const state = expected.length ? expected.join('+') : s.expect.ready ? 'ready' : s.expect.baselineState === 'building' ? 'building' : 'quiet';
    const shape = `${s.days.length}d/${scenarioSessions(s).length}s`;
    if (ok) {
      report.push(`  ${s.name} -> ${state} (${shape}) \u2713`);
    } else {
      failures.push(
        `  ${s.name}: expected flags=[${expected}] baseline=${s.expect.baselineState} ready=${s.expect.ready}` +
        ` | actual flags=[${actual}] baseline=${r.baselineState} ready=${r.ready} sustained=${r.flags[0]?.sustained}`,
      );
    }
  }
  if (failures.length) {
    throw new Error(`Scenario verification FAILED — nothing emitted:\n${failures.join('\n')}`);
  }
  return report;
}

export function buildSeedSql(scenarios: Scenario[], coachEmail: string, now: Date): string {
  const trackNames = [...new Set(scenarios.flatMap(s => s.days.map(d => d.trackName)))];
  const coach = `(SELECT id FROM coaches WHERE email = ${sqlText(coachEmail)})`;
  const lines: string[] = [];

  lines.push(`BEGIN;`);
  lines.push(`-- demo-seed.sql — GENERATED by scripts/seed/generate-demo-seed.ts`);
  lines.push(`-- Generated: ${now.toISOString()}  Coach: ${coachEmail}`);
  lines.push(`-- Idempotent: re-run any time to refresh demo dates. Do not edit by hand.`);

  // Guards: coach and tracks must exist.
  lines.push(`DO $seed_guard$ BEGIN`);
  lines.push(`  IF NOT EXISTS (SELECT 1 FROM coaches WHERE email = ${sqlText(coachEmail)}) THEN`);
  lines.push(`    RAISE EXCEPTION 'Coach % not found — check coaches.email', ${sqlText(coachEmail)};`);
  lines.push(`  END IF;`);
  for (const t of trackNames) {
    lines.push(`  IF NOT EXISTS (SELECT 1 FROM tracks WHERE name = ${sqlText(t)}) THEN`);
    lines.push(`    RAISE EXCEPTION 'Track % not found — check tracks.name', ${sqlText(t)};`);
    lines.push(`  END IF;`);
  }
  lines.push(`END $seed_guard$;`);

  // Compute the full demo-namespace id sets up front so we can clean up any
  // sessions from earlier generator versions that are no longer in the cast.
  const allDriverIds = scenarios.map(s => driverUuid(s.n));
  const allSessionIds = scenarios.flatMap(s => scenarioSessions(s).map((_, i) => sessionUuid(s.n, i + 1)));
  const driverIdList = allDriverIds.map(id => `'${id}'`).join(', ');
  const sessionIdList = allSessionIds.map(id => `'${id}'`).join(', ');

  // ORDERED CLEAR. The order is load-bearing, top to bottom:
  //
  //  1. focus_items first (cascades focus_item_assessments). Two separate
  //     reasons, and only the first is the FK's:
  //       - ORDER is FK-forced. Assessments hold a plain FK to sessions, so a
  //         live assessment BLOCKS the stale-session delete in step 4. They
  //         have to go first, not last.
  //       - SCOPE is a choice. The FK would be satisfied by deleting only the
  //         assessments anchored to STALE sessions; this deletes every focus
  //         item the demo drivers own. That is seed ownership: Task 7 rebuilds
  //         the whole focus trail, and a refresh that left half of it standing
  //         would leave items with no evidence behind them. The cost is real —
  //         a focus item a coach wrote by hand against a demo driver DURING a
  //         demo does not survive the next refresh. Demo drivers are seed
  //         territory, so that is accepted, not overlooked.
  //  2. Unhook sessions from their days. sessions.track_day_id is nullable in
  //     the DB (P1 made it app-required, not DB-required), so this is the legal
  //     way to free the day rows without touching the sessions themselves.
  //  3. Delete ALL demo track_days wholesale — including the rows the P1
  //     backfill created under app-generated ids (cascades day_summaries).
  //     Wholesale, not an upsert: track_days is UNIQUE on
  //     (driver_id, track_id, date), so an emitted day landing on a
  //     backfilled day's date collides on THAT key, which ON CONFLICT (id)
  //     does not catch — the refresh would die mid-script. It also sweeps
  //     orphaned backfill rows by construction, so there is no second
  //     stale-day pass to get wrong.
  //  4. Only then the stale laps/sessions from earlier generator versions.
  lines.push(``);
  lines.push(`DELETE FROM focus_items WHERE driver_id IN (${driverIdList});`);
  lines.push(`UPDATE sessions SET track_day_id = NULL WHERE driver_id IN (${driverIdList});`);
  lines.push(`DELETE FROM track_days WHERE driver_id IN (${driverIdList});`);
  lines.push(`DELETE FROM laps WHERE session_id IN (`);
  lines.push(`  SELECT id FROM sessions WHERE driver_id IN (${driverIdList})`);
  lines.push(`    AND id NOT IN (${sessionIdList})`);
  lines.push(`);`);
  lines.push(`DELETE FROM sessions WHERE driver_id IN (${driverIdList})`);
  lines.push(`  AND id NOT IN (${sessionIdList});`);

  lines.push(``);
  lines.push(`-- track_days below are PLAIN INSERTs with NO ON CONFLICT, deliberately.`);
  lines.push(`-- The wholesale delete above guarantees a clean slate, so a collision here`);
  lines.push(`-- is a real bug and must abort the transaction loudly. This is NOT the`);
  lines.push(`-- import route's keys-only ON CONFLICT upsert and must not be made to`);
  lines.push(`-- resemble it: that one protects coach-authored day notes on a re-import,`);
  lines.push(`-- this one is a seed rebuilding rows it just deleted.`);

  for (const s of scenarios) {
    const dId = driverUuid(s.n);
    const sessions = scenarioSessions(s);
    lines.push(``);
    lines.push(`-- ${s.name} (${s.expect.flagKinds.join('+') || (s.expect.ready ? 'ready' : s.expect.baselineState)}) — ${s.days.length} day(s), ${sessions.length} session(s)`);
    lines.push(
      `INSERT INTO drivers (id, name, email, coach_id, created_at) VALUES ` +
      `('${dId}', ${sqlText(s.name)}, ${sqlText(s.email)}, ${coach}, now()) ` +
      `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, coach_id = EXCLUDED.coach_id;`,
    );
    lines.push(
      `INSERT INTO driver_profiles (driver_id, experience_level, total_sessions) VALUES ` +
      `('${dId}', ${sqlText(s.experienceLevel)}, ${sessions.length}) ` +
      `ON CONFLICT (driver_id) DO UPDATE SET experience_level = EXCLUDED.experience_level, total_sessions = EXCLUDED.total_sessions;`,
    );
    // Days BEFORE the sessions that reference them, always: sessions.track_day_id
    // is a plain non-deferrable FK, so a session INSERT naming a day row this
    // script has not written yet aborts the whole refresh at apply time.
    s.days.forEach((day, dayIdx) => {
      lines.push(
        `INSERT INTO track_days (id, driver_id, track_id, date, notes) VALUES ` +
        `('${dayUuid(s.n, dayIdx + 1)}', '${dId}', (SELECT id FROM tracks WHERE name = ${sqlText(day.trackName)}), ` +
        `'${dayDate(dayStartIso(day, now), day.trackName)}', ${sqlText(day.notes)});`,
      );
    });
    sessions.forEach(({ day, dayIdx, session: sess }, i) => {
      const sId = sessionUuid(s.n, i + 1);
      const tdId = dayUuid(s.n, dayIdx + 1);
      const date = weekendDate(now, day.weeksAgo, day.day, sess.hourUtc);
      const total = sess.lapTimesMs.reduce((a, b) => a + b, 0);
      const best = Math.min(...sess.lapTimesMs);
      // representativeness is emitted ALWAYS, NULL included, in both the
      // column list and the DO UPDATE SET: sessions are upserted, not
      // deleted, so a flag dropped from the cast has to be cleared in prod
      // rather than left behind as a stale chip nothing in the repo explains.
      lines.push(
        `INSERT INTO sessions (id, driver_id, track_day_id, track_id, date, total_time_ms, best_lap_ms, source, representativeness, representativeness_note) VALUES ` +
        `('${sId}', '${dId}', '${tdId}', (SELECT id FROM tracks WHERE name = ${sqlText(day.trackName)}), '${date}', ${total}, ${best}, 'manual', ` +
        `${sqlText(sess.representativeness)}, ${sqlText(sess.representativenessNote)}) ` +
        `ON CONFLICT (id) DO UPDATE SET driver_id = EXCLUDED.driver_id, track_day_id = EXCLUDED.track_day_id, track_id = EXCLUDED.track_id, ` +
        `date = EXCLUDED.date, total_time_ms = EXCLUDED.total_time_ms, best_lap_ms = EXCLUDED.best_lap_ms, ` +
        `representativeness = EXCLUDED.representativeness, representativeness_note = EXCLUDED.representativeness_note;`,
      );
    });
  }

  // Refresh laps wholesale: delete-then-insert is simpler than per-lap upserts.
  // Combined with the stale-session cleanup above, a re-run refreshes dates and
  // removes stale demo sessions.
  //
  // This DELETE is what makes a second run possible at ALL, and it is a
  // different statement from the stale-lap delete in the ordered clear above:
  // that one scrubs laps of sessions LEAVING the cast, this one scrubs the laps
  // of the sessions we are about to re-insert. Without it the INSERT below dies
  // on laps_session_id_lap_number_key the moment the script runs twice.
  lines.push(``);
  lines.push(`DELETE FROM laps WHERE session_id IN (${sessionIdList});`);
  const lapValues: string[] = [];
  for (const s of scenarios) {
    scenarioSessions(s).forEach(({ session }, i) => {
      const sId = sessionUuid(s.n, i + 1);
      session.lapTimesMs.forEach((t, lapIdx) => {
        lapValues.push(`('${sId}', ${lapIdx + 1}, ${t})`);
      });
    });
  }
  lines.push(`INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES`);
  lines.push(lapValues.join(',\n') + ';');
  lines.push(`COMMIT;`);
  return lines.join('\n') + '\n';
}

function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=') as [string, string]),
  );
  const coachEmail = args['coach-email'];
  if (!coachEmail) {
    console.error('Usage: npx tsx scripts/seed/generate-demo-seed.ts --coach-email=<email> [--out=path]');
    process.exit(1);
  }
  const now = new Date();
  const report = verifyScenarios(SCENARIOS, now);
  console.log('Scenario verification:');
  for (const line of report) console.log(line);
  const out = args['out'] ?? join(__dirname, 'demo-seed.sql');
  writeFileSync(out, buildSeedSql(SCENARIOS, coachEmail, now));
  console.log(`\nWrote ${out}`);
}

if (require.main === module) main();
