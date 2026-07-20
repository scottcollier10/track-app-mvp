# Dashboard Metrics Redesign — Brainstorm Brief

> **For Claude:** This is the starting brief for a brainstorming session. Use the superpowers:brainstorming skill — one question at a time, explore 2-3 approaches, present the design in sections, then write a design doc and plan. Scott has already validated the problem; start from "which direction," not "is this a problem."

**Goal:** Redesign how the coach dashboard (/coach) and driver detail pages present analytics so a chief instructor gets *triage value at a glance* — who got slower, who's inconsistent vs their own baseline, who to debrief next.

## The problem (validated 2026-07-19, Scott + code audit)

A driver flagged "Bottom 2 to Watch" (Taylor Morgan) displays a green 96% behavior bar. Coaches read contradiction. The audit found this is structural, not cosmetic:

1. **Behavior ≡ Consistency.** `consistencyScore = (1−cv)×100` and `behaviorScore = 100−(cv×100)` are algebraically identical (`web/src/lib/analytics.ts:6-45`). Two columns, one metric.
2. **Score compression.** Lap-time coefficient of variation is naturally tiny, so scores cluster 85–100. A 96 means "drove laps," not "excellent." The number cannot discriminate drivers.
3. **Fixed bar color.** `BehaviorBar.tsx` renders emerald→cyan gradient at ANY value. 45% and 96% look equally healthy.
4. ~~Per-session scores in driver detail table were random mock data~~ (fixed 2026-07-19, PR #23 — real computed values now).
5. ~~"Demo Highlights" card descriptions were hardcoded strings ("−17.8% decline")~~ (fixed 2026-07-19, PR #23 — computed or removed).

## Current mechanics (post-fixes, verify against code at session start)

- Dashboard rollup (`web/src/data/coachDashboard.ts`): consistency = latest session; behavior = average of all sessions; `isImproving` = first-2 vs last-2 session avg-best delta ≥1%, needs ≥3 sessions.
- Top/Bottom panels (`web/src/app/coach/page.tsx:171-191`): Top = isImproving sorted by improvementPct; Bottom = ≥3 sessions AND (not improving OR consistency <75).
- Pace trend (`analytics.ts:50-67`): first-3 vs last-3 lap avg, ±1% threshold, needs 6+ laps. This is the one metric with honest semantics.
- Driver detail cards (`ProgressStats.tsx`): border color from consistency delta sign — a 96→99 "decline" gets a red border with the caption "Similar consistency" (mixed signals).
- Charts: x-axis repeats "Dec 4" for same-day sessions; consistency y-axis starts at 70 making flat lines look dramatic.

## The design question

What belongs on a chief-instructor dashboard? Candidate directions to explore (not conclusions):

- **Deltas over levels.** Coaches care about change: "+0.9s vs last event," "consistency down 12% vs personal baseline." Absolute composite scores hide this.
- **Flags/triage over scores.** "Needs debrief: pace faded 3 sessions running" beats a percentage. The Bottom-2 panel already gestures at this — lean in, drop the bars there entirely.
- **Within-driver baselines.** Normalize against the driver's own history, not an absolute 0-100 scale that compresses. Percentile-vs-self or z-score banding ("typical range" vs "outside range").
- **Kill or rename Behavior.** It's a duplicate. Either compute something real (outlier laps? spread of worst laps? sector variance if data exists) or delete the column.
- **Value-driven color everywhere, or no color.** If a bar stays, its color must encode judgment (and the judgment must be defensible).

## Constraints

- Pilot posture: minimal effort, traction-first (see memory + docs/plans/2026-07-17-trackapp-revival-design.md). This dashboard is the demo centerpiece for the champion pitch.
- Language: "instructor corps / students," not "coach / drivers," in any new copy.
- Data available per session: lap times (ms), lap numbers, sometimes sector_data JSON, track, date, source. No telemetry (speed/GPS traces).
- No new heavy dependencies; Recharts is already in.
- Real data only — no fabricated or hardcoded claims (the thing we just fixed).
- Sessions are often same-day (HPDE event weekends) — time axes must handle this.

## Process

Brainstorm → design doc (`docs/plans/YYYY-MM-DD-dashboard-metrics-design.md`) → implementation plan → subagent-driven execution (feature branch off main → implementer → spec review → quality review → PR → Scott merges). Gate suite is full `npm test`, 78/78+ at time of writing.
