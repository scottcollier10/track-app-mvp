# Demo Seed Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A self-verifying TS generator that seeds prod with six demo students, each provably tripping a different `/coach` triage state, plus a counts-first purge for the orphaned Dec 2025 demo data.

**Architecture:** Deterministic scenario data (`demo-scenarios.ts`) → generator (`generate-demo-seed.ts`) runs every scenario through the real `evaluateStudent` from `src/lib/analytics-v2.ts` and hard-fails on any flag mismatch → emits idempotent `demo-seed.sql` (upserts on stable UUIDs, coach resolved by email subselect, dates relative to now). A jest test pins the six scenarios against future threshold changes. Purge is two SQL files: read-only preview, then transactional delete, scoped to `@trackapp.demo` emails.

**Tech Stack:** TypeScript via `tsx` (already a devDependency), jest (config maps `@/` → `src/`), psql for prod execution.

**Design doc:** `docs/plans/2026-07-27-demo-seed-data-design.md`

---

## Context for a zero-context engineer

- Repo: Next.js app lives in `web/`. All commands below run from `web/` unless noted.
- The analytics being demoed: `web/src/lib/analytics-v2.ts`. Key entry point:
  ```ts
  evaluateStudent(h: StudentHistory): StudentEval
  // StudentHistory = { runGroup: string; sessions: StudentSession[] }
  // StudentSession = { date: string; trackId: string; bestLapMs: number | null; lapTimesMs: Array<number|null> }
  // StudentEval   = { flags: Flag[]; severityScore; baselineState: 'ok'|'building'; sessionConsistencySeconds; sparkline; ready; readyWhy }
  // Flag = { kind: 'faded'|'regressed'|'off_baseline'; why; deltaSeconds; sustained }
  ```
  `trackId` only needs to be a stable string per track — track *names* are fine for evaluation.
- Thresholds: `web/src/lib/analytics-constants.ts` (fade > 0.5s over ≥6 clean laps; regression > 1% off same-track PB; off-baseline > mean + 2σ of ≥3 prior session std-devs AND ≥ 0.1s over the mean; ready = ≥4 clean sessions + latest σ below baseline mean + latest fade computed (needs ≥6 laps) and ≤ 0.5s).
- Prod schema quirk: `coaches` table and `drivers.coach_id` were applied manually in prod and are NOT in repo migrations. The emitted SQL therefore resolves the coach by email subselect and guards with a `DO` block. Never hard-code the coach id.
- `web/package.json` has a dead `"seed": "tsx scripts/seed.ts"` script (file doesn't exist). Ignore it; do not touch it.
- `web/supabase/scripts/cleanup-demo-data.sql` is a destructive mutation script (see design doc). Do not run it, do not extend it.

### Tuning knobs (if the verification test fails on a scenario)

| Symptom | Knob |
|---|---|
| fade too small/large | last-third lap values vs first-third (medians, not means) |
| unwanted `faded` flag | equalize first-third and last-third *medians* (order matters; thirds = `ceil(n/3)` laps off each end) |
| unwanted `off_baseline` | widen the band: make prior sessions' σ *differ more from each other*; or lower the latest session's spread |
| missing `off_baseline` | tighten priors' σ toward each other, raise latest spread; ensure latest σ − prior mean ≥ 0.1s |
| unwanted `regressed` | keep latest session's min lap ≤ 1.01 × the min lap of prior same-track sessions |
| missing `regressed` | latest best > 1.01 × prior track PB; for `sustained`, session 2's best must also be >1.01 × session 1's best |
| unwanted `ready` | latest σ must NOT be below the mean of prior σs |
| missing `ready` | latest σ below prior mean AND latest session has ≥6 clean laps AND fade ≤ 0.5s AND ≥4 total clean sessions |

---

### Task 1: Scenario types + weekend date helper

**Files:**
- Create: `web/scripts/seed/demo-scenarios.ts` (types + helper only in this task)
- Test: `web/src/lib/__tests__/demo-scenarios.test.ts`

**Step 1: Write the failing test**

```ts
// web/src/lib/__tests__/demo-scenarios.test.ts
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
```

**Step 2: Run test to verify it fails**

Run (from `web/`): `npx jest demo-scenarios -v`
Expected: FAIL — cannot find module / `weekendDate` not exported.

**Step 3: Write minimal implementation**

```ts
// web/scripts/seed/demo-scenarios.ts
export type Weekday = 'sat' | 'sun';

export interface ScenarioSession {
  weeksAgo: number;      // 0 = most recent weekend
  day: Weekday;
  trackName: string;     // must match tracks.name in prod (recon confirms)
  lapTimesMs: number[];
}

export interface Scenario {
  n: number;             // 1-6, drives stable UUIDs
  name: string;
  email: string;         // must end @trackapp.demo (purge scope)
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  sessions: ScenarioSession[];  // chronological, oldest first
  expect: {
    flagKinds: Array<'faded' | 'regressed' | 'off_baseline'>;
    sustained?: boolean;       // checked on the single expected flag if set
    baselineState: 'ok' | 'building';
    ready: boolean;
  };
}

/** Saturday (or Sunday) of the weekend N weeks before `now`, at 10:00 UTC, as ISO string. */
export function weekendDate(now: Date, weeksAgo: number, day: Weekday): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10));
  const daysSinceSaturday = (d.getUTCDay() + 1) % 7; // Sat=6 -> 0, Sun=0 -> 1, Wed=3 -> 4
  d.setUTCDate(d.getUTCDate() - daysSinceSaturday - weeksAgo * 7 + (day === 'sun' ? 1 : 0));
  return d.toISOString();
}
```

Note: for a mid-week `now` (e.g. Wed 2026-07-22), `weeksAgo 0` resolves to the most recent *past* weekend (Sat 07-18 / Sun 07-19), so demo data always looks fresh, never future-dated.

**Step 4: Run test to verify it passes**

Run: `npx jest demo-scenarios -v`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add scripts/seed/demo-scenarios.ts src/lib/__tests__/demo-scenarios.test.ts
git commit -m "feat(seed): scenario types + weekend date helper"
```

---

### Task 2: The six scenarios, pinned by evaluateStudent

**Files:**
- Modify: `web/scripts/seed/demo-scenarios.ts` (add data + `toStudentHistory`)
- Modify: `web/src/lib/__tests__/demo-scenarios.test.ts`

**Step 1: Write the failing test (the self-verification — this is the core of the whole feature)**

Append to the test file:

```ts
import { SCENARIOS, toStudentHistory } from '../../../scripts/seed/demo-scenarios';
import { evaluateStudent } from '@/lib/analytics-v2';

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
```

**Step 2: Run to verify it fails**

Run: `npx jest demo-scenarios -v`
Expected: FAIL — `SCENARIOS` not exported.

**Step 3: Implement the scenarios**

Append to `demo-scenarios.ts`. Lap arrays are pre-computed against the thresholds; if any `it.each` case fails, adjust with the knobs table at the top of this plan — the test is the arbiter, not these literals.

```ts
import type { StudentHistory } from '@/lib/analytics-v2';
// NOTE: scripts/ is outside src/, so the @/ alias works in jest but NOT under
// plain tsx. Import relatively instead:
// import type { StudentHistory } from '../../src/lib/analytics-v2';

export function toStudentHistory(s: Scenario, now: Date): StudentHistory {
  return {
    runGroup: s.experienceLevel,
    sessions: s.sessions.map(sess => ({
      date: weekendDate(now, sess.weeksAgo, sess.day),
      trackId: sess.trackName,
      bestLapMs: Math.min(...sess.lapTimesMs),
      lapTimesMs: sess.lapTimesMs,
    })),
  };
}

const THUNDERHILL = 'Thunderhill Raceway';
const SONOMA = 'Sonoma Raceway';
const BUTTONWILLOW = 'Buttonwillow Raceway';
const LAGUNA = 'Laguna Seca';
const STREETS = 'Streets of Willow';

export const SCENARIOS: Scenario[] = [
  {
    // Latest session: first-third median 91400, last-third median 92150 -> fade 0.75s.
    // Priors' sigma deliberately varied (~0.2/0.3/0.4s) to keep the baseline band wide
    // so the fade session's spread does NOT also trip off_baseline.
    n: 1, name: 'Kai Garcia', email: 'kai.garcia@trackapp.demo', experienceLevel: 'beginner',
    sessions: [
      { weeksAgo: 3, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [92100, 91900, 92200, 92000, 92150, 91950, 92250, 92050] },        // tight, σ≈0.2
      { weeksAgo: 2, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [92000, 91600, 92300, 91700, 92200, 91500, 92400, 91800] },        // medium, σ≈0.3
      { weeksAgo: 1, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [91900, 91400, 92500, 91500, 92300, 91400, 92600, 91600] },        // loose, σ≈0.5
      { weeksAgo: 0, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [91300, 91500, 91400, 91600, 91700, 91800, 92000, 92150, 92200] }, // the fade
    ],
    expect: { flagKinds: ['faded'], sustained: false, baselineState: 'ok', ready: false },
  },
  {
    // Same track throughout. PB 89400 in s1; s2 best 90500 (>1.01*89400=90294) and
    // latest best 90600 -> regressed AND sustained (2x severity, tops the queue).
    // Only 2 priors -> baselineState 'building' (regression fires regardless).
    n: 2, name: 'Marcus Webb', email: 'marcus.webb@trackapp.demo', experienceLevel: 'intermediate',
    sessions: [
      { weeksAgo: 2, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90100, 89800, 89400, 90000, 89900, 89700, 90200, 89600] },
      { weeksAgo: 1, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90800, 90600, 90500, 90900, 90700, 91000, 90600, 90800] },
      { weeksAgo: 0, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90900, 90700, 90600, 91000, 90800, 91100, 90700, 90900] },
    ],
    expect: { flagKinds: ['regressed'], sustained: true, baselineState: 'building', ready: false },
  },
  {
    // Three tight priors (σ≈0.2s, near-identical) then a latest session swinging ±0.8s
    // (σ≈0.75s) -> off_baseline. First/last third medians equalized so no fade;
    // latest min (94800) beats prior PB so no regression.
    n: 3, name: 'Ava Torres', email: 'ava.torres@trackapp.demo', experienceLevel: 'intermediate',
    sessions: [
      { weeksAgo: 3, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95250, 95750, 95300, 95700, 95350, 95650, 95400, 95600] },
      { weeksAgo: 2, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95200, 95700, 95250, 95650, 95300, 95600, 95350, 95550] },
      { weeksAgo: 1, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95300, 95800, 95350, 95750, 95400, 95700, 95450, 95650] },
      { weeksAgo: 0, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [94800, 96400, 95100, 96200, 94900, 96400, 94900, 95100] },
    ],
    expect: { flagKinds: ['off_baseline'], baselineState: 'ok', ready: false },
  },
  {
    // Five sessions, bests improving every time (latest is a new PB -> no regression),
    // priors' σ ≈ 0.35-0.45s, latest σ ≈ 0.25s (below baseline mean -> tightening),
    // latest has 8 clean laps with flat thirds (fade ≈ -0.1s) -> ready.
    n: 4, name: 'Elena Ross', email: 'elena.ross@trackapp.demo', experienceLevel: 'advanced',
    sessions: [
      { weeksAgo: 4, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88900, 88300, 89100, 88400, 88800, 88200, 89200, 88500] },
      { weeksAgo: 3, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88600, 88100, 88800, 88200, 88500, 87900, 88900, 88300] },
      { weeksAgo: 2, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88300, 87700, 88600, 87800, 88200, 87600, 88700, 87900] },
      { weeksAgo: 1, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [87900, 87400, 88200, 87500, 87800, 87300, 88300, 87600] },
      { weeksAgo: 0, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [87100, 86800, 87400, 86900, 87200, 86700, 87300, 87000] },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: true },
  },
  {
    // One session, five laps: no baseline, no fade computation (<6 laps), nothing to judge.
    n: 5, name: 'Jordan Lee', email: 'jordan.lee@trackapp.demo', experienceLevel: 'beginner',
    sessions: [
      { weeksAgo: 0, day: 'sat', trackName: STREETS,
        lapTimesMs: [98500, 97800, 98200, 97600, 98000] },
    ],
    expect: { flagKinds: [], baselineState: 'building', ready: false },
  },
  {
    // Six flat sessions. Latest best (90200) within 1% of PB (89900 in s2, 1.01x = 90799).
    // Latest σ sits just ABOVE the prior mean (not tightening -> not ready) but far
    // below mean+2σ (not off_baseline). The quiet control.
    n: 6, name: 'Sam Whitaker', email: 'sam.whitaker@trackapp.demo', experienceLevel: 'advanced',
    sessions: [
      { weeksAgo: 5, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90100, 90700, 90200, 90600, 90000, 90800, 90300] },
      { weeksAgo: 4, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90400, 89900, 90600, 90100, 90500, 90000, 90700, 90200] },
      { weeksAgo: 3, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90000, 90700, 90100, 90600, 90100, 90800, 90300] },
      { weeksAgo: 2, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90400, 90000, 90600, 90100, 90500, 89950, 90700, 90200] },
      { weeksAgo: 1, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90050, 90700, 90150, 90600, 90050, 90800, 90250] },
      { weeksAgo: 0, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90600, 90200, 90800, 90250, 90700, 90200, 90900, 90350] },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: false },
  },
];
```

**Important:** use the *relative* import for `StudentHistory` (see NOTE in code) so the file works under both jest and plain `tsx`.

**Step 4: Run to verify it passes**

Run: `npx jest demo-scenarios -v`
Expected: PASS. If a scenario case fails, the failure message shows actual vs expected flag kinds — adjust lap arrays per the knobs table, re-run. Do not loosen the test.

**Step 5: Run the full suite**

Run: `npm test`
Expected: 8+ suites, all passing (baseline was 122 tests).

**Step 6: Commit**

```bash
git add scripts/seed/demo-scenarios.ts src/lib/__tests__/demo-scenarios.test.ts
git commit -m "feat(seed): six demo students pinned to their triage flags via evaluateStudent"
```

---

### Task 3: SQL emitter

**Files:**
- Create: `web/scripts/seed/generate-demo-seed.ts`
- Test: `web/src/lib/__tests__/generate-demo-seed.test.ts`

**Step 1: Write the failing test**

```ts
// web/src/lib/__tests__/generate-demo-seed.test.ts
import { buildSeedSql, driverUuid, sessionUuid } from '../../../scripts/seed/generate-demo-seed';
import { SCENARIOS } from '../../../scripts/seed/demo-scenarios';

describe('uuid helpers', () => {
  it('are stable and namespaced', () => {
    expect(driverUuid(1)).toBe('dd000000-0000-4000-a000-000000000001');
    expect(sessionUuid(2, 3)).toBe('dd000000-0002-4000-a000-000000000003');
  });
});

describe('buildSeedSql', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const sql = buildSeedSql(SCENARIOS, 'coach@example.com', now);

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
    const latest = kai.sessions[kai.sessions.length - 1];
    const total = latest.lapTimesMs.reduce((a, b) => a + b, 0);
    const best = Math.min(...latest.lapTimesMs);
    expect(sql).toContain(String(total));
    expect(sql).toContain(String(best));
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx jest generate-demo-seed -v`
Expected: FAIL — module not found.

**Step 3: Implement**

```ts
// web/scripts/seed/generate-demo-seed.ts
//
// Usage: npx tsx scripts/seed/generate-demo-seed.ts --coach-email=<email> [--out=path]
// Verifies every scenario against the real analytics before emitting SQL.
// Run from web/.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { evaluateStudent } from '../../src/lib/analytics-v2';
import { SCENARIOS, toStudentHistory, weekendDate, type Scenario } from './demo-scenarios';

export function driverUuid(n: number): string {
  return `dd000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}
export function sessionUuid(driverN: number, sessionN: number): string {
  return `dd000000-${String(driverN).padStart(4, '0')}-4000-a000-${String(sessionN).padStart(12, '0')}`;
}

const q = (s: string) => s.replace(/'/g, "''");

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
    if (ok) {
      report.push(`  ${s.name} -> ${state} \u2713`);
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
  const trackNames = [...new Set(scenarios.flatMap(s => s.sessions.map(x => x.trackName)))];
  const coach = `(SELECT id FROM coaches WHERE email = '${q(coachEmail)}')`;
  const lines: string[] = [];

  lines.push(`-- demo-seed.sql — GENERATED by scripts/seed/generate-demo-seed.ts`);
  lines.push(`-- Generated: ${now.toISOString()}  Coach: ${coachEmail}`);
  lines.push(`-- Idempotent: re-run any time to refresh demo dates. Do not edit by hand.`);
  lines.push(`BEGIN;`);

  // Guards: coach and tracks must exist.
  lines.push(`DO $$ BEGIN`);
  lines.push(`  IF NOT EXISTS (SELECT 1 FROM coaches WHERE email = '${q(coachEmail)}') THEN`);
  lines.push(`    RAISE EXCEPTION 'Coach % not found — check coaches.email', '${q(coachEmail)}';`);
  lines.push(`  END IF;`);
  for (const t of trackNames) {
    lines.push(`  IF NOT EXISTS (SELECT 1 FROM tracks WHERE name = '${q(t)}') THEN`);
    lines.push(`    RAISE EXCEPTION 'Track % not found — check tracks.name', '${q(t)}';`);
    lines.push(`  END IF;`);
  }
  lines.push(`END $$;`);

  const allSessionIds: string[] = [];

  for (const s of scenarios) {
    const dId = driverUuid(s.n);
    lines.push(``);
    lines.push(`-- ${s.name} (${s.expect.flagKinds.join('+') || (s.expect.ready ? 'ready' : s.expect.baselineState)})`);
    lines.push(
      `INSERT INTO drivers (id, name, email, coach_id, created_at) VALUES ` +
      `('${dId}', '${q(s.name)}', '${q(s.email)}', ${coach}, now()) ` +
      `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, coach_id = EXCLUDED.coach_id;`,
    );
    lines.push(
      `INSERT INTO driver_profiles (driver_id, experience_level, total_sessions) VALUES ` +
      `('${dId}', '${s.experienceLevel}', ${s.sessions.length}) ` +
      `ON CONFLICT (driver_id) DO UPDATE SET experience_level = EXCLUDED.experience_level, total_sessions = EXCLUDED.total_sessions;`,
    );
    s.sessions.forEach((sess, i) => {
      const sId = sessionUuid(s.n, i + 1);
      allSessionIds.push(sId);
      const date = weekendDate(now, sess.weeksAgo, sess.day);
      const total = sess.lapTimesMs.reduce((a, b) => a + b, 0);
      const best = Math.min(...sess.lapTimesMs);
      lines.push(
        `INSERT INTO sessions (id, driver_id, track_id, date, total_time_ms, best_lap_ms, source) VALUES ` +
        `('${sId}', '${dId}', (SELECT id FROM tracks WHERE name = '${q(sess.trackName)}'), '${date}', ${total}, ${best}, 'manual') ` +
        `ON CONFLICT (id) DO UPDATE SET driver_id = EXCLUDED.driver_id, track_id = EXCLUDED.track_id, ` +
        `date = EXCLUDED.date, total_time_ms = EXCLUDED.total_time_ms, best_lap_ms = EXCLUDED.best_lap_ms;`,
      );
    });
  }

  // Refresh laps wholesale: delete-then-insert is simpler than per-lap upserts and
  // handles scenarios shrinking between generator versions.
  lines.push(``);
  lines.push(`DELETE FROM laps WHERE session_id IN (${allSessionIds.map(id => `'${id}'`).join(', ')});`);
  const lapValues: string[] = [];
  for (const s of scenarios) {
    s.sessions.forEach((sess, i) => {
      const sId = sessionUuid(s.n, i + 1);
      sess.lapTimesMs.forEach((t, lapIdx) => {
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
```

**Step 4: Run tests**

Run: `npx jest generate-demo-seed -v` → expected PASS.
Run: `npm test` → all green.

**Step 5: Run the generator end-to-end locally**

Run (from `web/`): `npx tsx scripts/seed/generate-demo-seed.ts --coach-email=test@example.com`
Expected output: six `✓` lines and `Wrote .../demo-seed.sql`. Open the file, sanity-check one driver block by eye.

**Step 6: Gitignore the artifact**

Add to `web/.gitignore` (create the entry, keep existing content):
```
scripts/seed/demo-seed.sql
```
Verify: `git status` does not list `demo-seed.sql`.

**Step 7: Commit**

```bash
git add scripts/seed/generate-demo-seed.ts src/lib/__tests__/generate-demo-seed.test.ts .gitignore
git commit -m "feat(seed): self-verifying SQL emitter for demo students"
```

---

### Task 4: Purge scripts (preview + delete)

**Files:**
- Create: `web/scripts/seed/purge-demo-data-preview.sql`
- Create: `web/scripts/seed/purge-demo-data.sql`

No unit tests — these run against prod under eyes-on review. Two files so `psql -f` on the preview can never delete anything.

**Step 1: Write the preview (read-only)**

```sql
-- purge-demo-data-preview.sql — READ ONLY.
-- Shows exactly what purge-demo-data.sql would delete. Run and review before purging.
-- Scope: all drivers whose email ends in @trackapp.demo (Dec 2025 seed + current demo cast).

WITH demo_drivers AS (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
),
demo_sessions AS (
  SELECT id FROM sessions WHERE driver_id IN (SELECT id FROM demo_drivers)
)
SELECT 'drivers' AS table_name, count(*) AS rows_to_delete FROM demo_drivers
UNION ALL
SELECT 'driver_profiles', count(*) FROM driver_profiles WHERE driver_id IN (SELECT id FROM demo_drivers)
UNION ALL
SELECT 'sessions', count(*) FROM demo_sessions
UNION ALL
SELECT 'laps', count(*) FROM laps WHERE session_id IN (SELECT id FROM demo_sessions)
UNION ALL
SELECT 'coaching_notes', count(*) FROM coaching_notes WHERE session_id IN (SELECT id FROM demo_sessions);

-- The drivers themselves, for eyeball confirmation:
SELECT id, name, email, coach_id, created_at FROM drivers WHERE email LIKE '%@trackapp.demo' ORDER BY created_at;
```

**Step 2: Write the delete**

```sql
-- purge-demo-data.sql — DESTRUCTIVE. Run purge-demo-data-preview.sql first and approve counts.
-- Deletes all demo data (drivers with @trackapp.demo emails) and their children.
BEGIN;

WITH demo_drivers AS (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
),
demo_sessions AS (
  SELECT id FROM sessions WHERE driver_id IN (SELECT id FROM demo_drivers)
)
DELETE FROM coaching_notes WHERE session_id IN (SELECT id FROM demo_sessions);

DELETE FROM laps WHERE session_id IN (
  SELECT s.id FROM sessions s JOIN drivers d ON d.id = s.driver_id WHERE d.email LIKE '%@trackapp.demo'
);

DELETE FROM sessions WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM driver_profiles WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM drivers WHERE email LIKE '%@trackapp.demo';

COMMIT;
```

Note: CTEs don't persist across statements — each DELETE re-derives its scope, which is why the joins repeat. Correct even if some tables cascade; explicit deletes are schema-drift-proof (we don't fully trust repo migrations to describe prod FKs).

**Step 3: Sanity-check the SQL parses**

No local DB, so review-only: re-read both files; confirm the preview contains no INSERT/UPDATE/DELETE, and the delete file touches only tables scoped by `@trackapp.demo`.

**Step 4: Commit**

```bash
git add scripts/seed/purge-demo-data-preview.sql scripts/seed/purge-demo-data.sql
git commit -m "feat(seed): counts-first purge scripts for demo data"
```

---

### Task 5: Final local verification + PR

**Step 1: Full suite**

Run (from `web/`): `npm test` — all green.

**Step 2: Lint**

Run: `npm run lint` — no new errors (scripts/ may be outside lint scope; that's fine).

**Step 3: Push and open PR**

```bash
git push -u origin feat/demo-seed-data
gh pr create --title "feat: self-verifying demo seed data (6 triage scenarios)" --body "..."
```

PR body: link the design doc, note that prod execution (purge + seed) is a separate manual step blocked on IPv6 access, and that `cleanup-demo-data.sql` was found to be a mutation script and deliberately left untouched.

---

### Task 6: Prod execution (MANUAL — requires Scott + IPv6 network)

Do NOT automate past each checkpoint. `$DB_URL` = the direct Postgres string with the reset password.

**Step 1: Recon (read-only).** Settles schema drift + gets the coach email.

```bash
psql "$DB_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='drivers' ORDER BY 1;"
psql "$DB_URL" -c "SELECT id, email FROM coaches;"
psql "$DB_URL" -c "SELECT name FROM tracks ORDER BY 1;"
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM drivers) drivers, (SELECT count(*) FROM sessions) sessions, (SELECT count(*) FROM laps) laps;"
```

Checkpoint: `coach_id` present in drivers; exactly the expected coach; track names match the scenario constants (**if names differ, update the constants in `demo-scenarios.ts`, re-run tests, regenerate**).

**Step 2: Purge preview.** `psql "$DB_URL" -f scripts/seed/purge-demo-data-preview.sql`
Checkpoint: show Scott the counts (expect ~4 drivers / ~48 sessions / ~750 laps from the Dec seed). **Scott approves before proceeding.**

**Step 3: Purge.** `psql "$DB_URL" -f scripts/seed/purge-demo-data.sql`

**Step 4: Generate with the real coach email.**
`npx tsx scripts/seed/generate-demo-seed.ts --coach-email=<email from recon>`
Checkpoint: six `✓` lines.

**Step 5: Seed.** `psql "$DB_URL" -f scripts/seed/demo-seed.sql`

**Step 6: Render check (the RLS proof).** Scott logs into the live app as the demo coach; `/coach` must show: Kai Garcia flagged *faded*, Marcus Webb *regressed* (top of triage queue — sustained), Ava Torres *off baseline*, Elena Ross *Progressing* (blue), Jordan Lee grey *building*, Sam Whitaker quiet. KPIs: 3 need debrief, 1 progressing. All three run-group sections populated.

**Demo refresh recipe (any later date):** repeat Steps 4-5 only. No purge needed.
