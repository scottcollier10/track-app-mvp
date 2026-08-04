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
// The app's OWN context core, not an imitation of its output: the seeded
// prompt_context and informing id arrays are built by the same function the
// generate route calls, so a demo row's provenance is real-shaped by
// construction and drifts only when the core itself changes.
import {
  assembleDaySummaryContext,
  informingIdsFrom,
  type DaySummaryInput,
} from '../../src/lib/day-summaries';
import {
  SCENARIOS,
  scenarioSessions,
  toStudentHistory,
  weekendDate,
  type Scenario,
  type ScenarioDay,
  type ScenarioFocusItem,
  type ScenarioSessionRef,
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
/** Focus items: `c000`, keyed by the item's number WITHIN its driver. */
export function focusItemUuid(driverN: number, itemN: number): string {
  return `dd000000-${pad(driverN, 4)}-4000-c000-${pad(itemN, 12)}`;
}
/**
 * Assessments: `d0II`, where II is the ITEM number, and the final node packs
 * the assessment's session coordinate as `DDDDDDSSSSSS` — six digits of day
 * index then six of session-within-day.
 *
 * The item number rides in the node-4 slot because the final node is already
 * spent on the coordinate, and it has to be in the id somewhere: the DB is
 * UNIQUE on (focus_item_id, session_id), so two items assessed at the SAME
 * session are legal rows that must not share an id. Two digits is the whole
 * budget that slot has, which is why the guard below is not decoration.
 *
 * DELIBERATELY NOT RFC 4122: node 4 is the variant field, which the RFC wants in
 * 8-b, and `c000`/`d0II`/`e000` are none of those. Do not "fix" it — `d0II`
 * could not be conformant anyway, because that slot is spent on the item number,
 * and nothing cares: Postgres `uuid` accepts any 32 hex digits, and nothing in
 * web/src parses a variant out of these ids. Only `a000`/`b000` were ever
 * variant-shaped, and that was an accident of picking round hex.
 */
export function assessmentUuid(
  driverN: number,
  itemN: number,
  dayIdx: number,
  sessionIdx: number,
): string {
  if (itemN > 99) {
    throw new Error(
      `assessmentUuid: item number ${itemN} does not fit the two digits reserved for it — ` +
      `widen the packing rather than emitting a malformed uuid.`,
    );
  }
  return `dd000000-${pad(driverN, 4)}-4000-d0${pad(itemN, 2)}-${pad(dayIdx, 6)}${pad(sessionIdx, 6)}`;
}
/** One seeded summary per driver at most, so the ordinal is a constant. */
export function summaryUuid(driverN: number): string {
  return `dd000000-${pad(driverN, 4)}-4000-e000-000000000001`;
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
 * A uuid[] literal. Explicitly cast, because `ARRAY[]` on its own has no
 * element type Postgres can infer and the empty case is reachable — a day whose
 * focus items were never assessed has no informing assessment ids at all.
 */
const uuidArray = (ids: string[]) =>
  `ARRAY[${ids.map(id => `'${id}'`).join(', ')}]::uuid[]`;

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

/**
 * Every flattened session of a scenario carrying the two things the rest of
 * this file addresses it by: the id it is seeded under and the timestamp it is
 * seeded at.
 *
 * One derivation, used by the session INSERTs, the focus/assessment INSERTs and
 * the summary's prompt_context alike. A second one would let an assessment
 * anchor to a session id the sessions block never wrote — which the FK would
 * reject in the prod SQL editor, and which "anchors every assessment to its item
 * and to a session that was inserted" in generate-demo-seed.test.ts now catches
 * first, by reading both sides off the emitted artifact rather than off this
 * function.
 */
function seededSessions(s: Scenario, now: Date) {
  return scenarioSessions(s).map(({ day, dayIdx, session }, i) => ({
    id: sessionUuid(s.n, i + 1),
    iso: weekendDate(now, day.weeksAgo, day.day, session.hourUtc),
    day,
    dayIdx,
    session,
  }));
}

/**
 * The flat index a (day, session-within-day) coordinate names — through
 * scenarioSessions, so the coordinate and the id it resolves to are read off
 * the SAME walk the sessions were emitted from.
 *
 * Throws a NAMED error on a coordinate the cast does not have. Nothing gets
 * emitted either way: every caller immediately reads `.id` or `.iso` off
 * `flat[i]`, so an out-of-range index already kills the run — on `Cannot read
 * properties of undefined (reading 'id')`, from a frame that names neither the
 * driver nor the coordinate. The diagnostic IS the work this guard does: it
 * says which entry in demo-scenarios.ts to go fix. The DB's UNIQUE
 * (focus_item_id, session_id) — which the plan leans on to catch scenario typos
 * — is no help here either; it catches DUPLICATES, never a reference into
 * nowhere.
 *
 * `findIndex` needs no `target === undefined` branch ahead of it: no element's
 * `.session` is `undefined`, so an absent coordinate already answers -1.
 */
function refIndex(s: Scenario, ref: ScenarioSessionRef): number {
  const target = s.days[ref.dayIdx]?.sessions[ref.sessionIdx];
  const i = scenarioSessions(s).findIndex(x => x.session === target);
  if (i === -1) {
    throw new Error(
      `${s.name}: focus reference names day ${ref.dayIdx} session ${ref.sessionIdx}, ` +
      `which the cast does not have.`,
    );
  }
  return i;
}

/**
 * A focus item's `created_at`.
 *
 * Emitted EXPLICITLY rather than left to the column default, for two reasons
 * that both bite:
 *
 *  - `now()` is refresh time. focusItemsForSession asks whether a NULL-origin
 *    item's created_at is on or before the day's date, so an item defaulted to
 *    today is in play at no past session — Ava's null-origin item would be
 *    evidence for nothing, on every day the demo has.
 *  - prompt_context is assembled HERE, at generate time, and the DB stamps the
 *    row at apply time. Anything left to a default makes the snapshot describe
 *    a row that does not exist yet.
 *
 * The origin session's own timestamp when there is an origin ("created after
 * that session"); otherwise the driver's first seeded session, which is the
 * earliest instant the item could honestly predate.
 */
function focusItemCreatedAtIso(s: Scenario, item: ScenarioFocusItem, now: Date): string {
  const flat = seededSessions(s, now);
  return item.origin === null ? flat[0].iso : flat[refIndex(s, item.origin)].iso;
}

/**
 * The core's INPUT for one of a scenario's days, assembled from seeded ids and
 * timestamps only — the adapter `getDaySummaryInputs` is, minus the database.
 *
 * Exported so the tests can run the core over it themselves and compare against
 * the JSON that actually landed in the emitted INSERT.
 *
 * `coachingNotes` is empty because the seed writes no `coaching_notes` rows —
 * and the ordered clear does not delete any either, so seeding them would
 * duplicate on every refresh. An empty array is the truth about the seeded day,
 * and the prompt states it plainly rather than padding.
 */
export function daySummaryInputFor(s: Scenario, dayIdx: number, now: Date): DaySummaryInput {
  const flat = seededSessions(s, now);
  const day = s.days[dayIdx];

  const focusItems = s.focusItems.map(item => ({
    id: focusItemUuid(s.n, item.n),
    text: item.text,
    status: item.status,
    created_at: focusItemCreatedAtIso(s, item, now),
    created_after_session_id: item.origin === null ? null : flat[refIndex(s, item.origin)].id,
    focus_item_assessments: item.assessments.map(a => {
      const at = flat[refIndex(s, a)];
      return {
        id: assessmentUuid(s.n, item.n, a.dayIdx, a.sessionIdx),
        session_id: at.id,
        judgment: a.judgment,
        note: a.note ?? null,
        created_at: at.iso,
      };
    }),
  }));

  // Both lists are the union of what the items REFERENCE, deduped by id —
  // exactly the `.in(referencedIds)` read getDriverFocus makes, split the same
  // two ways. Cross-day by design: an item's origin and its judgments live on
  // whichever days they happened on.
  const originIds = new Set(
    s.focusItems.filter(i => i.origin !== null).map(i => flat[refIndex(s, i.origin!)].id),
  );
  const assessmentSessionIds = new Set(
    s.focusItems.flatMap(i => i.assessments.map(a => flat[refIndex(s, a)].id)),
  );

  return {
    date: dayDate(dayStartIso(day, now), day.trackName),
    notes: day.notes ?? null,
    track: { name: day.trackName },
    driver: { name: s.name },
    sessions: flat
      .filter(x => x.dayIdx === dayIdx)
      .map(x => ({
        id: x.id,
        date: x.iso,
        best_lap_ms: Math.min(...x.session.lapTimesMs),
        representativeness: x.session.representativeness ?? null,
        representativeness_note: x.session.representativenessNote ?? null,
        laps: x.session.lapTimesMs.map(lap_time_ms => ({ lap_time_ms })),
      })),
    focusItems,
    originSessions: flat
      .filter(x => originIds.has(x.id))
      .map(x => ({
        id: x.id,
        track_day: {
          date: dayDate(dayStartIso(x.day, now), x.day.trackName),
          track: { name: x.day.trackName },
        },
      })),
    assessmentSessions: flat
      .filter(x => assessmentSessionIds.has(x.id))
      .map(x => ({ id: x.id, date: x.iso })),
    coachingNotes: [],
  };
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
    seededSessions(s, now).forEach(({ id: sId, iso: date, day, dayIdx, session: sess }) => {
      const tdId = dayUuid(s.n, dayIdx + 1);
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

  // THE COACHING LOOP. A pass of its own, after every driver's sessions are
  // written: an item's origin and an assessment's session are plain FKs, and an
  // item can be anchored to a session on any of its driver's days.
  //
  // PLAIN INSERTs, for the same reason the days above are: the ordered clear
  // deleted every demo focus item and cascaded their assessments, so a
  // collision here is a real bug. The DB's UNIQUE (focus_item_id, session_id)
  // is doing real work in this block — two assessments written at one session
  // for one item is a scenario typo, and it aborts the refresh instead of
  // silently keeping whichever the generator emitted last.
  //
  // created_at/updated_at are written EXPLICITLY and identically. created_at
  // because a default would stamp refresh time (see focusItemCreatedAtIso);
  // updated_at to match it, because the assessments table comment claims
  // "updated_at > created_at marks a corrected cell" and a defaulted updated_at
  // beside a backdated created_at would mark every seeded judgment corrected.
  const withFocus = scenarios.filter(s => s.focusItems.length > 0);
  if (withFocus.length > 0) {
    lines.push(``);
    lines.push(`-- Focus items and their assessment trails.`);
  }
  for (const s of withFocus) {
    const flat = seededSessions(s, now);
    for (const item of s.focusItems) {
      const createdAt = focusItemCreatedAtIso(s, item, now);
      const originId = item.origin === null
        ? 'NULL'
        : `'${flat[refIndex(s, item.origin)].id}'`;
      lines.push(
        `INSERT INTO focus_items (id, driver_id, text, status, created_after_session_id, created_at, updated_at) VALUES ` +
        `('${focusItemUuid(s.n, item.n)}', '${driverUuid(s.n)}', ${sqlText(item.text)}, ${sqlText(item.status)}, ` +
        `${originId}, '${createdAt}', '${createdAt}');`,
      );
      for (const a of item.assessments) {
        const at = flat[refIndex(s, a)];
        lines.push(
          `INSERT INTO focus_item_assessments (id, focus_item_id, session_id, judgment, note, created_at, updated_at) VALUES ` +
          `('${assessmentUuid(s.n, item.n, a.dayIdx, a.sessionIdx)}', '${focusItemUuid(s.n, item.n)}', '${at.id}', ` +
          `${sqlText(a.judgment)}, ${sqlText(a.note)}, '${at.iso}', '${at.iso}');`,
        );
      }
    }
  }

  // THE SEEDED DAY SUMMARY — one approved row on the driver's LATEST day.
  //
  // prompt_context and the two informing arrays come from the app's own core
  // (assembleDaySummaryContext / informingIdsFrom) over the ids this script has
  // just emitted, so every uuid in them resolves to a row in this same file by
  // construction. Hand-writing them would produce a row whose provenance
  // describes a generation that never could have happened.
  //
  // approved_at is now(), NOT a backdated timestamp. updated_at defaults to
  // now() in the same statement, and the day page lights "Edited after
  // approval" when updated_at > approved_at — backdating would light that chip
  // on every seeded row the moment it was inserted.
  //
  // model is 'seed' by the column's own comment: the row never claims a
  // generation that did not run.
  for (const s of scenarios) {
    if (!s.summary) continue;
    const dayIdx = s.days.length - 1;
    const ctx = assembleDaySummaryContext(daySummaryInputFor(s, dayIdx, now));
    const { sessionIds, assessmentIds } = informingIdsFrom(ctx);
    lines.push(``);
    lines.push(`-- ${s.name} — approved day summary for the latest day.`);
    lines.push(
      `INSERT INTO day_summaries (id, track_day_id, status, draft_text, final_text, prompt_context, model, informing_session_ids, informing_assessment_ids, approved_by, approved_at) VALUES ` +
      `('${summaryUuid(s.n)}', '${dayUuid(s.n, dayIdx + 1)}', 'approved', ` +
      `${sqlText(s.summary.draftText)}, ${sqlText(s.summary.finalText)}, ` +
      `${sqlText(JSON.stringify(ctx))}::jsonb, 'seed', ` +
      `${uuidArray(sessionIds)}, ${uuidArray(assessmentIds)}, ${coach}, now());`,
    );
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
