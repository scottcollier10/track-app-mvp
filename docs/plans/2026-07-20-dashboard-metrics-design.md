# Dashboard Metrics Redesign — Design

> Status: **Design agreed** (brainstorm 2026-07-20, Scott + Claude). Execution deferred to a
> separate session. Supersedes the direction-finding in
> `docs/plans/2026-07-19-dashboard-metrics-brainstorm-brief.md`.

## Problem (validated)

The `/coach` dashboard and driver-detail pages present analytics that a chief instructor
cannot triage from. Root causes are structural, confirmed against code:

1. **Two duplicate composite columns.** `calculateConsistency` = `(1 − cv) × 100` and
   `calculateDrivingBehavior` = `100 − (cv × 100)` are algebraically identical
   (`web/src/lib/analytics.ts:20,42`). "Behavior" and "Consistency" are one metric shown twice.
2. **Score compression.** Lap-time coefficient of variation is naturally tiny, so both scores
   cluster 85–100. A "96" means "drove laps," not "excellent" — the number cannot discriminate.
3. **Colour encodes nothing.** `BehaviorBar` renders an emerald→cyan gradient at *any* value, so
   45% and 96% look equally healthy. The "Bottom to watch" card literally reads "behaviour/
   consistency need attention" beside a green bar for the flagged student.
4. **No honest change signal surfaced.** `calculatePaceTrend` (the one honest metric) isn't even
   shown on the dashboard.

## Goal

One screen that gives a chief instructor **triage value at a glance**: who got slower, who's off
their own baseline, who to debrief next — and, on the same progression axis, who's ready to move
up a run group. Replace compressed 0–100 composites with **change and judgment**.

## Research grounding (2026-07-20)

Two web-grounded research passes (cited) plus one UX pass shaped the model:

- **Individual metrics** (AiM RaceStudio, VBOX Circuit Tools, Garmin Catalyst, F1 race-pace
  analysis, SCCA consistency scoring, KH Coaching): the credible replacement for a compressed
  consistency score is **raw standard deviation in tenths of a second** — literally what SCCA and
  F1 tools use. **Consistency is orthogonal to pace** (show separately, never blend). **Ideal lap
  from best sectors + gap-to-ideal** is the highest-signal coaching metric when sector data
  exists — it isolates driver execution from car. Instructors speak in tenths, not invented %.
    - https://www.aimshop.com/blogs/software/how-to-read-and-improve-your-lap-times-with-aim-racestudio-3
    - http://kzannos.com/the-power-of-the-ideal-lap-function/
    - https://clubsportgarage.co.uk/blogs/news/just-how-good-is-the-garmin-catalyst
    - https://f1briefing.com/f1-race-pace-analyzer-for-performance/
    - https://www.khcoaching.com/p/consistency-where-it-comes-from
- **Triage / dashboard UX** (NN/g, Stephen Few, Shewhart control charts, Datawrapper): row-per-
  entity **severity-sorted** list (the sort *is* the worklist); colour **labels state, position/
  length carries magnitude**; **control-chart logic** — flag on *special-cause* (sustained/
  breakout) deviation, not one noisy session; sparklines + shaded personal-baseline band; a
  one-line human "why" per row; neutral default, no gauges, no composite, colourblind-safe.
    - https://www.nngroup.com/articles/dashboards-preattentive/
    - https://en.wikipedia.org/wiki/Bullet_graph
    - https://en.wikipedia.org/wiki/Control_chart
    - https://www.datawrapper.de/blog/colorblindness-part2

## Core model: one control chart, two faces

Every student sits somewhere on *their own* baseline distribution. Breaking **bad** →
triage queue. Trending **good** near their tier ceiling → readiness callout. Same math, two
directions. Nobody is scored against an absolute scale or against a different-tier driver.

## Coach dashboard (`/coach`) — information architecture

Three zones, top to bottom:

### 1. KPI strip (kept, honest)
Drivers · Sessions · Best lap (factual, who/where). Replace the vague "Improving X/N" with
**"Needs debrief: N"** and **"Progressing: N"**, tied to the queues below.

### 2. Triage queue — "Who to debrief next" (headline)
One severity-sorted list, one row per flagged student, from the three flags below. Replaces the
"Bottom 5 to watch" card and its contradictory green bars.

Row anatomy: name + run-group badge · one-line **why** (outcome-first, tenths) · signed delta ·
sparkline with shaded personal-baseline band. Multiple flags → multiple chips, **one row per
student**. Neutral by default; amber/red only on real breakout.

### 3. Progression roster — segmented by run group
Collapsible **Novice / Intermediate / Advanced** bands (from `experience_level`). Triage and
comparison happen *within* a band. Each row shows honest columns; the top of each band carries a
**readiness-to-advance** callout for students throwing sustained positive signals.

## Triage flags (computed on clean laps — drop out/in/pit laps first)

Thresholds below are **named constants, tuned on real pilot data** — not magic numbers.

1. **Faded in session.** Median of last third of clean laps vs first third. Fires when slower by
   > threshold (~0.5s / small %). Needs 6+ clean laps. *Always available* → backbone flag.
   (Refines `calculatePaceTrend`'s cruder first-3/last-3.)
2. **Regressed vs track PB.** Session best at track X vs the driver's prior best at track X. Fires
   when slower than established PB by > threshold. Needs a prior session at the same track;
   otherwise silent.
3. **Off consistency baseline.** This session's lap-time std-dev vs the driver's own historical
   spread (mean + SD of past per-session std-devs). Fires when it breaks the personal upper limit
   (~baseline + 2 SD). Needs ~3 prior sessions; under that → "building baseline," never fires.

**Severity ranking** = (flags fired) × (distance out of band), with **sustained** deviations
(fired last session too) weighted up. "Regressing 3 sessions running" outranks "one scattered
session."

**Why-strings** are templated from the firing rule, one line, outcome-first, in tenths:
_"Pace off 0.9s vs typical — 2 sessions running."_

## Progression roster — columns & readiness

**Honest columns:** Driver (name + last track) · Best lap · **Consistency as ±0.Xs std-dev**
(marker when outside personal baseline band) · trend sparkline (last N session bests) · Sessions ·
Last session. **The Behavior column is deleted** — not renamed. Gap-to-ideal is *not* a roster
column (needs sectors, belongs in driver detail); at most a small "sectors available" badge.

**Readiness-to-advance signal** (top of each band) — mirror of the triage flags, positive
direction: consistency tightening vs baseline, holding pace late (no fade) across sessions, pace
improving toward / setting PBs. When stacked over several clean sessions, the student surfaces with
humble copy and a link to driver detail:
_"Settling in — worth an Intermediate-readiness check. Tight consistency, holding pace late,
4 clean sessions."_ **Never** "Promote," never a score. It nudges an in-car human call.

## Driver detail page — develop & sign off

1. **Level control lives here, per viewed student.** Move the run-group setter off the broken
   `/profile` "first driver" page (`web/src/app/profile/page.tsx:15-20`) onto driver detail. Reuse
   `POST /api/profile/update` (already takes `driverId`) but **add an explicit ownership check** —
   don't rely on RLS alone. Framed as a deliberate sign-off ("Advance to Intermediate").
2. **Deeper session analysis:** per-session **fade slope**, **delta-to-PB** per track,
   **consistency vs personal baseline** (control-chart band), and **gap-to-ideal** *when*
   `sector_data` exists.
3. **Fix mixed-signal cards.** `ProgressStats.tsx` paints a red border on a 96→99 "decline" captioned
   "Similar consistency." Only colour when the change clears the baseline band; else neutral.
4. **Fix charts:** disambiguate same-day sessions on the x-axis (session label/time, not a repeated
   "Dec 4"); stop the consistency y-axis starting at 70 (fakes drama on flat lines) — plot std-dev
   in real seconds on an honest scale.

## Cold-start / sparse data (graceful degradation)

Thin-data students (or first visit to a track) can't be judged against a baseline. They get
**fade-only** triage (the always-available signal) and a neutral **"building baseline"** state for
the other two flags, which light up as history accrues. Never a false green, never a false alarm.
Rewards logging more sessions.

## Cross-cutting

- **Language:** visible copy uses **"students" / instructor-corps** framing, not "drivers." Route
  paths (`/coach`) unchanged.
- **Colour:** neutral/grey default; **amber/red only on threshold breakout**; **blue accent for
  progressing/ready** (not green — avoids the all-green trap). Every colour paired with icon + text;
  colourblind-safe (no red/green sole reliance).
- **No new dependencies** — Recharts (`LineChart`, `BarChart`, `ReferenceLine`) + CSS only.
- **Real data only** — no fabricated or hardcoded claims.

## Out of scope (YAGNI)

Peer/cohort baselines; absolute cross-track leaderboard; auto-promotion; staleness/"went quiet"
flag; telemetry features; any schema migration (`experience_level` stays 3 tiers, no "instructor"
tier); new heavy deps.

## Open questions for implementation

- Exact flag thresholds and the "N clean sessions" / "N recent bests" window sizes — set as
  constants, calibrate against seeded + real pilot data.
- Whether readiness requires a minimum session count per tier before it can fire.
- Definition of a "clean lap" filter (out/in/pit/traffic) given the current schema.

## Affected code (indicative, verify at implementation)

- `web/src/lib/analytics.ts` — delete the duplicate behaviour metric; add std-dev-in-seconds,
  fade-slope, baseline/control-chart helpers, delta-to-PB, ideal-lap/gap (sector-gated).
- `web/src/data/coachDashboard.ts` — recompute rollup to the new model (flags, severity, baselines,
  run-group grouping); drop behaviour averaging.
- `web/src/app/coach/page.tsx` — three-zone rewrite; remove `BehaviorBar` usage, Bottom-5 card,
  demo-highlight cards in current form.
- `web/src/components/ui/BehaviorBar.tsx` — remove or repurpose.
- Driver detail page + `ProgressStats.tsx` + chart components — level control, deeper analysis,
  colour/axis fixes.
- `web/src/app/api/profile/update/route.ts` — add ownership check.
- `web/src/app/profile/page.tsx` — retire the "first driver" level editor (level control moves to
  driver detail).

## Process

Design doc (this) → implementation plan (`superpowers:writing-plans`) → subagent-driven execution
(feature branch off `main` → implementer → spec review → quality review → PR → Scott merges).
Gate is full `npm test` (78/78+ at time of writing). Execution is a **separate session**.
