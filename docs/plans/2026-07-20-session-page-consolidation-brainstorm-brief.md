# Session Page Consolidation — Brainstorm Brief

> **For Claude:** Starting brief for a brainstorming session. Use the superpowers:brainstorming skill (one question at a time, explore 2-3 approaches) to settle the open design questions, then produce a design doc + implementation plan and execute subagent-driven in an isolated session. The UI work uses the **frontend-design** skill. Scott has validated the direction (merge the two pages, keep all the data); start from "how do we structure it," not "should we."

**Goal:** Merge `/sessions/[id]` (Session Detail) and `/sessions/[id]/analysis` (Lap Analysis) into **one page** that keeps all the current data but drops the duplication — using the nicer chart and table from the analysis page, organized with a tab system so nothing gets crammed. **Fold in the honest-metrics migration (issue #25)** so these surfaces get rewritten once, not twice.

---

## Why now / the two problems this solves

1. **Heavy overlap between two routes.** The detail and analysis pages both render summary stats, a consistency score, a lap chart, and a lap table. The analysis versions are strictly nicer (±1σ band chart, fastest+slowest table). Two pages, one job.
2. **Honesty debt (issue #25) lives on these exact files.** #25 already plans to kill the duplicate `Driving Behavior /100`, express consistency as ±0.Xs, and update `lib/insights.ts` + the AI prompt — all on `sessions/[id]/page.tsx` and `sessions/[id]/analysis/page.tsx`. Doing #25 separately *and then* consolidating means editing the same code twice with merge risk. **This effort should absorb #25.**

---

## Current state (grounded in code — verify at session start)

### `/sessions/[id]` — `web/src/app/sessions/[id]/page.tsx`

- Header (track, driver, date, location, `SourceBadge`, `ShareSessionButton`)
- Summary stats: **Total Time · Best Lap · Laps** (`MetricCard` ×3)
- **Session Insights** (laps ≥6, else `EmptyInsights`):
  - Consistency **/100** (`ScoreCard`, line 156) ← #25 target
  - Pace Trend + `Sparkline` (honest — keep)
  - Driving Behavior **/100** (`ScoreCard`, line 179) ← #25 target, *duplicate of Consistency*
  - "View Detailed Analysis →" link to `/analysis` (line 143, shown when laps ≥5)
- `AICoachingCard` (laps ≥6)
- **Lap Times** chart via `LapTimeChart` ← replace with the analysis chart
- **Laps** table (Lap / Time / Delta) ← replace with the analysis table
- `CoachNotes` + add-note

### `/sessions/[id]/analysis` — `web/src/app/sessions/[id]/analysis/page.tsx` (requires ≥5 laps)

- Summary stats: **Best Lap · Average Lap · Consistency /100 · Total Time** (`calculateConsistencyScore`, line 47 ← #25 target)
- **Session Patterns** (`SessionPatterns` component) — heuristic detection: Cold Tires, Peak Performance Window, Tire Degradation, Exceptional Consistency; plus a "**Pattern Analysis**" explainer footer. *Not* a `/100` composite — descriptive, so keepable. Note its "varied by <2%" phrasing overlaps conceptually with the new std-dev language (design decision).
- **Lap Time Progression** chart (`LapAnalysisChart`, ±1σ consistency band) ← **bring to combined page**
- **Lap Details** table (`LapAnalysisTable`, fastest + slowest) ← **bring to combined page**

---

## Scott's direction (the shape to design around)

- **Combined page = the detail route** (`/sessions/[id]`) keeps everything.
- **Swap the chart:** replace `LapTimeChart` with `LapAnalysisChart` (Lap Time Progression, ±1σ band).
- **Swap the table:** replace the simple Laps table with `LapAnalysisTable` (fastest + slowest).
- **Tab system** to hold all the data without cramming, tentatively: **"Session Insights"** | **"Session Patterns"**.
- **Bring over** `SessionPatterns` + the Pattern Analysis explainer from the analysis page.
- Net effect: analysis content moves into detail; the standalone `/analysis` route is retired (redirect TBD — see below).

---

## Absorbing issue #25 (honest metrics)

Do these as part of the consolidation, not a separate PR (#25's own ordered plan, adapted):

1. **`lib/insights.ts`** — drop `drivingBehaviorScore` + `INSIGHT_HELPERS.behavior`; keep pace trend; switch consistency to std-dev seconds via `sessionConsistencySeconds` (`@/lib/analytics-v2`). Update `lib/__tests__/insights.test.ts`.
2. **Combined page Insights tab** — delete the Driving Behavior card; render Consistency as ±0.Xs (reuse `formatConsistencySeconds` from `components/drivers/consistencyBand.ts`). Honest set left: Consistency (±0.Xs) + Pace Trend.
3. **`api/coaching/generate/route.ts:158`** — remove the `Driving Behavior: X/100` line from the AI prompt (product-sensitive; confirm the coaching output still reads well).
4. **Analysis-derived summary stats** — replace the `/100` consistency in the (now merged) stats with std-dev seconds; drop `calculateConsistencyScore` usage.
5. **`lib/queries/driver-progress.ts:185`** — `calculateConsistencyScore` → seconds (feeds `/api/drivers/[id]/progress-summary`).
6. **`lib/analytics.ts`** — delete the dead composites (`calculateDrivingBehavior`/`calculateBehaviorScore` + duplicate consistency) once no importer remains; `git grep` clean.

---

## Design questions to resolve in the brainstorm

- **Tab taxonomy.** What exactly lives under "Session Insights" vs "Session Patterns" once metrics are honest? Where do the summary stats, the chart, and the lap table go — inside a tab, or always-visible above the tabs? (Header + summary stats + AI coaching arguably stay global; tabs hold the two analysis lenses.)
- **`/analysis` retirement.** Redirect `/sessions/[id]/analysis` → `/sessions/[id]` (that URL is shareable via `ShareSessionButton`, so dead links matter), or hard-remove? Preserve deep-link-to-tab (e.g. `?tab=patterns`)?
- **Two lap thresholds today** (detail Insights ≥6, analysis ≥5). Pick one unified gate + a single empty state.
- **Chart consistency band.** `LapAnalysisChart` draws a ±1σ band computed inline (population σ). Does the combined page keep that visual, and does its σ math need to align with `analytics-v2` (sample std-dev, clean-lap filtering) for internal consistency?
- **`SessionPatterns` language.** Keep as-is (descriptive heuristics), or align its "consistency <2%" wording with the std-dev framing so the page doesn't speak two dialects?
- **Sector / gap-to-ideal.** `laps.sector_data` exists and analytics-v2 has `gapToIdealSeconds` — is a "gap to ideal" element in scope here or explicitly deferred (ties to demo seed data brief + issue #25 neighbourhood)?
- **`ScoreCard` component** — still used elsewhere after removing the two `/100` cards? Delete or keep.

## Constraints

- Language: **students / instructor**, not drivers / coach, in new copy.
- Real, honest metrics only — no `/100` composites, no fabricated claims (the thing the redesign removed).
- No new heavy deps (Recharts already in). Reuse existing components where possible.
- Data per session: lap times (ms), lap numbers, optional `sector_data`, track, date, source. No telemetry.
- Full `npm test` is the gate; keep it green through each step.

## Open decisions (settle before coding)

1. Does **issue #25 close-and-absorb** into this plan, or stay open as the "honesty" sub-thread? (Recommend: absorb, comment on #25 pointing here.)
2. Tab structure + what's global vs tabbed.
3. `/analysis` redirect vs removal (+ shareable-link handling).

## Process

Brainstorm → design doc (`docs/plans/YYYY-MM-DD-session-page-consolidation-design.md`) → implementation plan → subagent-driven execution off updated `main` (implementer → spec review → quality review → PR → Scott merges). Uses the **frontend-design** skill for the tab/layout work.

---

**Cross-reference:** Supersedes / absorbs the honest-metrics migration in **issue #25** — same files, one pass.
