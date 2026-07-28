# Session Page Consolidation — Design

**Date:** 2026-07-27
**Status:** Validated in brainstorm (all open decisions settled with Scott)
**Supersedes:** `2026-07-20-session-page-consolidation-brainstorm-brief.md`
**Absorbs:** Issue #25 (honest metrics) — PR closes it (`Closes #25`), comment on #25 points here.

## Summary

Merge `/sessions/[id]` (Session Detail) and `/sessions/[id]/analysis` (Lap Analysis) into one page at `/sessions/[id]`, keeping all data, using the analysis page's chart and table, with a tab system for the two interpretive lenses. The honest-metrics migration (#25) lands in the same pass: no more `/100` composites, consistency expressed as ±0.Xs everywhere, one σ from one source.

## Decisions (settled 2026-07-27)

1. **Layout:** data global, lenses tabbed. Chart + lap table always visible; tabs hold only interpretive content.
2. **`/analysis` retirement:** route file becomes a one-line `redirect()` to `/sessions/[id]`. No `?tab=` param — tabs are local UI state. Old shared links (ShareSessionButton) keep working.
3. **Lap gate:** raw data (chart, table) renders for any session with laps. One gate — **≥6 laps** — for the interpretive layer (tabs + AI coaching), with a single shared empty state. Replaces today's ≥6/≥5 split.
4. **σ band math:** `LapAnalysisChart`'s ±1σ band aligns with analytics-v2 (sample std-dev, clean-lap filtering). Band width and the Consistency ±0.Xs card are the same number.
5. **SessionPatterns:** detection heuristics unchanged; user-facing copy reworded from % to the seconds dialect + students/instructor sweep.
6. **Gap-to-ideal / `sector_data`:** explicitly deferred (see Out of scope).
7. **Issue #25:** absorbed here, closed via the consolidation PR.
8. **`ScoreCard`:** deleted (sole importer is the session detail page + its own `__examples__`).

## Page structure

Route: `web/src/app/sessions/[id]/page.tsx`. Top to bottom:

1. **Header** — unchanged: track, student, date, location, `SourceBadge`, `ShareSessionButton`. The "View Detailed Analysis →" link is deleted.
2. **Summary stats** — 4× `MetricCard`: **Total Time · Best Lap · Average Lap · Laps**. Consistency leaves the stats row; it lives in the Insights tab as ±0.Xs.
3. **Lap Time Progression chart** — `LapAnalysisChart` (±1σ band), always visible for any session with laps. Replaces `LapTimeChart`.
4. **Lap Details table** — `LapAnalysisTable` (fastest + slowest highlighting), always visible. Replaces the simple Laps table.
5. **Tabs: "Session Insights" | "Session Patterns"** — gated ≥6 laps.
   - *Insights:* Consistency ±0.Xs (`formatConsistencySeconds`) + Pace Trend with `Sparkline`. Driving Behavior card deleted.
   - *Patterns:* `SessionPatterns` + Pattern Analysis explainer, copy in seconds dialect.
6. **AI Coaching** — `AICoachingCard`, same ≥6 gate (shares the empty state).
7. **Instructor Notes** — `CoachNotes` + add-note, unchanged, always visible.

Tab state: small `"use client"` tab component, local state only, no URL sync. UI work uses the **frontend-design** skill.

`/sessions/[id]/analysis/page.tsx` becomes:

```tsx
import { redirect } from 'next/navigation';

export default async function Page({ params }) {
  const { id } = await params;
  redirect(`/sessions/${id}`);
}
```

`LapAnalysisChart`, `LapAnalysisTable`, `SessionPatterns` survive as components; the page around them dies.

## Honest metrics + σ single-sourcing (#25 absorption)

- **`lib/insights.ts`** — drop `drivingBehaviorScore` + `INSIGHT_HELPERS.behavior`; keep pace trend; consistency switches to std-dev seconds via `sessionConsistencySeconds` (`@/lib/analytics-v2`). Update `lib/__tests__/insights.test.ts`.
- **One σ, one source.** `sessionConsistencySeconds` (sample std-dev, clean-lap filtering) is the only consistency number on the page:
  - Insights card renders it via `formatConsistencySeconds` (`components/drivers/consistencyBand.ts`).
  - `LapAnalysisChart` stops computing inline population σ; it takes σ + clean-lap mean as props, computed once by the page. Band = mean ± that σ.
  - `SessionPatterns` receives the value for display copy only; detection thresholds untouched.
- **AI prompt:** `api/coaching/generate/route.ts:158` — remove the `Driving Behavior: X/100` line. Manually verify coaching output still reads well against a demo student's session (product-sensitive).
- **`lib/queries/driver-progress.ts:185`** — `calculateConsistencyScore` → seconds (feeds `/api/drivers/[id]/progress-summary`); check consumers for `/100` display assumptions.
- **Dead code sweep (last step):** delete `calculateConsistencyScore`, `calculateDrivingBehavior`/`calculateBehaviorScore` from `lib/analytics.ts`; delete `ScoreCard` + `__examples__`. `git grep` clean before PR.

## Gating and edge cases

- One exported constant, e.g. `MIN_LAPS_FOR_INSIGHTS = 6`, shared by page and tests.
- `laps ≥ 1`: header, stats, chart, table, notes. `laps ≥ 6`: tabs + AI coaching.
- Below 6: one empty-state card where the tabs would be ("Log 6+ laps to unlock insights" — students/instructor copy). Replaces the split `EmptyInsights` / analysis-404 behavior.
- Chart band with <2 clean laps: σ undefined → band not drawn, progression line still renders.

## Testing

- Full `npm test` green at every step (141/141 baseline on main @ 260f814).
- Updated: `insights.test.ts`, `LapAnalysisChart` tests (new props), anything rendering the deleted cards.
- New: redirect route test; gate-boundary test (5 vs 6 laps).
- Visual QA against the live demo students (6 in prod under the instructor account).

## Out of scope (explicit)

- Gap-to-ideal / `sector_data` UI. Unblock recipe when wanted: one scenario edit in `web/scripts/seed/demo-scenarios.ts` + regenerate (see demo-seed memory).
- SessionPatterns heuristic/threshold changes.
- Any new `/100`-style composites.
- Tab URL sync / deep-linking.

## Process

Implementation plan via superpowers:writing-plans → subagent-driven execution in a **fresh worktree** off current main (implementer → spec review → quality review → PR → Scott merges). PR body includes `Closes #25`; comment on #25 pointing at this doc + the PR.

## Constraints (carried from brief)

- Students / instructor language in all new copy.
- Honest metrics only — no `/100` composites, no fabricated claims.
- No new heavy deps (Recharts already in). Reuse existing components.
- Full `npm test` is the gate at every step.
