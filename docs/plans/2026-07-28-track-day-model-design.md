# Track Day Model & Coaching Loop — Design

**Date:** 2026-07-28
**Status:** Validated with Scott (brainstorm 2026-07-28)
**Supersedes:** the flat session list; builds on PR #27 (honest metrics, consolidated session page)

> Drivers develop across days. Days progress through sessions. Sessions contain the evidence.

## Problem

A driver runs multiple sessions (typically 4 × 20-25 min) in a single HPDE track day. The coaching loop happens *between* sessions: immediate debrief, pick 1-2 things to fix, then check the next session to see if it worked. TrackApp currently treats every session as an island — no day grouping, no session-over-session comparison, no record of the instruction → result loop. The app remembers sessions; it doesn't remember coaching.

## Core decisions (settled, do not reopen)

1. **Explicit `track_days` entity, implicitly created.** Auto-upserted on CSV import from (driver, track, local date). Coaches never fill out a "create day" form; they intervene only on ambiguity (move session to another day).
2. **Focus items are driver-scoped, session-originated, assessment-logged.** They survive day boundaries and carry across events until achieved, paused, or dropped. Assessments are append-only; the history is the coaching story.
3. **Honest evidence, never claimed causation.** The app shows the instruction next to the deltas; the coach records the judgment. Deltas compare, coaches conclude. Consistent with the #27 honest-metrics stance (seconds, ±σ, no /100 composites).
4. **Day is the navigation hub.** Driver → track days → day page (debrief workspace) → session page (lap-level evidence, one click deeper). Flat all-sessions view deferred until a real need appears.
5. **AI is day-aware and constrained.** Session-triggered coaching gains day context. An optional end-of-day summary is drafted by AI and approved by the coach. **Hard rule: AI may summarize coach-directed work; it may never author a new driving instruction, readiness decision, or safety recommendation.**

## Data model

All new tables follow the existing coach-scoped RLS pattern.

### `track_days`
- `id`, `driver_id`, `track_id`, `date` (local calendar date), timestamps
- Unique on (driver_id, track_id, date)
- Local date resolved via track timezone: add `timezone` to `tracks` (default from location; fallback: coach's TZ)
- Two-day weekends = two rows. No "event" super-entity (YAGNI).
- Backfill migration groups all existing sessions by the same key.

### `sessions` (modified)
- Add `track_day_id` FK (backfilled, then required on new imports)
- Add context flag: `representativeness` (`representative` / `partial` / `not_representative`, nullable = representative) + `representativeness_note` (short free text: "heavy traffic", "fatigue")
- Session order within a day = timestamp order, displayed as Session 1, 2, 3…

### `focus_items`
- `id`, `driver_id`, `text` (free-form instruction), `status` (`active` / `achieved` / `paused` / `dropped`), `created_after_session_id`, timestamps
- Status reflects the latest assessment; items are never deleted by workflow.

### `focus_item_assessments`
- `id`, `focus_item_id`, `session_id`, `judgment` (`improved` / `keep_working` / `no_change` / `regressed`), optional `note`, timestamp
- Append-only. One assessment per item per session review.

### `day_summaries` (Phase 3)
- `track_day_id`, `draft_text` (AI output), `final_text` (coach-approved), `approved_by`, `approved_at`, `informing_session_ids`, `informing_assessment_ids`
- Underlying coach notes are never modified. Regeneration creates a new draft; replacing an approved summary preserves the prior version.

### `focus_item_media` (Phase 4)
- Storage ref (Supabase Storage), `focus_item_id` or `assessment_id`, clip timestamp offset, size-capped
- Same shape the future full video-review workstation will consume.

## Navigation & pages

**Driver page:** day list replaces session list. Row = date, track, session count, day-best lap, day σ trend ("±1.2s → ±0.7s"), focus-activity badge. Driver-level "Consistency by Event" charts group by track day.

**Track Day page (`/days/[id]`)** — the debrief workspace, three zones:
1. **Session progression strip** — card per session: best lap, ±σ, lap count, context chip. Deltas between adjacent sessions. Non-representative sessions render muted.
2. **Focus items panel** — active items incl. carry-ins labeled with origin ("from Barber, Jul 12"), assessment history inline, assess/add controls. Achieved/dropped collapse into day history.
3. **Day notes / summary slot** — free-form notes now; Phase 3 renders the Day Summary draft → approve flow here.

**Session page:** as shipped in #27, plus a day header ("Barber · Jul 12 · Session 2 of 4", prev/next nav) and an **evidence banner** listing the focus items active coming into the session.

**Import flow:** unchanged capture; confirmation lands on the day page.

## Debrief workflow (between sessions)

1. **Flag context** (optional, two taps): representative / partial / not + reason. Captured at import time keeps later comparisons honest.
2. **Review deltas** vs the previous *representative* session: best lap Δ, ±σ Δ, laps. Sector deltas only when both sessions have `sector_data`. Sessions under `MIN_LAPS_FOR_INSIGHTS` (6) show times but no consistency claims — the #27 gate applied per session.
3. **Assess the loop**: per active focus item — improved / keep working / no change / regressed + optional note. App presents instruction beside deltas; never scores it.
4. **Set the next instruction**: new free-text focus item, or let current ones run.

**Honesty rules:** non-representative sessions are excluded from trends and day-best by default — visible, muted, never silently dropped. Day aggregates derive from representative sessions with an explicit "(3 of 4 sessions)" annotation.

## AI

**Day-aware session coaching (same trigger/endpoint):** prompt gains prior sessions in the day (metrics + context flags), active focus items with assessment history, carry-ins from prior days. Output frames the session within the arc; context flags prevent scolding a traffic-compromised run.

**Day Summary (coach-triggered, end of day).** Five sections:
1. *Day overview* — how the day progressed (metrics-grounded)
2. *Coaching progression* — narrative from focus items + assessments
3. *Important context* — anything limiting interpretation (flags, coach notes)
4. *Strengths demonstrated* — only what data or coach observations support
5. *Carry-forward items* — drawn **exclusively** from active focus items and explicit coach notes; never invented

**Constraint rule (system prompt + review checklist):** AI may restate/summarize coach-directed work — active items, unresolved items, documented patterns, the coach's own assessments, and may draft a starting point based on them. AI may **not** author new driving instructions ("brake later"), readiness/group-promotion decisions, setup changes, or safety recommendations.

**Approval flow:** generate draft → coach edits or approves → saved as permanent record with full provenance (draft, final, approver, timestamp, informing sessions/assessments). Nothing publishes silently.

## Phasing

- **Phase 1 — Day model:** migration + backfill, auto-upsert on import, driver day list, day page progression strip, session page header/nav. App coherent after this PR.
- **Phase 2 — The loop:** focus_items + assessments, focus panel, debrief workflow, context flags UI, session evidence banner. The differentiator PR.
- **Phase 3 — AI:** day-aware coaching prompt, Day Summary with constraint rule + approval/provenance. **Demo seed regen** here: demo students need multi-session days, focus histories, context flags, one approved summary.
- **Phase 4 — Video, narrow:** clips attached to focus items/assessments (size-capped Supabase Storage upload, inline playback in debrief panel). Full video/telemetry/track-map review workstation (see trackapp-landing prototype `/session`) deferred but data-model compatible. Known risks: paddock LTE upload UX (clips, not full sessions), storage/egress cost ceiling.

Each phase is a separately mergeable PR with its own implementation plan.

## Out of scope (for now)

- Flat all-sessions administrative view
- Multi-driver "today at the track" coach view (query-able later from day rows sharing date+track)
- Sat/Sun event super-entity
- Full video review workstation
- Driver-authored notes/assessments (coach remains the author; drivers view)
