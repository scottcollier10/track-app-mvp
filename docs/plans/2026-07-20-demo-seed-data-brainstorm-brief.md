# Demo Seed Data — Brainstorm Brief

> **For Claude:** This is the starting brief for a brainstorming session. Use the superpowers:brainstorming skill — one question at a time, explore 2-3 approaches, then produce a design doc + implementation plan and execute subagent-driven. Scott has already validated the *need* (stale, single-story data); start from "which scenarios + which seed method," not "do we need this."

**Goal:** Seed the pilot database with **multi-scenario demo data that tells a story** — 4-6 students whose lap histories each trip a *different* triage signal on the `/coach` dashboard, so a demo/pitch shows the redesigned analytics discriminating between drivers instead of one lonely "faded" flag.

Today's single decent story is *"Kai Garcia: Slowed 0.7s from start to finish"* (a `faded` flag). We want at least 3-4 distinct, defensible stories side by side.

---

## Why now / what's wrong with current data

1. **RLS orphaning (the big one).** The existing seed script `web/scripts/seed-demo-drivers.sql` (Dec 2025, 4 drivers / 48 sessions / ~750 laps) inserts drivers **without a `coach_id`**. The coach-scoped RLS added in week 2 (`web/supabase/migrations/20260718_coach_scoped_rls.sql`) filters `drivers` by `coach_id = current_coach_id()`. **Any driver with a null/foreign `coach_id` is invisible to the dashboard.** This is likely the real reason the data looks "stale" — it may not be rendering at all under the authenticated demo coach.
2. **Schema drift.** The `coaches` table and `drivers.coach_id` column were **applied manually in the Supabase dashboard** during week 2 (the RLS migration notes "Applied manually … AFTER the week-2 code deploy"). Their DDL is **not fully in the repo migrations**. So step 1 of any seed work is: query the target DB for the real coach `id` and confirm `drivers.coach_id` exists. Don't trust the repo migration files as the full schema.
3. **Single story.** Even if it rendered, the old data was built for the *old* composite-score charts, not the new within-driver triage flags. The numbers weren't engineered to cross the new thresholds.

---

## Codebase grounding

### Tables (see `web/supabase/migrations/20240101_initial_schema.sql` + `supabase/migrations/004_add_driver_profiles.sql`)

- `drivers` — `id, name, email, created_at` **+ `coach_id`** (added manually in prod; per-coach unique on `(coach_id, email)`).
- `driver_profiles` — `driver_id (unique), experience_level ∈ {beginner|intermediate|advanced}, total_sessions`. Drives run-group grouping on the dashboard (`RosterByRunGroup`) and defaults to `beginner` when null.
- `tracks` — `id, name, location, length_meters, config`. Seeded set includes Laguna Seca, Thunderhill, Buttonwillow, Sonoma, Streets of Willow. **Regression is per-track**, so multi-session-same-track matters (below).
- `sessions` — `id, driver_id, track_id, date, total_time_ms, best_lap_ms, source, created_at`.
- `laps` — `id, session_id, lap_number, lap_time_ms, sector_data (JSONB), created_at`, `UNIQUE(session_id, lap_number)`.
- `coaching_notes` — session-scoped free text.
- `coaches` — `id, auth_user_id, email` (invite-only, single demo coach).

### The analytics that turn laps into stories (`web/src/lib/analytics-v2.ts` + `analytics-constants.ts`)

`evaluateStudent(history)` sorts a driver's sessions by date, treats the **latest** as the one being judged and everything before it as **priors**, and emits flags. Seed numbers must cross these exact thresholds:

| Constant | Value | Meaning for seeding |
|---|---|---|
| `CLEAN_LAP_MAX_MULTIPLE` | `1.25` | Laps slower than 1.25× the session median are dropped as out/in/pit/traffic. Keep normal laps under this unless intentionally modeling a pit lap. |
| `MIN_CLEAN_LAPS_FOR_FADE` | `6` | Fade needs ≥6 clean laps in the session. |
| `FADE_THRESHOLD_S` | `0.5` | last-third median − first-third median > 0.5s ⇒ **`faded`**. |
| `MIN_PRIOR_SESSIONS_FOR_BASELINE` | `3` | Consistency baseline needs ≥3 **prior** sessions (each with ≥2 clean laps). So the judged session must be the **4th+**. |
| `BASELINE_SIGMA` | `2` | Personal band = mean ± 2σ of prior per-session std-devs. |
| `BASELINE_MIN_DELTA_S` | `0.1` | Breakouts smaller than 0.1s ignored (guards σ≈0). |
| `PB_REGRESSION_PCT` | `0.01` | latest `best_lap_ms` > 1.01 × prior track PB ⇒ **`regressed`**. |
| `READINESS_MIN_SESSIONS` | `4` | "Progressing/Ready" needs ≥4 clean sessions + tightening consistency + no recent fade. |
| `SPARKLINE_WINDOW` | `8` | Last 8 session-bests drawn in the row sparkline. |

Flags produced: **`faded`**, **`regressed`**, **`off_baseline`**. Plus `ready` (Progressing) and `baselineState: 'building' | 'ok'`. Dashboard KPIs: *Needs debrief* = any flag; *Progressing* = `ready`. Triage queue sorts by `severityScore` (Σ |deltaSeconds| × 2 if sustained).

`sector_data` (JSONB per lap) feeds the **gap-to-ideal** metric — but that surface is deferred to **issue #25**. Optional: seed sector splits on 1 driver now so the metric has data to demo later.

---

## Candidate story catalog (map to real flags — refine in session)

Each row = one seedable student. Aim for a mix so the dashboard isn't all-red — contrast is the story.

1. **The Fader** *(needs debrief — `faded`)* — latest session ≥6 clean laps, last-third ~0.7s slower than first-third. (Kai Garcia today.)
2. **The Regressor** *(needs debrief — `regressed`)* — ≥1 prior session at the **same track**; latest `best_lap_ms` >1% off that track PB. Sustained (2×) if the prior session was also off PB → higher severity.
3. **The Inconsistent** *(needs debrief — `off_baseline`)* — ≥3 prior sessions with a tight std-dev band, then a latest session whose spread blows past mean+2σ (by ≥0.1s). "Lap times swinging wider than usual."
4. **The Progressing one** *(advance — `ready`, blue)* — ≥4 clean sessions, latest std-dev below personal baseline mean, no late fade. Demos the positive/advance path + the RunGroupControl sign-off.
5. **The Newcomer** *(neutral — `building`)* — 1-2 sessions only; no baseline yet, grey/no-judgment. Shows the honest "not enough data" state.
6. **The Steady veteran** *(control — no flags)* — lots of history, nothing breaks out. Proves the dashboard stays quiet when it should.

Spread `experience_level` across beginner/intermediate/advanced so the **run-group sections** all populate.

---

## Seed method — the open decision

Scott's toolkit: n8n workflows, Python scripts, CSV upload, copy/paste SQL (how it was first seeded). Tradeoffs for *this* job (precise, threshold-crossing, RLS-linked, repeatable):

- **A. Parametric generator (TS/Node) → idempotent SQL or service-role upsert.** A small script defines each scenario, computes lap arrays that cross the exact thresholds, and — because the analytics live in TS — can **import `evaluateStudent` and assert each generated student trips the intended flag before emitting**. Self-verifying, re-runnable, tweakable. Highest leverage.
- **B. Hand-tuned SQL** (extend `seed-demo-drivers.sql`). Matches the original method and is fast to start, but hitting fade/regression/2σ by hand is error-prone and has no verification. **Must add `coach_id`** to every driver this time.
- **C. CSV upload through the real import UI.** Templates exist (`web/public/track-app-*-template.csv`, header `session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source`) and it exercises the real ingest path. But: one session per file, manual clicking, and no direct control over `experience_level` or `coach_id` — tedious for 6 drivers × 4-6 sessions.
- **D. n8n / Python.** Those were built for HubSpot; no advantage over A/B for local Postgres. Skip unless there's a reuse reason.

**Direction to explore first:** hybrid **A** — a TS generator that emits one idempotent SQL artifact **and** self-checks against `analytics-v2` — because the whole point is that each driver *provably* produces the right flag. Fall back to **B** if the generator is overkill for a one-off demo.

---

## Constraints

- **RLS is non-negotiable:** every seeded driver needs `coach_id = <the demo coach's id>`. Confirm that id against the live DB first; confirm the target environment (prod-behind-invite vs local).
- Idempotent + reversible: pair the seed with a cleanup (see `web/supabase/scripts/cleanup-demo-data.sql`) so demos can reset. Use stable/namespaced UUIDs like the old script's `1111…`.
- Copy language: **students / instructor**, not drivers / coach.
- Data available per session: lap times (ms), lap numbers, optional `sector_data`, track, date, source. No telemetry.
- Real, honest numbers — data engineered to cross a threshold is fine; fabricated *claims* are not (that's what the redesign just removed).
- Sessions are often same-day (HPDE weekends) — fine, but each session needs enough clean laps for its intended flag (≥6 for fade, ≥2 for a std-dev).

## Open questions for the session

1. Target environment + the real demo coach `id`? (And is `drivers.coach_id` confirmed present?)
2. How many students / which of the 6 stories make the cut for the pitch?
3. Seed method: generator (A) vs hand SQL (B) — and do we want the self-verify step?
4. Seed `sector_data` on ≥1 student now to pre-stage the issue #25 gap-to-ideal demo?
5. Reset story — extend `cleanup-demo-data.sql` to match the new UUID namespace?

## Process

Brainstorm → design doc (`docs/plans/YYYY-MM-DD-demo-seed-data-design.md`) → implementation plan → subagent-driven execution off `main`. Verify the seed renders under the authenticated demo coach (RLS!) before calling it done.
