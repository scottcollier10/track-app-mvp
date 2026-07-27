# Demo Seed Data — Design

Validated in brainstorm session 2026-07-27. Supersedes the open questions in
`2026-07-20-demo-seed-data-brainstorm-brief.md`.

## Goal

Seed the prod pilot database with six demo students whose lap histories each
trip a different triage state on the `/coach` dashboard, so a demo shows the
analytics discriminating between students instead of one lonely `faded` flag.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Environment | Prod directly. No local Supabase rehearsal — flag correctness is verified in TypeScript, not in a database. |
| Stories | All 6 (Fader, Regressor, Inconsistent, Progressing, Newcomer, Steady veteran). |
| Method | TS generator that imports the real `evaluateStudent` and self-verifies flags before emitting SQL. |
| `sector_data` | Deferred. Its shape depends on the session-page-consolidation brainstorm (which absorbs issue #25). Retrofit is cheap: add sector arrays to one scenario block and re-run the idempotent generator. |
| Old seed rows | Purge. Counts shown and approved before any delete. |
| Dates | Relative offsets resolved at generation time — re-run any time to refresh the demo timeline. |

## Key finding: `cleanup-demo-data.sql` is not a cleanup script

`web/supabase/scripts/cleanup-demo-data.sql` *mutates* data: it randomizes lap
times across **all** drivers (no namespace filter), deletes drivers down to a
count of 20, and rewrites session bests. Running it on prod would scramble real
pilot data. It is not extended or used by this plan. A new, properly scoped
purge script replaces it for demo-data resets.

## Artifacts

All new files live in `web/scripts/seed/`.

### 1. `demo-scenarios.ts`

The six student definitions: name, email in the `@trackapp.demo` namespace,
`experience_level`, track per session, and per-session lap arrays as explicit
millisecond values. Deterministic — no randomness — so output is reproducible
and auditable. Session dates are **offsets from now** (e.g. "latest: 3 days
ago; priors: 10, 17, 24 days ago"), anchored to weekend days for HPDE realism.

### 2. `generate-demo-seed.ts`

Run via `npx tsx`. For each student:

1. Resolves date offsets to concrete dates.
2. Runs the full session history through `evaluateStudent` from
   `@/lib/analytics-v2` — the same code the dashboard runs.
3. Asserts the student produces exactly the expected flags / state. Any
   mismatch → hard fail with expected-vs-actual diff. Nothing is emitted.
4. On full pass, prints a flag report (`Kai Garcia → faded ✓` …) and writes
   `demo-seed.sql`.

The emitted SQL upserts on stable namespaced UUIDs (prefix `dd000001-…`) so
re-runs update in place — refreshing dates without duplicating rows. Every
driver row sets `coach_id` from a `\set` variable resolved at run time against
prod; never hard-coded.

### 3. `purge-demo-data.sql`

Full-reset script scoped to `drivers.email LIKE '%@trackapp.demo'` — catches
both the Dec 2025 `11111111-…` drivers and the new cast. Two blocks:

1. **Count block (read-only):** per-table counts of what would be deleted
   (drivers, driver_profiles, sessions, laps, coaching_notes). Run first,
   review, approve.
2. **Delete block:** the deletes, in a single transaction, child tables first.

Purge is only for full reset. A demo refresh is just re-running the generator
and seed — no purge needed.

## The six students

Base laps ~90s (Thunderhill/Sonoma scale). Thresholds from
`web/src/lib/analytics-constants.ts`.

| # | Student | State | Level | Recipe |
|---|---|---|---|---|
| 1 | Kai Garcia (Fader) | `faded` | beginner | 4 sessions; latest has 9 clean laps, last-third median ~0.7s slower than first-third (> 0.5s threshold). |
| 2 | The Regressor | `regressed`, sustained | intermediate | 3 sessions, same track. PB 89.4s in session 1; latest best 90.6s (~1.3% > 1% threshold). Session 2 also off PB → sustained, 2× severity, tops triage queue. |
| 3 | The Inconsistent | `off_baseline` | intermediate | 4 sessions; first three σ ≈ 0.25s, latest σ ≈ 0.9s — past mean + 2σ of prior std-devs and > 0.1s min delta. |
| 4 | The Progressing one | `ready` | advanced | 5 clean sessions, no fade, latest σ below personal baseline mean, bests gently improving. Demos blue Progressing + RunGroupControl sign-off. |
| 5 | The Newcomer | `building` | beginner | 1 session, 5 laps, unremarkable. No baseline, grey, no judgment. |
| 6 | The Steady veteran | no flags | advanced | 6 sessions, moderate consistent σ, bests within ±1% of PB. The quiet control. |

Dashboard math: 3 need debrief, 1 progressing, 2 quiet. Levels populate all
three run-group sections.

## Prod workflow

Connection: `psql` with the direct Postgres string. The DB password reset is
safe — nothing in the repo uses the direct connection (the app uses Supabase
API keys). Note: direct connection requires IPv6.

1. **Recon (read-only).** Confirm `drivers.coach_id` exists, fetch the demo
   coach `id` from `coaches`, confirm the 5 tracks exist, snapshot row counts.
   Settles the schema-drift question from the brief.
2. **Purge preview.** Count block → Scott approves counts (expect ~4 drivers /
   ~48 sessions / ~750 laps from the Dec seed) → delete block in a transaction.
3. **Generate + verify.** Run generator locally; flag report must be all-pass.
4. **Seed.** Run `demo-seed.sql` in a transaction.
5. **Render check.** Log into the live app as the demo coach; verify `/coach`
   shows all six students in their intended states (proves RLS linkage).

## Constraints carried from the brief

- Copy language: students / instructor.
- Honest numbers: engineered to cross thresholds, but real lap arrays the
  analytics genuinely evaluate — no fabricated claims.
- Full `npm test` stays green (generator gets its own test asserting the six
  scenarios produce their intended flags, pinning them against future
  threshold changes).

## Hand-off note for session-page-consolidation

`sector_data` is intentionally absent. When that brainstorm settles the
gap-to-ideal question (issue #25), sector demo data is one scenario edit and
one generator re-run away — not a blocker, not a second migration.
