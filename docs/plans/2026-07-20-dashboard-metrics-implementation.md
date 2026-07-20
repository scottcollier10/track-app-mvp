# Dashboard Metrics Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `/coach` dashboard's duplicate 0–100 composite scores with a triage-first
surface — a severity-sorted "who to debrief next" queue plus a run-group-segmented roster with a
readiness-to-advance signal — all built on honest within-driver metrics (std-dev in tenths,
fade, delta-to-PB, control-chart baselines, sector-gated gap-to-ideal).

**Architecture:** A new pure-function analytics core (`analytics-v2.ts`, fully unit-tested) computes
per-session metrics and per-driver flags. The dashboard data layer (`coachDashboard.ts`) is rewritten
to produce a new per-student shape (flags, severity, baseline, run group) consumed by a three-zone
`/coach` page. Driver detail gains a per-student run-group control (reusing the existing update API
with an added ownership check) and deeper session analysis; the broken `/profile` "first driver"
level editor is retired. No new dependencies (Recharts + CSS only).

**Tech Stack:** Next.js (App Router, client pages), TypeScript, Supabase (server client, RLS),
Jest, Recharts.

**Design reference:** `docs/plans/2026-07-20-dashboard-metrics-design.md`

**Ground rules:**
- REQUIRED SUB-SKILL for every code task: superpowers:test-driven-development (red → green → commit).
- Full gate is `cd web && npm test` (baseline 78/78+). Each phase ends green.
- All thresholds are **named constants** in one place, with the defaults given here. They are
  guesses to calibrate on pilot data — never inline magic numbers.
- Copy uses **"students" / instructor-corps** framing. Colour: neutral default; amber/red only on
  breakout; blue for progressing/ready; every colour paired with icon + text.
- Real data only. No fabricated claims. No behaviour left half-migrated.

---

## Constants (single source of truth)

**File: Create `web/src/lib/analytics-constants.ts`**

```typescript
/** Lap-cleaning + flag thresholds. Calibrate on real pilot data; never inline these. */
export const CLEAN_LAP_MAX_MULTIPLE = 1.25; // drop laps slower than 1.25x session median (out/in/pit/traffic)
export const MIN_CLEAN_LAPS_FOR_FADE = 6;   // fade needs >=6 clean laps
export const FADE_THRESHOLD_S = 0.5;        // last-third slower than first-third by >0.5s => faded
export const MIN_PRIOR_SESSIONS_FOR_BASELINE = 3; // consistency baseline needs >=3 prior sessions
export const BASELINE_SIGMA = 2;            // control-chart limit = mean +/- 2*sigma
export const BASELINE_MIN_DELTA_S = 0.1;    // ignore breakouts smaller than 0.1s (guards sigma~0)
export const PB_REGRESSION_PCT = 0.01;      // session best >1% slower than track PB => regressed
export const READINESS_MIN_SESSIONS = 4;    // readiness needs >=4 clean sessions in current tier
export const SPARKLINE_WINDOW = 8;          // last N session-bests shown in row sparklines
```

---

## Phase A — Pure analytics core (TDD)

New module so we never fight the legacy `analytics.ts` mid-migration. Legacy deletion happens in
Phase E once nothing imports it.

**Files (whole phase):**
- Create: `web/src/lib/analytics-v2.ts`
- Test: `web/src/lib/__tests__/analytics-v2.test.ts`

### Task A1: Clean-lap filter

**Step 1 — failing test.** Add to `analytics-v2.test.ts`:

```typescript
import { cleanLaps } from '../analytics-v2';

describe('cleanLaps', () => {
  it('drops null, zero, and negative lap times', () => {
    expect(cleanLaps([90000, 0, -5, null as unknown as number, 90500])).toEqual([90000, 90500]);
  });
  it('drops out/in/pit laps slower than 1.25x the median', () => {
    // median of [90000,90500,91000,91500,92000] = 91000; 1.25x = 113750
    expect(cleanLaps([90000, 90500, 91000, 91500, 92000, 180000])).toEqual(
      [90000, 90500, 91000, 91500, 92000]
    );
  });
  it('returns [] for empty or all-invalid input', () => {
    expect(cleanLaps([])).toEqual([]);
    expect(cleanLaps([0, -1, null as unknown as number])).toEqual([]);
  });
});
```

**Step 2 — run, expect fail:** `cd web && npx jest analytics-v2 -t cleanLaps`. Expected: FAIL (module/function missing).

**Step 3 — implement** in `analytics-v2.ts`:

```typescript
import { CLEAN_LAP_MAX_MULTIPLE } from './analytics-constants';

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Positive laps with out/in/pit/traffic laps (>1.25x median) removed. Preserves order. */
export function cleanLaps(lapTimesMs: Array<number | null>): number[] {
  const valid = lapTimesMs.filter((t): t is number => typeof t === 'number' && t > 0 && isFinite(t));
  if (valid.length === 0) return [];
  const med = median([...valid].sort((a, b) => a - b));
  const limit = med * CLEAN_LAP_MAX_MULTIPLE;
  return valid.filter((t) => t <= limit);
}
```

**Step 4 — run, expect pass:** `npx jest analytics-v2 -t cleanLaps`. Expected: PASS.

**Step 5 — commit:** `git add web/src/lib/analytics-v2.ts web/src/lib/analytics-constants.ts web/src/lib/__tests__/analytics-v2.test.ts && git commit -m "feat(analytics): clean-lap filter + threshold constants"`

### Task A2: Session consistency as std-dev in seconds

**Step 1 — failing test:**

```typescript
import { sessionConsistencySeconds } from '../analytics-v2';

describe('sessionConsistencySeconds', () => {
  it('returns sample std-dev of clean laps in seconds', () => {
    // laps 90.0/90.5/91.0/91.5/92.0s -> sample stddev ~0.79s
    const s = sessionConsistencySeconds([90000, 90500, 91000, 91500, 92000]);
    expect(s).not.toBeNull();
    expect(s!).toBeCloseTo(0.79, 2);
  });
  it('returns 0 for identical laps', () => {
    expect(sessionConsistencySeconds([90000, 90000, 90000])).toBe(0);
  });
  it('returns null with fewer than 2 clean laps', () => {
    expect(sessionConsistencySeconds([90000])).toBeNull();
    expect(sessionConsistencySeconds([])).toBeNull();
  });
});
```

**Step 2 — run/fail.** **Step 3 — implement:**

```typescript
/** Sample standard deviation of clean lap times, in SECONDS. Null if <2 clean laps. */
export function sessionConsistencySeconds(lapTimesMs: Array<number | null>): number | null {
  const laps = cleanLaps(lapTimesMs);
  if (laps.length < 2) return null;
  const mean = laps.reduce((s, t) => s + t, 0) / laps.length;
  const variance = laps.reduce((s, t) => s + (t - mean) ** 2, 0) / (laps.length - 1);
  return Math.sqrt(variance) / 1000;
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): session consistency as std-dev seconds`

### Task A3: In-session fade (last-third vs first-third)

**Step 1 — failing test:**

```typescript
import { sessionFadeSeconds } from '../analytics-v2';

describe('sessionFadeSeconds', () => {
  it('reports positive seconds when the driver slows late', () => {
    // 8 laps: first ~90.0, last ~91.5 -> ~+1.5s fade
    const laps = [90000, 90000, 90000, 90500, 91000, 91500, 91500, 91500];
    const f = sessionFadeSeconds(laps);
    expect(f).not.toBeNull();
    expect(f!).toBeGreaterThan(1);
  });
  it('reports negative seconds when the driver builds pace', () => {
    const laps = [92000, 91500, 91000, 90500, 90000, 90000, 90000, 90000];
    expect(sessionFadeSeconds(laps)!).toBeLessThan(0);
  });
  it('returns null with fewer than 6 clean laps', () => {
    expect(sessionFadeSeconds([90000, 90000, 90000, 90000, 90000])).toBeNull();
  });
});
```

**Step 2 — run/fail. Step 3 — implement:**

```typescript
import { MIN_CLEAN_LAPS_FOR_FADE } from './analytics-constants';

function medianOf(values: number[]): number {
  return median([...values].sort((a, b) => a - b));
}

/** (last-third median − first-third median) of clean laps, in SECONDS. +ve = slowed late. Null if <6 clean laps. */
export function sessionFadeSeconds(lapTimesMs: Array<number | null>): number | null {
  const laps = cleanLaps(lapTimesMs);
  if (laps.length < MIN_CLEAN_LAPS_FOR_FADE) return null;
  const third = Math.ceil(laps.length / 3);
  const firstMed = medianOf(laps.slice(0, third));
  const lastMed = medianOf(laps.slice(-third));
  return (lastMed - firstMed) / 1000;
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): in-session fade in seconds`

### Task A4: Personal consistency baseline (control chart)

Baseline is computed from a driver's **prior** per-session consistency values (chronological,
excluding the session under test).

**Step 1 — failing test:**

```typescript
import { consistencyBaseline, isOffConsistencyBaseline } from '../analytics-v2';

describe('consistencyBaseline', () => {
  it('is null below the minimum prior-session count', () => {
    expect(consistencyBaseline([0.3, 0.35])).toBeNull(); // <3 priors
  });
  it('returns mean and upper/lower control limits', () => {
    const b = consistencyBaseline([0.30, 0.32, 0.34, 0.28])!;
    expect(b.mean).toBeCloseTo(0.31, 2);
    expect(b.upper).toBeGreaterThan(b.mean);
    expect(b.lower).toBeLessThan(b.mean);
  });
});

describe('isOffConsistencyBaseline', () => {
  it('flags a session wider than the upper control limit', () => {
    expect(isOffConsistencyBaseline(0.9, [0.30, 0.32, 0.34, 0.28])).toBe(true);
  });
  it('does not flag a normal session', () => {
    expect(isOffConsistencyBaseline(0.33, [0.30, 0.32, 0.34, 0.28])).toBe(false);
  });
  it('ignores breakouts smaller than the min delta (guards sigma~0)', () => {
    expect(isOffConsistencyBaseline(0.31, [0.30, 0.30, 0.30])).toBe(false);
  });
});
```

**Step 2 — run/fail. Step 3 — implement:**

```typescript
import {
  MIN_PRIOR_SESSIONS_FOR_BASELINE, BASELINE_SIGMA, BASELINE_MIN_DELTA_S,
} from './analytics-constants';

export interface Baseline { mean: number; upper: number; lower: number; }

/** Personal consistency band from PRIOR per-session std-dev values (seconds). Null if too few priors. */
export function consistencyBaseline(priorSeconds: number[]): Baseline | null {
  if (priorSeconds.length < MIN_PRIOR_SESSIONS_FOR_BASELINE) return null;
  const mean = priorSeconds.reduce((s, v) => s + v, 0) / priorSeconds.length;
  const variance =
    priorSeconds.reduce((s, v) => s + (v - mean) ** 2, 0) / (priorSeconds.length - 1);
  const sigma = Math.sqrt(variance);
  return { mean, upper: mean + BASELINE_SIGMA * sigma, lower: mean - BASELINE_SIGMA * sigma };
}

/** True when this session's spread breaks above the driver's personal upper limit by a meaningful margin. */
export function isOffConsistencyBaseline(sessionSeconds: number, priorSeconds: number[]): boolean {
  const b = consistencyBaseline(priorSeconds);
  if (!b) return false;
  return sessionSeconds > b.upper && sessionSeconds - b.mean >= BASELINE_MIN_DELTA_S;
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): personal consistency baseline + off-baseline flag`

### Task A5: Regression vs track personal best

**Step 1 — failing test:**

```typescript
import { isRegressedVsTrackPB } from '../analytics-v2';

describe('isRegressedVsTrackPB', () => {
  it('flags when session best is >1% slower than the prior track PB', () => {
    expect(isRegressedVsTrackPB(92000, [90000, 90500])).toBe(true); // 92000 vs PB 90000 = +2.2%
  });
  it('does not flag within 1% of PB', () => {
    expect(isRegressedVsTrackPB(90500, [90000, 90500])).toBe(false);
  });
  it('does not flag when there is no prior best at this track', () => {
    expect(isRegressedVsTrackPB(92000, [])).toBe(false);
  });
});
```

**Step 2 — run/fail. Step 3 — implement:**

```typescript
import { PB_REGRESSION_PCT } from './analytics-constants';

/** True when sessionBestMs is >PB_REGRESSION_PCT slower than the min of priorBestsMs (same track). */
export function isRegressedVsTrackPB(sessionBestMs: number, priorTrackBestsMs: number[]): boolean {
  const valid = priorTrackBestsMs.filter((t) => t > 0);
  if (valid.length === 0 || !(sessionBestMs > 0)) return false;
  const pb = Math.min(...valid);
  return sessionBestMs > pb * (1 + PB_REGRESSION_PCT);
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): track-PB regression flag`

### Task A6: Ideal lap + gap-to-ideal (sector-gated)

Sector data shape must match what the DB stores. **Before writing this task's test, confirm the
`sector_data` JSON shape** by reading `web/src/lib/types/database.ts` (the `sessions.sector_data`
column) and one seed example in `web/scripts/seed-demo-drivers.sql`. Adjust the parse to the real
shape. The test below assumes `sector_data` is `{ laps: Array<{ sectors: number[] }> }` (ms per
sector) — **fix the fixture to reality if it differs.**

**Step 1 — failing test:**

```typescript
import { idealLapMs, gapToIdealSeconds } from '../analytics-v2';

describe('idealLapMs', () => {
  it('sums the best sector across laps', () => {
    const s = { laps: [{ sectors: [30000, 31000, 29000] }, { sectors: [29500, 30500, 29500] }] };
    expect(idealLapMs(s)).toBe(29500 + 30500 + 29000); // 89000
  });
  it('returns null when sector data is missing or malformed', () => {
    expect(idealLapMs(null)).toBeNull();
    expect(idealLapMs({ laps: [] })).toBeNull();
  });
});

describe('gapToIdealSeconds', () => {
  it('returns fastest actual lap minus ideal, in seconds', () => {
    const s = { laps: [{ sectors: [30000, 31000, 29000] }, { sectors: [29500, 30500, 29500] }] };
    // fastest actual = 89500 (lap 2), ideal = 89000 -> 0.5s
    expect(gapToIdealSeconds(s)!).toBeCloseTo(0.5, 2);
  });
});
```

**Step 2 — run/fail. Step 3 — implement** (adjust the type to real shape):

```typescript
interface SectorData { laps?: Array<{ sectors?: number[] }>; }

/** Theoretical best lap = sum of fastest sector across laps (ms). Null if data absent/malformed. */
export function idealLapMs(sectorData: SectorData | null): number | null {
  const laps = sectorData?.laps?.filter((l) => Array.isArray(l.sectors) && l.sectors.length > 0);
  if (!laps || laps.length === 0) return null;
  const count = laps[0].sectors!.length;
  const best = new Array(count).fill(Infinity);
  for (const lap of laps) {
    if (lap.sectors!.length !== count) return null;
    lap.sectors!.forEach((ms, i) => { if (ms > 0 && ms < best[i]) best[i] = ms; });
  }
  if (best.some((b) => !isFinite(b))) return null;
  return best.reduce((s, b) => s + b, 0);
}

/** Fastest actual lap − ideal lap, in seconds. Null if sector data absent. */
export function gapToIdealSeconds(sectorData: SectorData | null): number | null {
  const ideal = idealLapMs(sectorData);
  if (ideal === null) return null;
  const actuals = (sectorData!.laps || [])
    .map((l) => (l.sectors || []).reduce((s, ms) => s + ms, 0))
    .filter((ms) => ms > 0);
  if (actuals.length === 0) return null;
  return (Math.min(...actuals) - ideal) / 1000;
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): ideal lap + gap-to-ideal (sector-gated)`

### Task A7: Flag assembly + severity for one student

Ties the pieces into the per-student result the dashboard renders. Input is a normalized
per-driver history (built in Phase B); this function stays pure and fully tested.

**Step 1 — failing test:**

```typescript
import { evaluateStudent, StudentHistory } from '../analytics-v2';

const base: StudentHistory = {
  runGroup: 'beginner',
  sessions: [], // chronological asc; latest last
};

describe('evaluateStudent', () => {
  it('returns building-baseline state and fade-only for a thin-data student', () => {
    const h: StudentHistory = { ...base, sessions: [
      { date: '2026-01-01', trackId: 't1', bestLapMs: 90000,
        lapTimesMs: [90000,90000,90000,90500,91000,91500,91500,91500] }, // fades
    ]};
    const r = evaluateStudent(h);
    expect(r.baselineState).toBe('building');
    expect(r.flags.map(f => f.kind)).toContain('faded');
    expect(r.flags.map(f => f.kind)).not.toContain('off_baseline');
  });

  it('ranks a multi-flag sustained student above a single-flag student', () => {
    // (construct two histories; assert severityScore ordering)
  });
});
```

Flesh out the second test with two concrete histories before implementing.

**Step 2 — run/fail. Step 3 — implement:**

```typescript
import { SPARKLINE_WINDOW } from './analytics-constants';

export type FlagKind = 'faded' | 'regressed' | 'off_baseline';
export interface Flag { kind: FlagKind; why: string; deltaSeconds: number; sustained: boolean; }

export interface StudentSession {
  date: string; trackId: string; bestLapMs: number | null; lapTimesMs: Array<number | null>;
  sectorData?: unknown | null;
}
export interface StudentHistory { runGroup: string; sessions: StudentSession[]; }

export interface StudentEval {
  flags: Flag[];
  severityScore: number;
  baselineState: 'ok' | 'building';
  sessionConsistencySeconds: number | null;
  sparkline: number[]; // last N session bests (ms)
  ready: boolean;
  readyWhy: string | null;
}

export function evaluateStudent(h: StudentHistory): StudentEval {
  const sessions = [...h.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sessions[sessions.length - 1];
  const prior = sessions.slice(0, -1);
  const flags: Flag[] = [];

  const priorConsistency = prior
    .map((s) => sessionConsistencySeconds(s.lapTimesMs))
    .filter((v): v is number => v !== null);
  const baselineState =
    priorConsistency.length >= MIN_PRIOR_SESSIONS_FOR_BASELINE ? 'ok' : 'building';

  const latestConsistency = latest ? sessionConsistencySeconds(latest.lapTimesMs) : null;

  // faded
  const fade = latest ? sessionFadeSeconds(latest.lapTimesMs) : null;
  if (fade !== null && fade > FADE_THRESHOLD_S) {
    const priorFade = prior.length ? sessionFadeSeconds(prior[prior.length - 1].lapTimesMs) : null;
    flags.push({
      kind: 'faded', deltaSeconds: fade, sustained: priorFade !== null && priorFade > FADE_THRESHOLD_S,
      why: `Slowed ${fade.toFixed(1)}s from start to finish`,
    });
  }
  // off baseline
  if (baselineState === 'ok' && latestConsistency !== null &&
      isOffConsistencyBaseline(latestConsistency, priorConsistency)) {
    const b = consistencyBaseline(priorConsistency)!;
    flags.push({
      kind: 'off_baseline', deltaSeconds: latestConsistency - b.mean, sustained: false,
      why: `Lap times swinging wider than usual (±${latestConsistency.toFixed(1)}s vs ±${b.mean.toFixed(1)}s typical)`,
    });
  }
  // regressed vs track PB
  if (latest && latest.bestLapMs) {
    const priorBests = prior.filter((s) => s.trackId === latest.trackId)
      .map((s) => s.bestLapMs).filter((v): v is number => v !== null && v > 0);
    if (isRegressedVsTrackPB(latest.bestLapMs, priorBests)) {
      const pb = Math.min(...priorBests);
      const deltaS = (latest.bestLapMs - pb) / 1000;
      const priorSlower = prior.length >= 2 &&
        isRegressedVsTrackPB(prior[prior.length - 1].bestLapMs ?? 0, priorBests.slice(0, -1));
      flags.push({
        kind: 'regressed', deltaSeconds: deltaS, sustained: priorSlower,
        why: `Best lap ${deltaS.toFixed(1)}s off your track PB`,
      });
    }
  }

  const severityScore = flags.reduce(
    (s, f) => s + Math.abs(f.deltaSeconds) * (f.sustained ? 2 : 1), 0);

  const sparkline = sessions.map((s) => s.bestLapMs).filter((v): v is number => v !== null)
    .slice(-SPARKLINE_WINDOW);

  const { ready, readyWhy } = evaluateReadiness(sessions, priorConsistency, latestConsistency);

  return { flags, severityScore, baselineState, sessionConsistencySeconds: latestConsistency,
    sparkline, ready, readyWhy };
}
```

Add `evaluateReadiness` (Task A8) referenced above.

**Step 4 — pass. Step 5 — commit:** `feat(analytics): per-student flag assembly + severity`

### Task A8: Readiness-to-advance (positive mirror)

**Step 1 — failing test:** a student with `>=READINESS_MIN_SESSIONS` clean sessions, no recent
fade, and consistency trending *below* their baseline mean (tighter than usual) returns
`ready === true` with a `readyWhy` string; a thin/regressing student returns `false`.

**Step 2 — run/fail. Step 3 — implement** (humble, never auto-promotes — just a nudge):

```typescript
import { READINESS_MIN_SESSIONS } from './analytics-constants';

function evaluateReadiness(
  sessions: StudentSession[], priorConsistency: number[], latestConsistency: number | null,
): { ready: boolean; readyWhy: string | null } {
  const cleanCount = sessions.filter((s) => sessionConsistencySeconds(s.lapTimesMs) !== null).length;
  if (cleanCount < READINESS_MIN_SESSIONS) return { ready: false, readyWhy: null };
  const b = consistencyBaseline(priorConsistency);
  const latest = sessions[sessions.length - 1];
  const noRecentFade = (() => {
    const f = latest ? sessionFadeSeconds(latest.lapTimesMs) : null;
    return f !== null && f <= FADE_THRESHOLD_S;
  })();
  const tightening = b !== null && latestConsistency !== null && latestConsistency < b.mean;
  if (tightening && noRecentFade) {
    return {
      ready: true,
      readyWhy: `Settling in — tight consistency, holding pace late, ${cleanCount} clean sessions`,
    };
  }
  return { ready: false, readyWhy: null };
}
```

**Step 4 — pass. Step 5 — commit:** `feat(analytics): readiness-to-advance signal`

### Task A9: Phase A gate

Run `cd web && npm test`. Expected: all green (new suite added, nothing else touched). Commit only
if a fixup was needed.

---

## Phase B — Dashboard data layer rewrite (TDD where pure, integration-checked where not)

**Files:**
- Modify: `web/src/data/coachDashboard.ts` (rewrite the computed shape + add `experience_level` join)
- Modify: `web/src/app/api/coach/dashboard/route.ts` (only if the response envelope changes)
- Test: `web/src/data/__tests__/coachDashboard.test.ts` (new — test the pure transform, mock rows)

### Task B1: Extract a pure transform

The current `getCoachDashboardData` mixes Supabase I/O with computation (`coachDashboard.ts:38-253`).
Extract the computation into a pure exported function so it's unit-testable:

`buildStudents(rows: SessionRow[]): CoachDashboardStudent[]` where `SessionRow` is the normalized
row (driver, track, date, best_lap_ms, laps[], experience_level, sector_data). The async
`getCoachDashboardData` becomes: fetch → normalize rows → `buildStudents`.

New output interface (replaces `CoachDashboardDriver`):

```typescript
export interface CoachDashboardStudent {
  driverId: string; driverName: string; driverEmail: string;
  runGroup: string;                    // experience_level
  lastTrackName: string; bestLapMs: number | null; avgBestLapMs: number | null;
  sessionConsistencySeconds: number | null; // latest session std-dev in seconds
  sessionCount: number; totalLaps: number; lastSessionDate: string | null;
  flags: Flag[]; severityScore: number; baselineState: 'ok' | 'building';
  sparkline: number[]; ready: boolean; readyWhy: string | null;
}
```

`buildStudents` groups rows by driver, builds a `StudentHistory`, calls `evaluateStudent`, and maps
the result. **TDD:** write `coachDashboard.test.ts` with 2–3 hand-built row fixtures asserting a
flagged student, a building-baseline student, and a ready student appear correctly. Red → green →
commit `feat(dashboard): pure buildStudents transform on analytics-v2`.

### Task B2: Wire the query (fetch experience_level + sector_data)

Update the Supabase select in `getCoachDashboardData` to also pull `driver_profiles.experience_level`
(join on `drivers`) and `sessions.sector_data`. Confirm the join path against
`web/src/lib/types/database.ts`. Because this hits the DB, verify by running the app against the
seeded DB rather than a unit test:

Run: `cd web && npm run dev`, load `/coach`, confirm the API returns students with `runGroup`,
`flags`, and `severityScore` populated (check the Network tab / server logs). Commit
`feat(dashboard): fetch run group + sector data for new rollup`.

### Task B3: Phase B gate

`cd web && npm test` green; `/coach` API shape validated manually. Remove the legacy
`console.log` debug spam in `coachDashboard.ts` while here (memory notes it's noisy).

---

## Phase C — Coach dashboard UI (three zones)

**Files:**
- Modify: `web/src/app/coach/page.tsx` (rewrite render; keep fetch/sort/search scaffolding)
- Create: `web/src/components/coach/TriageQueue.tsx`
- Create: `web/src/components/coach/RosterByRunGroup.tsx`
- Create: `web/src/components/coach/StudentSparkline.tsx` (Recharts, baseline band)
- Create: `web/src/components/coach/FlagChip.tsx`
- Remove usage of: `web/src/components/ui/BehaviorBar.tsx` (deletion in Phase E)

These are presentational; validate with `webapp-testing` / manual review, not unit tests (keep the
gate meaningful). Each task ends by loading `/coach` against seeded data and eyeballing.

### Task C1: StudentSparkline + FlagChip primitives
- `StudentSparkline({ points, baseline })`: a ~64×20 Recharts `LineChart`, hidden axes, with an
  optional shaded `ReferenceArea` for the personal-baseline band. No dots except the last point.
- `FlagChip({ flag })`: small pill; icon + short label; colour by severity (amber default, red when
  `sustained`). Text label always present (colourblind-safe).
- Commit `feat(coach): sparkline + flag chip primitives`.

### Task C2: TriageQueue
- Props: `students: CoachDashboardStudent[]`. Filter to `flags.length > 0`, sort by
  `severityScore` desc. Empty state: "No students need a debrief right now."
- Row: name + run-group badge · `why` (first/most-severe flag) · extra `FlagChip`s · signed delta ·
  `StudentSparkline`. Link to `/drivers/[id]`.
- Replaces the old `BottomFiveCard`. Commit `feat(coach): triage queue`.

### Task C3: RosterByRunGroup
- Props: `students`. Group by `runGroup` into Novice/Intermediate/Advanced bands (map
  beginner→"Novice"). Each band: count, a "ready to advance" callout listing `ready` students with
  `readyWhy`, then rows with honest columns (Best lap · **±0.Xs consistency** with off-baseline
  marker · sparkline · Sessions · Last session). No BehaviorBar.
- Keep the existing search box filtering within bands. Commit `feat(coach): run-group roster + readiness callout`.

### Task C4: Assemble page + KPI strip
- Rewrite `coach/page.tsx` body: KPI strip (Drivers · Sessions · Best lap · **Needs debrief: N** ·
  **Progressing: N**), then `<TriageQueue>`, then `<RosterByRunGroup>`. Remove `BehaviorBar` import,
  `BottomFiveCard`, `TopFiveCard`, and the `demoHighlightCards` block. Update copy to "students".
- Commit `feat(coach): three-zone dashboard assembly`.

### Task C5: Phase C gate
`cd web && npm test` green (UI removed no logic tests; any test referencing `BehaviorBar`/old shape
updated). Manual: `/coach` renders queue + roster correctly on seeded data.

---

## Phase D — Driver detail: level control + deeper analysis + fixes

**Files:**
- Modify: `web/src/app/api/profile/update/route.ts` (add ownership check)
- Create: `web/src/components/drivers/RunGroupControl.tsx`
- Modify: `web/src/app/drivers/[driverId]/page.tsx` (mount RunGroupControl; pass profile)
- Modify: `web/src/components/drivers/ProgressStats.tsx` (baseline-aware colouring)
- Modify: `web/src/components/drivers/ProgressCharts.tsx` (axis fixes)

### Task D1: Ownership check on profile update (TDD)
`updateDriverProfile` runs under the coach's RLS session, but the route must not update a driver the
coach can't see. Add an explicit check: fetch the driver via the server client and 403 if not
visible. Test: `web/src/app/api/profile/update/__tests__/route.test.ts` — mock `getCurrentCoach` +
supabase to assert 403 when the driver isn't returned, 200 when it is. Red → green → commit
`fix(profile): scope level updates to the coach's own students`.

### Task D2: RunGroupControl on driver detail
- `RunGroupControl({ driverId, current, readyWhy })`: three-option control (Novice/Intermediate/
  Advanced) posting to `/api/profile/update`; shows the readiness nudge when present; copy framed as
  a sign-off ("Advance to Intermediate"), explicitly "your call — in-car judgment required."
- Mount it on `drivers/[driverId]/page.tsx`. The page must fetch the viewed driver's profile
  (add `getDriverProfile(driverId)` server-side or via an API route). Commit
  `feat(drivers): per-student run-group control`.

### Task D3: Fix mixed-signal ProgressStats colouring
`ProgressStats.tsx` currently colours a card border by the sign of a tiny consistency delta
(96→99 shows red "decline"). Change: only apply amber/red when the change clears the personal
baseline band (reuse `consistencyBaseline`); otherwise neutral. Update captions to match. If a test
pins the old behaviour, update it. Commit `fix(drivers): baseline-aware progress colouring`.

### Task D4: Fix charts
In `ProgressCharts.tsx` (and `LapTimeChart`/`LapAnalysisChart` if they share the axes):
- Same-day sessions must disambiguate on the x-axis — label by session (date + index/time), not a
  bare repeated date.
- Consistency chart y-axis must not hard-start at 70; plot std-dev in real seconds with a domain
  derived from the data (e.g. `[0, max*1.1]`). Commit `fix(charts): honest axes for same-day + consistency`.

### Task D5: Phase D gate
`cd web && npm test` green; manual pass on a driver-detail page (level control saves, colours honest,
axes readable).

---

## Phase E — Retire legacy + cleanup

### Task E1: Retire the `/profile` first-driver level editor
`web/src/app/profile/page.tsx` edits "the first driver" (`:15-20`). Now that the per-student control
lives on driver detail, remove the level-editing `ProfileForm` from `/profile` (leave the page as
driver's own read-only info, or redirect — confirm intended `/profile` purpose with the codebase
owner if ambiguous). Commit `refactor(profile): remove demo first-driver level editor`.

### Task E2: Delete dead behaviour code
Once nothing imports them, delete `calculateDrivingBehavior`/`calculateBehaviorScore` and the
duplicate consistency composite from `analytics.ts`, delete `BehaviorBar.tsx`, and update
`insights.ts` + `insights.test.ts` (drop `drivingBehaviorScore`, `INSIGHT_HELPERS.behavior`; keep
pace-trend). Grep first: `git grep -n "Behavior\|behaviorScore\|BehaviorBar\|calculateConsistencyScore"`.
Update/replace any remaining consumers to `analytics-v2`. Commit `refactor(analytics): remove duplicate behaviour/consistency composites`.

### Task E3: Final gate
`cd web && npm test` — full suite green (expect the count to change as behaviour tests are removed
and analytics-v2 tests added; the suite must be green with no skips). `git grep` shows no remaining
references to deleted symbols. `npm run build` succeeds.

---

## Definition of done
- `/coach` shows KPI strip → triage queue → run-group roster with readiness callouts; no BehaviorBar,
  no duplicate columns, no 0–100 composites.
- Consistency shown as ±0.Xs; flags carry one-line whys in tenths; colours neutral-by-default.
- Driver detail sets run group per-student (ownership-checked), shows fade/PB/baseline/gap-to-ideal,
  honest colours and axes.
- `/profile` no longer edits an arbitrary first driver.
- Full `npm test` green; `npm run build` green; no dead behaviour code.
- All thresholds live in `analytics-constants.ts`.
```
