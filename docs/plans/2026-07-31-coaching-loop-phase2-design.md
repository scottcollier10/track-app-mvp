# Coaching Loop (Phase 2) — Design

**Date:** 2026-07-31
**Status:** Validated with Scott (brainstorm 2026-07-31)
**Builds on:** `2026-07-28-track-day-model-design.md` (settled decisions there remain binding), Phase 1 (PR #30)

> Deltas compare, coaches conclude. The app records the loop; it never runs it.

## Scope

Phase 2 of the track day model: `focus_items` + `focus_item_assessments`, the debrief workflow, representativeness UI, the day page's focus panel and notes slot, the session page evidence banner. Preceded by the settled timezone no-op migration.

Constraint inherited from Phase 3 (binding on data shapes now): AI may summarize coach-directed work; it may never author new driving instructions, readiness assessments, or safety recommendations. Nothing in Phase 2's schema or copy implies app-authored judgment.

## Settled decisions

### 1. Timezone migration (first, a proven no-op)

- Populate `tracks.timezone`: Thunderhill, Sonoma, Laguna Seca, Buttonwillow, Streets of Willow → `America/Los_Angeles`; Barber → `America/Chicago` (matches zero rows in current seed; harmless).
- Ordering: the timezone UPDATE runs **first**; the assertion block runs **second** and reads the new values (run the other way, `coalesce(timezone,'UTC')` makes the check vacuous).
- The assertion is the simple form: *each session's recomputed local date = the date of its linked track_day*. Not a full re-bucketing simulation — the simpler the SQL restatement of `localDateForTimezone()`, the smaller the risk the assertion tests the SQL's opinion instead of the app's.
- **No assignment UPDATE exists in the migration at all.** Zero rows raise is the entire success condition. If it raises: stop, tell Scott.
- Why first: days carry no coach-authored data yet, so a re-bucket is lossless now and strands notes later.

### 2. Data model

All tables coach-scoped RLS, copying the `sessions_all` / `laps_all` patterns in `20260718_coach_scoped_rls.sql`.

**`focus_items`**
- `id`, `driver_id` FK, `text`, `status` (`active` / `achieved` / `paused` / `dropped`, default `active`), `created_after_session_id` nullable FK, `created_at`, `updated_at`. Index `(driver_id, status)`.
- `created_after_session_id` → **ON DELETE SET NULL**. Null already means "origin unknown"; degradation under session deletion is honest and automatic.
- **Text is editable, always.** Coach is sole author; edits are theirs to own. Yes, editing text after assessments exist changes what recorded judgments were judgments of — accepted deliberately over immutability (typo lives forever) or lock-after-first-assessment (a rule nobody remembers).
- Items are never deleted by workflow — and never invisible (see focus panel).

**`focus_item_assessments`**
- `id`, `focus_item_id` FK, `session_id` FK, `judgment` (`improved` / `keep_working` / `no_change` / `regressed`), `note` nullable, `created_at`, `updated_at`.
- **Unique `(focus_item_id, session_id)`** — one assessment per item per session review, enforced by the DB.
- **Upsert-cell correction semantics:** a mis-tap is corrected by rewriting that one cell (judgment + note), never by adding rows. "Append-only is the coaching story" applies *across* sessions, not within one cell. `updated_at > created_at` makes a corrected cell visible without a history table.
- `session_id` → **RESTRICT**. An assessment is a coach's permanent judgment; cascading a session delete into vaporized judgments is the wrong failure. **Consequence: purge/cleanup scripts must delete assessments before sessions.** The demo purge scripts will hit this when Phase 3 seeds assessment history.
- RLS: **SELECT + INSERT + UPDATE only** (coach chain via focus_items → drivers). No DELETE policy — the database enforces no-delete, not app discipline.

**`track_days.notes`**
- Nullable text column. Mutable scratchpad ("green all day, new tires after S2"), not an append log — day state, not authored entries. `coaching_notes` stays session-scoped; extending it was rejected as an invasive prod migration for a scratchpad use case.
- **Import-route invariant, now guarding real data:** the `track_days` upsert payload must stay keys-only (PostgREST compiles extra payload columns into `ON CONFLICT DO UPDATE SET`, silently nulling them on re-import). A regression test — seed a day with notes, re-run the import upsert for the same (driver, track, date), assert notes survive — ships **in the same task as the column**.
- Phase 3 forward note: since notes are mutable, Day Summary generation must snapshot the notes text into the draft's provenance at generation time; otherwise "informing inputs" can silently diverge from what informed the draft.

### 3. Debrief is session-anchored

The between-runs ritual happens in a **debrief sheet** opened from any session card (not just the latest — retroactive assessment is legitimate and session-anchored by construction). Four zones, matching the Phase 1 doc's workflow steps:

1. **Context flag** — representative / partial / not_representative chips + note field when non-representative. One session-column write path, two entry points (sheet + import confirmation), same component.
2. **Delta block** — vs the previous *representative* session in the day, **baseline named explicitly** ("vs Session 2"). Best lap Δ, σ Δ, lap counts; sector deltas only when both sessions' laps carry `sector_data`. Signed numbers, no verdicts. Defined empty state ("No comparison baseline yet" + reason) — never zeros. **If the baseline is flagged partial, its chip propagates into the naming**: "vs Session 2 · partial — heavy traffic." A flagged baseline is part of naming it honestly.
3. **Assess the loop** — per eligible item: judgment buttons + optional note. Per-tap upsert-cell writes (no batch submit — paddock connectivity dies mid-form). Already-assessed items show their judgment, tappable to correct.
4. **Set next** — add focus item; `created_after_session_id` = this session, explicit and free.

- Writes are per-control and optimistic, **with pending/failed/retry rendering on every control** — the same dead LTE that justifies per-control writes kills individual writes too, and a judgment that renders saved but wasn't is worse than a lost form.
- **Context-flag writes revalidate the day page's derived surfaces** (delta baselines, day-best, trend, annotation) in the same task that ships the writes. Flipping S2 non-representative changes S3's baseline and every aggregate behind the sheet; shipping the cause without the cure is the two-views bug, transient edition.

The alternative (assess from an ambient panel, auto-attached to "latest session") was rejected: implicit session linkage is the same dishonesty as inferring item origin.

### 4. Focus panel is read/manage only

Day page zone 2. **No assessment entry here.** Status transitions (pause / drop / achieve / reactivate) are item-level API writes with no session anchor and **no assessment row** — assessments only happen through a session's debrief. Three groups:

- **Active** — text, origin label ("from Sonoma, Jul 12" via origin session's day; "added outside a session" when origin null), compact per-session judgment timeline, manage controls.
- **Resolved this day** — achieved/dropped items with an assessment on one of this day's sessions.
- **Paused / inactive** (collapsed) — driver-scoped, **not day-filtered**. Reactivation must be reachable for an item paused last month; "never deleted by workflow" also has to mean never invisible.

"Add focus item" lives here too for non-session cases (pre-day planning, a thought at dinner) — `created_after_session_id` honestly **null**, never silently pinned to "latest." Record what you know; don't infer what you don't.

**Intended gap, do not "fix":** "Resolved this day" is really *resolved-and-assessed-on-this-day*. An item dropped via the panel with no same-day assessment appears in no day's history — it goes straight to Paused/inactive. Without a transition log (rejected: a new table + write path + backfill guesses, to power one banner) this is the honest, fact-based behavior.

### 5. Evidence banner: facts plus present tense, never reconstruction

Session page, under the day header. Two **visibly separate** groups — the honesty lives in the labels:

- **"Reviewed in this session"** — items with an assessment at this session (hard fact), judgment shown; since-resolved items included with current status.
- **"Focus items"** (plainly present-tense) — currently-active items in play coming into this session.

"In play" ordering rule: prefer `created_after_session_id` over wall-clock — an item originated after session N appears for session N+1 onward by session order (defined via `bySessionStart`), never in N's own banner. Wall-clock `created_at` date comparison only for null-origin items; same-day ties **include** the item (showing a coach their own same-day item is the safe direction to be wrong in). Rationale: the CSV parser noon-anchors date-only imports, so same-day wall-clock comparisons are a coin flip exactly where the banner matters most.

**Intended gap, do not "fix":** the banner is a present-tense convenience plus assessment facts, not a reconstruction of historical status. Items genuinely active at a past session but since paused/dropped without an assessment there are omitted.

**One definition, two callers:** a shared eligibility function returns the **full tagged union** — `reviewed` (correctable in the sheet) and `inPlay` (assessable in the sheet). If it returned only `inPlay`, correction on since-resolved items would silently break.

### 6. Representativeness: partial counts, only `not_representative` excludes

- Exclusion is the strong action and requires the coach's explicit strong claim; the soft options annotate. Partial data is real data — excluding it would be the app concluding. A partial session's σ can be traffic-contaminated; the binary rule accepts that and the chip is the disclosure. Per-metric matrices (counts for best-lap, not for σ) are two-views-by-metric — rejected.
- Non-representative sessions: excluded from day aggregates, trends, and baseline eligibility; rendered **muted with a context chip** — visible, never hidden. Partial: chip, no muting, counts fully.
- Aggregates over a strict subset carry the annotation: "(3 of 4 sessions)".
- **Amend, don't fork:** the rule lands as amendments to the existing `track-days.ts` functions (`dayBestLapMs`, `dayConsistencyTrend`, `sessionDelta` baseline selection) plus two helpers (`representativeSessions()`, `dayAggregateAnnotation()`). Any `*Representative` variant function is a defect. Review-checklist line: grep for direct best-lap/σ computations over day session sets outside `track-days.ts`.
- Scope line: representativeness filtering only. The stored `best_lap_ms` trust question (#15/#19) stays a separate bundled deferral — do not resolve it mid-task.
- Nullable = representative, so all pre-P2 sessions count fully: a test asserts existing day aggregates are unchanged, the same way Migration 1 asserts its no-op.

### 7. Shared consistency gate (cashing in a deferral)

The delta block would be the third independently-written copy of the `MIN_LAPS_FOR_INSIGHTS` gate (session page and coaching route already disagree — the deferred `canClaimConsistency()` item). Extract the helper now: sheet as first clean consumer, both existing sites migrated onto it, in this phase's plan explicitly.

## Surfaces

- **Day page:** zone 1 progression strip gains Debrief actions, muting, context chips; zone 2 focus panel; zone 3 day notes (editable textarea; Phase 3 renders the summary approve flow above it).
- **Session page:** evidence banner under the day header.
- **Import confirmation:** three-chip flag component per imported session (same component as the sheet) — capture at import time keeps later comparisons honest.
- **Driver page:** day rows gain a focus-activity badge — count of assessments on that day's sessions. A fact, nothing derived.

## API routes

All `getCurrentCoach()`-gated, following the existing `add-note` pattern:

- `POST /api/focus-items` — create (text, driver_id, optional created_after_session_id)
- `PATCH /api/focus-items/[id]` — status transitions and text edits
- `PUT /api/focus-items/[id]/assessments` — the upsert-cell write (session_id, judgment, note)
- `PATCH /api/sessions/[id]/context` — representativeness + note
- `PATCH /api/days/[id]/notes` — day notes

## Testing spine (named regressions from the brainstorm)

1. Migration 1 assertion — SQL shown to Scott, applied by him, verification recorded.
2. Notes survive re-import (same task as the column).
3. Pre-P2 day aggregates unchanged under null-representativeness.
4. Eligibility union: tagged groups, ordering rule, same-day null-origin ties.
5. `canClaimConsistency()`: extraction + both migrated call sites agree.
6. DB-level: assessment cell uniqueness; RLS denies DELETE on assessments.

## Task sequence

Each task mergeable-green with per-task reviews; final whole-branch review at the end (it earned its keep in Phase 1). Single PR; Scott merges.

1. Timezone no-op migration
2. Loop tables migration + RLS + types + `track_days.notes` (+ notes-survive-reimport test)
3. Shared lib: `canClaimConsistency()`, eligibility union, representativeness amendments
4. API routes
5. Debrief sheet + import-confirmation flag chip (+ revalidation wiring — the cure ships with the cause)
6. Focus panel + evidence banner
7. Day notes UI
8. Final whole-branch review

**Prod migration handshake (both migrations, planned steps, not end-of-branch surprises):** SQL shown to Scott at its task; he applies via SQL editor; verification queries run with recorded outputs. Both are additive and safe to run ahead of merged code (Phase 1 precedent: prod schema ran ahead of PR #30 for a day). Dev `.env.local` points at hosted prod — verify with demo drivers, record IDs, delete after.

## Out of scope

- Day summaries / AI anything (Phase 3)
- Video/media on focus items (Phase 4)
- Focus-item transition log (rejected — see intended gaps)
- Stored `best_lap_ms` trust question (deferred, bundled elsewhere)
- Driver-authored anything (coach remains the author)
