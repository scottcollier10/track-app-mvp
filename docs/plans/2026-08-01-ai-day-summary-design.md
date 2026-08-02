# AI Day Summary (Phase 3) — Design

**Date:** 2026-08-01
**Status:** Validated with Scott (brainstorm 2026-08-01)
**Builds on:** `2026-07-28-track-day-model-design.md` and `2026-07-31-coaching-loop-phase2-design.md` (settled decisions there remain binding), Phase 1 (PR #30), Phase 2 (PR #31)

> Every enforcement lives in the migration, every definition lives once in the lib layer, and both AI surfaces inherit the constraint rule by construction rather than by care.

## Scope

Phase 3 of the track day model: the coach-approved AI Day Summary (append-only generations, full provenance), the day-aware rewrite of session coaching under an observation-only output contract, and demo seed regen to the real HPDE shape (~4 sessions/day, focus histories, context flags, one approved summary).

Hard rule (settled decision #5, restated): AI may summarize coach-directed work; it may **never** author new driving instructions, readiness decisions, or safety recommendations. This design enforces it partly **by construction** — see decision 5.

## Settled decisions

### 1. `day_summaries` is append-only generations

One row per *generation*, not per day. Same shape as assessments: append-only is the story, the DB enforces no-delete.

- `id`, `track_day_id` FK (**CASCADE** on day delete — summaries are about the day), `status` (`draft` / `approved` / `superseded`, default `draft`)
- Immutable after insert: `draft_text` (raw AI output), `prompt_context` jsonb, `model`, `informing_session_ids` uuid[], `informing_assessment_ids` uuid[]
- Coach-authored: `final_text` — **seeded with `draft_text` at insert** (column comment explains: "current text" is always `final_text` with no COALESCE; the draft/final diff starts at zero and grows only by coach action)
- Approval: `approved_by` FK coaches, `approved_at`; `created_at`, `updated_at` (existing `set_updated_at` trigger owns it; routes never write it)
- No version counter, no prev-generation FK chain — `created_at` ordering within a day is the history; the status lifecycle is the state machine.
- Rejected alternative: single-row-with-shadow-table is this design with two schemas and a copy-on-regen step that can fail halfway.

**Current summary** = the `approved` row if one exists, else the live `draft`. A dangling draft beside a current approved summary is a valid, expected state ("coach considering a rewrite"). An old approved row is superseded only when a newer row is **approved**, never at generation time — regenerating and abandoning a draft must not leave the day without a current summary.

### 2. Enforcement lives in the DB, not route discipline

- **Partial unique index** `(track_day_id) WHERE status = 'draft'` — at most one live draft per day.
- **Partial unique index** `(track_day_id) WHERE status = 'approved'` — an app slip that approves without superseding becomes a constraint violation, not two "current" summaries.
- **BEFORE UPDATE trigger** enforcing the status write matrix:
  - Immutable columns (`draft_text`, `prompt_context`, `model`, `informing_*`, `track_day_id`) rejected always.
  - `draft` → `final_text` writable; `approved` → `final_text` writable (post-approval edits; `updated_at > approved_at` is the marker); `superseded` → row fully frozen.
  - Legal transitions only: `draft→approved`, `draft→superseded`, `approved→superseded`.
  - On `draft→approved`: `approved_by` and `approved_at` required in the same write, and rejected in any other transition — an "approved" row with null approver is unrepresentable.
  - On `draft→approved`: **auto-supersede** any existing approved row for the same day (makes the approved index unviolatable by construction; supersede-then-approve is atomic and ordered).
- **BEFORE INSERT trigger**: supersede any live draft for the same `track_day_id`. Regeneration is single-statement and race-free (supabase-js has no multi-statement transactions; an RPC would be more machinery than a trigger).
- RLS: coach-scoped (chain via `track_days` → `drivers`), SELECT + INSERT + UPDATE, **no DELETE policy** — same enforcement as `focus_item_assessments`.

### 3. `final_text` is coach-authored and never system-locked

Focus-items precedent applied: coach-authored text is never locked. The immutability boundary is: everything the *AI* produced plus everything that *informed* it is frozen; everything the *coach* authored stays theirs.

- Writable in `draft` (autosave the working edit — same debounce + serialized-save pattern as DayNotes; a closed tab loses nothing; approval never carries a payload race).
- Writable in `approved` (post-approval edits are the coach's to own). **UI obligation: an "edited after approval" chip** when `updated_at > approved_at` — the marker is only honest if shown; otherwise a reader assumes the approved text is what was approved at `approved_at`.
- Frozen at `superseded` — history that can drift stops being history.
- Draft-vs-final daylight is information, not corruption: the draft records what the AI proposed, the final records what the coach published. A big gap is the table's best audit signal. No diff view in Phase 3 — the chip is the disclosure; the DB holds the receipts.

### 4. One builder; provenance is the same object that informed the draft

`buildDaySummaryContext(dayId)` in the lib layer, split into a **fetch layer** (DB queries) and a **pure assembly core** (takes data, returns the context object). The route feeds the returned object to the prompt *and* snapshots it verbatim into `prompt_context` — what informed the draft and what is recorded as informing it cannot diverge, because they are the same object. `informing_session_ids` / `informing_assessment_ids` are **derived from the context object**, never from a parallel query (a session imported mid-generation must not desynchronize IDs from snapshot). All metrics come from `track-days.ts` / `insights.ts`; the builder computes nothing itself.

**Contents (contractual):**
1. Day identity — track name, date, driver name, session count.
2. Sessions of the day — order, best lap, lap counts, σ only where `canClaimConsistency` passes (absent otherwise, with the reason), deltas per the representative-baseline rule, representativeness flags + notes. Non-representative sessions included, labeled.
3. Focus items in play — active + resolved-this-day via the **same shared grouping functions the focus panel uses**. The resolved-this-day proxy (assessed-on-this-day) and its intended gap are inherited honestly, not redefined: an item panel-dropped with no same-day assessment appears in no day's summary, exactly as it appears in no day's history. Per item: text and status snapshotted (items are mutable; IDs alone can't reproduce what the AI saw), origin label, **full cross-day assessment history** — no cap, no window (bounded by construction; a 15-assessment item is narrative, not a size problem).
4. Coach session notes (`coaching_notes`) for the day's sessions.
5. Day notes text — the snapshot pinned in `20260731_coaching_loop.sql`'s column comment.

### 5. The constraint rule is partly enforced by construction

**Excluded from the input set: all AI-authored text.** Per-session `ai_coaching_summary` never enters either prompt. A prompt boundary only holds if instruction-shaped text never crosses it — "summarize your inputs" plus inputs containing "brake later into T5" produces AI-authored instructions wearing a summary costume, and no system-prompt language reliably filters that. With no AI text in the inputs, the model cannot emit a driving instruction that did not originate from a coach record: the hard rule becomes an input-set property, not a behavioral hope. (The compounding argument — AI summarizing AI stacks errors — stands independently; keep the exclusion even if the laundering risk ever goes away.)

**System prompt requirements** (the testable half of the model contract):
- The five settled sections (day overview / coaching progression / important context / strengths demonstrated / carry-forward).
- Carry-forward drawn **exclusively** from active focus items and coach notes.
- The observation/prescription test: observations are claims about what happened, verifiable against session data ("laps 8–11 degraded to ±2.1s after the red flag"); prescriptions are claims about what the driver should do ("carry more speed through 5"). Past/present-tense data claims yes; imperative or future-directed driving advice no. **Canonical smuggled prescription, named in prompt and review checklist:** "the data suggests earlier braking would help" is a prescription in observation clothing.
- **Empty sources are reported as empty, never padded.** "No coaching records exist for this day" is required output, not model initiative — a near-empty day is exactly where a model's helpfulness instinct invents coaching narrative. The empty-day case sits on the review checklist beside the smuggled prescription; they are the two canonical failure modes.

"Draft a starting point" (Phase 1 doc) is reconciled as: the AI may summarize progress on a coach-authored item — the starting point it drafts is a narrative, never a new instruction.

**Legacy session summaries:** pre-Phase-3 `ai_coaching_summary` texts contain instruction sections. **Decision: leave them, do not regenerate.** They are coach-facing today, and regenerating history would falsify what the coach actually saw at the time. They predate the contract; the first driver-visibility PR must handle them, and this line is here so it trips over a decision, not a leftover.

### 6. No generation gate; degrade inside the artifact

The coach can generate a summary for any day (the one-session floor comes free with the data model — day rows can't exist otherwise). A gate would be the app deciding what's worth summarizing — annotate, don't veto. σ claims stay behind `canClaimConsistency` per session *inside* the prompt: a day of short sessions gets a summary with lap times and no consistency claims — the gate does its job inside the artifact, not in front of it (same move as the Phase 1 day-aggregate annotations: degrade in view, never withhold).

No superseded-history UI in Phase 3: the structural guarantee was the expensive part and it's bought; the viewer is one SELECT away when someone actually asks.

### 7. Session coaching: day-aware, observation-only, ephemeral

Settled decision #5 has no surface qualifier — "AI may never author a new driving instruction" binds the session route too. The current prompt ("suggest 2–3 specific, actionable improvements") authors instructions; the rewrite removes that capability rather than relocating it.

- **Same trigger, endpoint, and storage:** `POST /api/coaching/generate`, overwrite `sessions.ai_coaching_summary` on regenerate, no approval flow, no provenance row. **Load-bearing pairing: session coaching may stay ephemeral because its output contract now forbids instructions; a future PR relaxing the contract inherits the storage question.** Under this design the system contains no AI-authored instruction text anywhere — not in prompts, not in outputs, not in the DB.
- **Context:** the route calls the same `buildDaySummaryContext(dayId)` and marks the triggering session as focal — one builder, two prompts; the no-AI-text input property holds for both features by construction. Focal-session lap detail (countable laps only) rides alongside; the inline countable-lap predicate in the current route is replaced by `validLapTimesMs` (absorbing the noted P2 follow-up).
- **Item set:** filtered through the **same shared eligibility function the evidence banner uses**, focal session as anchor — an item never evidences against its own origin session (the item was the coach's response to that data, not something the session tested). Same function, not a reimplementation.
- **Retrospective framing (decided here, not in the prompt PR):** later sessions stay in the context (one builder shape; honest data is honest), but the prompt frames the focal session against **prior** sessions, with later ones as "subsequently" context at most — never grading a past session with hindsight it didn't have.
- **Output contract** (replaces Strengths / Areas for Improvement / Next Session Goals):
  1. *Session in the day's arc* — deltas vs the named representative baseline, flags respected (a traffic-compromised run is framed, not scolded).
  2. *Evidence on focus items* — per in-play item, what this session's data shows against the item's assessment history; empty reports empty.
  3. *Patterns worth the coach's attention* — verifiable data claims only; the observation test binds identically.
- Gate unchanged: `canClaimConsistency` over countable laps.

### 8. Seed regen: real HPDE shape, differentiated cast, honest provenance

Last task of the phase — it writes `day_summaries` rows and must consume the real schema and the real assembly core, not invent them.

- **All six students reshaped** to ~4-session track days, flag identities preserved; the generator's `evaluateStudent` verify step runs **per driver over the full reshaped session set** (flag identity is a driver-level property now spread across days) and `demo-scenarios.test.ts` is co-arbiter, updated together.
- **Differentiated richness — real rosters are lumpy:** Elena Ross demos the whole loop end-to-end (improved→achieved arc, cross-day carry-in, day notes, **the one approved summary**); Marcus Webb carries a keep_working/regressed trail; one two-day weekend (two day rows); one null-origin item; one paused item (collapsed group renders); context flags where plausible. Jordan Lee stays sparse — one day, two sessions; his page is the free n=1 rendering regression. Sam Whitaker stays boring — a Sam with a focus trail is a broken control.
- **Generator grows day-awareness:** emits `track_days` (deterministic `dd`-namespace UUIDs) and `track_day_id` on sessions; local dates computed in TS via the app's own `localDateForTimezone` (one definition; SQL stays dumb values). Stale cleanup extends to days: demo-driver day rows not in the emitted set are deleted after repointing — this also sweeps the orphaned P1-backfill day rows that the current recipe strands (the quietly-broken refresh, fixed at the root).
- **The seeded summary is contract-complete:** `prompt_context` built by the **pure assembly core** over scenario data (real-shaped by construction, not hand-imitated), informing IDs that resolve, plausible `draft_text`, `final_text` differing by one coach-tightened sentence (the draft/final daylight demoed as information), `approved_by` = the generator's existing coach input resolved by email subquery (never a hardcoded UUID), `approved_at` set, status `approved`, **`model = 'seed'`** — the row claims no generation that never ran; this table's provenance columns don't lie.
- **Purge path is P0 in this task:** delete order fixed in both purge scripts — assessments → focus_items → day_summaries → coaching_notes → laps → sessions → track_days → drivers (covers both NO ACTION edges). **`web/supabase/scripts/cleanup-demo-data.sql` is deleted** — it mutates all drivers (no namespace filter); a good and a poisoned purge script must not sit side by side.
- Refresh recipe stays generate+seed, idempotent, no purge needed.

## Surfaces

**Day page zone 3** (the reserved slot above Day notes), five states — the fifth is a combination:

1. **No summary** — "Generate day summary" button.
2. **Live draft** — editable text autosaving into `final_text`, Approve, Regenerate, visible unapproved-AI-draft label.
3. **Approved (current)** — rendered `final_text`, approver + date, still editable, "edited after approval" chip when `updated_at > approved_at`, Regenerate available.
4. **Generation failed** — error surfaced, retry; **no row is written on model failure**.
5. **Draft beside approved** — the approved summary stays rendered as current; the draft presents as "revision in progress."

**Stale-tab edge (doc-pinned so the PR handles it):** acting on a superseded row (autosave or approve from a second tab after regeneration in the first) is refused by the DB — frozen row, no legal transition. The UI translates that rejection into "this draft was replaced — refresh to see the current draft," never a generic save error.

## API routes

All `getCurrentCoach()`-gated:

- `POST /api/days/[id]/summary` — generate: builder → prompt (`claude-sonnet-4-6` via `wrapLLMCall`, same telemetry as the existing route) → insert (BEFORE INSERT trigger supersedes any live draft).
- `PATCH /api/day-summaries/[id]` — `final_text` autosave (DayNotes debounce + serialization pattern; `useControlWrite` states).
- `POST /api/day-summaries/[id]/approve` — status flip + `approved_by/at`, **no text payload** (the text is already there; approval carries no payload race).

## Testing spine (named regressions)

1. **DB-enforced matrix, tested at the DB:** both partial unique indexes; trigger rejections (immutable columns, frozen superseded rows, approval without approver fields); auto-supersede on approve; BEFORE INSERT draft supersession; RLS denies DELETE.
2. **Builder identity:** informing IDs derived from the returned context object; the route stores the same object it prompted with (deep-equality assertion in the route test).
3. **Current-summary selection:** the one piece of state logic living in app code rather than the DB matrix — all five slot states asserted, including draft-beside-approved. It looks like presentation and is actually semantics; it will regress in a UI refactor otherwise.
4. **Contract strings, one test:** the prompts contain the observation/prescription instruction, the empty-means-empty requirement, and (session route) the prior-sessions-primary / "subsequently"-only framing. The builder marks empty sources explicitly.
5. **Eligibility reuse:** session-coaching item set comes from the shared banner function — origin-session exclusion asserted specifically.
6. **Stale-tab:** PATCH/approve on a superseded row → typed "replaced" error, not a 500.
7. **Seed:** contract-complete summary (IDs resolve; `prompt_context` schema-conformant via the pure core), verify-per-driver over full reshaped sets, `demo-scenarios.test.ts` retuned. Existing keys-only pin test untouched and green.

## Task sequence

Each task mergeable-green with per-task reviews; single PR; Scott merges. Worktree `.worktrees/ai-day-summary`, branch `feat/ai-day-summary`.

1. Migration: `day_summaries` + triggers + indexes + RLS — SQL handshake (below)
2. Shared lib: builder fetch + pure split, eligibility wiring, context types
3. Summary routes (generate / autosave / approve)
4. Day-page slot UI (five states, chip, stale-tab message)
5. Session-coaching rewrite
6. Seed regen + purge fixes (last — consumes the real schema and the real assembly core)
7. Final whole-branch review (it has caught cross-cutting bugs in both prior phases)

**Prod migration handshake:** the handshake block **leads with executable identity SQL, not a reminder** — first statement is `select current_database(), (select count(*) from information_schema.tables where table_schema = 'public');` with expected values stated, then the migration. The 8/1 wrong-project gotcha proved the confirmation has to be in the transcript, not in the head. Scott applies via SQL editor; verification queries run with recorded outputs. Never touch the DB from the session — `.env.local` points at hosted prod. Live verification: demo drivers only, record IDs, delete after; the seed apply is Scott's psql recipe.

## Out of scope

- Superseded-history UI (the DB preserves it; a viewer is one SELECT away when asked for)
- Draft/final diff view (the chip is the Phase 3 disclosure budget)
- Driver-visible surfaces (legacy-summary decision above is the tripwire)
- Session-coaching provenance/approval (load-bearing pairing in decision 7)
- Video/media (Phase 4)
