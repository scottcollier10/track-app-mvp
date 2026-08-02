# AI Day Summary (Phase 3) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Phase 3 — coach-approved AI Day Summaries with append-only provenance, the observation-only day-aware rewrite of session coaching, and demo seed regen to the real HPDE shape — per `docs/plans/2026-08-01-ai-day-summary-design.md` (binding; read it first).

**Architecture:** One additive migration (`day_summaries` + two partial unique indexes + two triggers owning the whole write matrix), a shared context builder split into a pure assembly core and a thin fetch layer (the returned object IS the provenance snapshot), three thin API routes, a five-state slot on the day page, the coaching route rewritten onto the same builder, and the seed generator taught days/focus/summaries with a fixed purge order.

**Tech Stack:** Next.js 14 (app router), Supabase (PostgREST + RLS), `@anthropic-ai/sdk` via `wrapLLMCall`, Jest, TypeScript. Tests: `cd web && npx jest <path>`.

**House rules (every task):**
- One definition per displayed value. Metrics only via `track-days.ts` / `insights.ts` (`validLapTimesMs`, `canClaimConsistency`, `sessionDelta`, `deltaBaselineIndex`, `representativeSessions`, `focusItemsForSession`, `focusPanelGroups`, `bySessionStart`, `localDateForTimezone`). The builder computes nothing itself.
- No AI-authored text ever enters a prompt. `ai_coaching_summary` is not an input anywhere.
- Deltas signed, no verdicts. Empty sources reported as empty, never padded.
- Routes never write `updated_at` (DB triggers own it). `day_summaries` writes go through the matrix triggers; the app never "helps."
- `.env.local` points at HOSTED PROD. Migrations applied by Scott via SQL editor after review — the executor NEVER applies SQL. The handshake block leads with executable identity SQL. Live verification: demo drivers only, record ids, delete after.
- Scott merges the PR. Not you.

---

## Task 1: `day_summaries` migration + types

**Files:**
- Create: `web/supabase/migrations/20260801_day_summaries.sql`
- Modify: `web/src/lib/types/database.ts` (Row/Insert/Update following `focus_items`' shape)
- Modify: `web/src/lib/types/index.ts` (domain types)

**Step 1: Write the migration**

```sql
-- Day summaries (Phase 3). See docs/plans/2026-08-01-ai-day-summary-design.md.
-- Additive + idempotent. Safe to apply before app code deploys.
-- Append-only generations: one row per generation. The write matrix lives in
-- triggers HERE, not in route discipline.
begin;

create table if not exists public.day_summaries (
  id uuid primary key default uuid_generate_v4(),
  track_day_id uuid not null references public.track_days(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','approved','superseded')),
  -- Immutable after insert (enforced by trigger): the generated content and
  -- everything that informed it.
  draft_text text not null,
  prompt_context jsonb not null,
  -- 'seed' for demo-seeded rows: the row would otherwise claim a generation
  -- that never ran. This table's provenance columns don't lie.
  model text not null,
  informing_session_ids uuid[] not null,
  informing_assessment_ids uuid[] not null,
  -- Coach-authored. Seeded with draft_text at insert so "current text" is
  -- always final_text with no COALESCE, and the draft/final diff starts at
  -- zero and grows only by coach action. Writable in draft and approved;
  -- frozen at superseded (history that can drift stops being history).
  final_text text not null,
  approved_by uuid references public.coaches(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.day_summaries is
  'Append-only AI day-summary generations. draft_text/provenance immutable; final_text coach-authored; superseded rows frozen. No DELETE policy on purpose.';
comment on column public.day_summaries.final_text is
  'Coach-authored. Seeded from draft_text at insert (no-COALESCE current text; diff grows only by coach action). updated_at > approved_at marks a post-approval edit.';

-- At most one live draft and one approved summary per day. The approved index
-- turns "approved a new row without superseding the old one" into a
-- constraint violation instead of two current summaries.
create unique index if not exists day_summaries_one_live_draft
  on public.day_summaries(track_day_id) where status = 'draft';
create unique index if not exists day_summaries_one_approved
  on public.day_summaries(track_day_id) where status = 'approved';
create index if not exists idx_day_summaries_day on public.day_summaries(track_day_id);

-- BEFORE INSERT: supersede any live draft for this day. Regeneration is
-- single-statement and race-free (supabase-js has no multi-statement
-- transactions; an RPC would be more machinery than a trigger).
create or replace function public.day_summaries_before_insert()
returns trigger language plpgsql
set search_path = '' as $$
begin
  update public.day_summaries
     set status = 'superseded'
   where track_day_id = new.track_day_id and status = 'draft';
  return new;
end $$;

drop trigger if exists day_summaries_supersede_draft on public.day_summaries;
create trigger day_summaries_supersede_draft
  before insert on public.day_summaries
  for each row execute function public.day_summaries_before_insert();

-- BEFORE UPDATE: the status write matrix.
--   any status:  draft_text / prompt_context / model / informing_* /
--                track_day_id / created_at immutable
--   superseded:  row fully frozen
--   draft:       final_text writable; legal transitions -> approved, superseded
--   approved:    final_text writable (post-approval edits are the coach's to
--                own); legal transition -> superseded
--   draft->approved: approved_by + approved_at REQUIRED in the same write, and
--                the old approved row (if any) is auto-superseded here, which
--                makes the one-approved index unviolatable by construction.
--   approval fields writable ONLY at draft->approved.
create or replace function public.day_summaries_write_matrix()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.draft_text            is distinct from old.draft_text
     or new.prompt_context     is distinct from old.prompt_context
     or new.model              is distinct from old.model
     or new.informing_session_ids    is distinct from old.informing_session_ids
     or new.informing_assessment_ids is distinct from old.informing_assessment_ids
     or new.track_day_id       is distinct from old.track_day_id
     or new.created_at         is distinct from old.created_at then
    raise exception 'day_summaries: generated content and provenance are immutable';
  end if;

  if old.status = 'superseded' then
    raise exception 'day_summaries: superseded rows are frozen';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'approved' then
      if new.approved_by is null or new.approved_at is null then
        raise exception 'day_summaries: approval requires approved_by and approved_at';
      end if;
      update public.day_summaries
         set status = 'superseded'
       where track_day_id = new.track_day_id
         and status = 'approved'
         and id <> new.id;
    elsif (old.status = 'draft' or old.status = 'approved')
          and new.status = 'superseded' then
      -- Supersession never touches approval fields.
      if new.approved_by is distinct from old.approved_by
         or new.approved_at is distinct from old.approved_at then
        raise exception 'day_summaries: approval fields writable only at draft->approved';
      end if;
    else
      raise exception 'day_summaries: illegal status transition % -> %', old.status, new.status;
    end if;
  else
    if new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'day_summaries: approval fields writable only at draft->approved';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists day_summaries_enforce_matrix on public.day_summaries;
create trigger day_summaries_enforce_matrix
  before update on public.day_summaries
  for each row execute function public.day_summaries_write_matrix();

-- updated_at: DB-owned, same function Phase 2 installed.
drop trigger if exists day_summaries_set_updated_at on public.day_summaries;
create trigger day_summaries_set_updated_at
  before update on public.day_summaries
  for each row execute function public.set_updated_at();

alter table public.day_summaries enable row level security;

-- Coach chain via track_days -> drivers. SELECT + INSERT + UPDATE only.
-- No DELETE policy: the DB enforces append-only, not app discipline.
drop policy if exists day_summaries_select on public.day_summaries;
create policy day_summaries_select on public.day_summaries for select to authenticated
  using (exists (select 1 from public.track_days td
                 join public.drivers d on d.id = td.driver_id
                 where td.id = day_summaries.track_day_id
                   and d.coach_id = public.current_coach_id()));
drop policy if exists day_summaries_insert on public.day_summaries;
create policy day_summaries_insert on public.day_summaries for insert to authenticated
  with check (exists (select 1 from public.track_days td
                      join public.drivers d on d.id = td.driver_id
                      where td.id = day_summaries.track_day_id
                        and d.coach_id = public.current_coach_id()));
drop policy if exists day_summaries_update on public.day_summaries;
create policy day_summaries_update on public.day_summaries for update to authenticated
  using (exists (select 1 from public.track_days td
                 join public.drivers d on d.id = td.driver_id
                 where td.id = day_summaries.track_day_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.track_days td
                      join public.drivers d on d.id = td.driver_id
                      where td.id = day_summaries.track_day_id
                        and d.coach_id = public.current_coach_id()));

commit;
```

Note: the trigger-internal supersede UPDATEs re-enter `day_summaries_write_matrix` for the superseded row — `draft→superseded` / `approved→superseded` are legal transitions changing only `status`, so they pass. The one-approved index is safe because the auto-supersede completes before the approving UPDATE's own index entry lands.

Note: the two BEFORE UPDATE triggers fire in alphabetical order — `day_summaries_enforce_matrix` before `day_summaries_set_updated_at` — which is the order we want (matrix validates, then updated_at stamps). That ordering is name-dependent; the names above happen to be correct, so do NOT rename these triggers.

**Step 2: Types.** In `database.ts`, add `day_summaries` Row/Insert/Update + Relationships exactly following the `focus_items` entry shape (`informing_session_ids: string[]`, `prompt_context: Json`). In `index.ts`:

```ts
export type DaySummary = Database['public']['Tables']['day_summaries']['Row'];
export type DaySummaryStatus = 'draft' | 'approved' | 'superseded';
```

**Step 3: Typecheck** — `cd web && npx tsc --noEmit`. **Step 4: Commit**

```bash
git add web/supabase/migrations/20260801_day_summaries.sql web/src/lib/types
git commit -m "feat(migrations): day_summaries — append-only generations, DB-enforced write matrix"
```

**Task 1 review fixes (applied in `8144397` + `e3c8e35`; the SQL above is the pre-review text):**

1. **DB owns `approved_at`** — `new.approved_at := now();` in the `draft->approved` branch, after the null check. A route-computed `approved_at` (`new Date().toISOString()` in Node) is earlier than the DB's `now()` by one round trip, so `updated_at > approved_at` would be true on every fresh approval and Task 4's "edited after approval" chip — the phase's whole disclosure budget — would always be lit. Demo data would not have shown it (seeded rows are INSERTs; `set_updated_at` is BEFORE UPDATE). The route still sends both fields (the null check is the intent declaration); the DB just makes the value trustworthy.
2. **INSERT-path constraints** — the write matrix is BEFORE UPDATE only, so it could not see an INSERT. Two table CHECKs (`day_summaries_approved_has_approver`, `day_summaries_draft_is_unapproved`) plus a born-superseded guard in the BEFORE INSERT trigger. `superseded` is legal as a destination and illegal as a birth state, which is why that third one can't be a CHECK.
3. **`id` immutable** — added to the matrix's immutable-column list beside `created_at`.
4. Comment fixes: `comment on column model` (the `'seed'` convention now survives into the DB), the `approved_by` FK behavior named per `6b19b21`, and the trigger-ordering note corrected — the order is right but nothing depends on it today.

**Carry-forwards into later tasks (from the same review):**

- **Task 3:** two overlapping generates for one day hit `day_summaries_one_live_draft` with SQLSTATE `23505`, whose message does NOT contain `day_summaries:` — so the generate route needs its own `error.code === '23505'` branch returning the same 409 `replaced` shape. Add the test. Also: the approve route must keep sending a non-null `approved_at` even though the DB overwrites it (dropping it raises) — say so in a route comment.
- **Task 4:** serialize Approve into the same write queue as the debounced `final_text` PATCH. A PATCH landing after the approve POST bumps `updated_at` past `approved_at` and lights the chip with no coach edit.
- **Task 7:** the seeded row keeps `approved_at: now()`. Backdating it while `updated_at` defaults to `now()` lights the chip on every seeded row.
- **Task 8:** after Scott applies the migration, regen `database.ts` and confirm a no-op diff. Task 1 hand-edited a file whose header says "GENERATED — do not hand-edit"; that is unavoidable pre-apply (Phase 2 did the same) but nothing currently schedules the reconciliation. Also: `final_text = draft_text` at insert is the one invariant left to route discipline (the seed needs them to differ), pinned by the Task 3 test rather than the DB.

**Step 5: HANDSHAKE (main thread, not subagent).** The block Scott runs **leads with executable identity SQL** (the 8/1 wrong-project gotcha — confirmation lives in the transcript, not in the head):

```sql
-- 1. IDENTITY CHECK — run first, confirm before anything else.
select current_database(),
       (select count(*) from information_schema.tables where table_schema = 'public') as public_tables;
-- Expected: the TrackApp prod project; public_tables matches the known count
-- (verify against the last recorded handshake; if it looks wrong, STOP).
```

Then the migration, then verification:

```sql
-- 2. Structure
select indexname from pg_indexes where tablename = 'day_summaries' order by 1;
-- expected: day_summaries_one_approved, day_summaries_one_live_draft, idx_day_summaries_day, pkey
select policyname, cmd from pg_policies where tablename = 'day_summaries' order by 1;
-- expected: select/insert/update — NO delete row

-- 3. Behavioral check of the trigger matrix, fully rolled back (uses a real
--    demo track_day id; substitute one, e.g. from:
--    select td.id from track_days td join drivers d on d.id = td.driver_id
--     where d.email like '%@trackapp.demo' limit 1;)
begin;
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd1', '{}', 'test', '{}', '{}', 'd1');
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd2', '{}', 'test', '{}', '{}', 'd2');
select status, draft_text from day_summaries where track_day_id = '<DEMO_DAY_ID>' order by created_at;
-- expected: d1 superseded, d2 draft (BEFORE INSERT supersede works)
update day_summaries set draft_text = 'x' where track_day_id = '<DEMO_DAY_ID>' and status = 'draft';
-- expected: ERROR immutable  (then re-BEGIN the block below)
rollback;
begin;
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd3', '{}', 'test', '{}', '{}', 'd3');
update day_summaries set status = 'approved' where track_day_id = '<DEMO_DAY_ID>' and status = 'draft';
-- expected: ERROR approval requires approved_by and approved_at
rollback;
begin;
-- Auto-supersede on approve — the trickiest trigger interaction — plus frozen-superseded.
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd1', '{}', 'test', '{}', '{}', 'd1');
update day_summaries set status = 'approved',
  approved_by = (select id from coaches limit 1), approved_at = now()
 where track_day_id = '<DEMO_DAY_ID>' and status = 'draft';
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd2', '{}', 'test', '{}', '{}', 'd2');
update day_summaries set status = 'approved',
  approved_by = (select id from coaches limit 1), approved_at = now()
 where track_day_id = '<DEMO_DAY_ID>' and status = 'draft';
select draft_text, status from day_summaries where track_day_id = '<DEMO_DAY_ID>' order by created_at;
-- expected: d1 superseded, d2 approved — exactly ONE approved row
update day_summaries set final_text = 'x'
 where track_day_id = '<DEMO_DAY_ID>' and draft_text = 'd1';
-- expected: ERROR superseded rows are frozen
rollback;

-- 4. The review fixes (INSERT path + DB-owned approved_at).
begin;
insert into day_summaries (track_day_id, status, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'superseded', 'd1', '{}', 'test', '{}', '{}', 'd1');
-- expected: ERROR rows cannot be inserted as superseded
rollback;
begin;
insert into day_summaries (track_day_id, status, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'approved', 'd1', '{}', 'test', '{}', '{}', 'd1');
-- expected: ERROR check constraint "day_summaries_approved_has_approver"
rollback;
begin;
insert into day_summaries (track_day_id, draft_text, prompt_context, model,
  informing_session_ids, informing_assessment_ids, final_text)
 values ('<DEMO_DAY_ID>', 'd1', '{}', 'test', '{}', '{}', 'd1');
-- Approve with a deliberately stale approved_at, as the route will send.
update day_summaries set status = 'approved',
  approved_by = (select id from coaches limit 1),
  approved_at = now() - interval '1 hour'
 where track_day_id = '<DEMO_DAY_ID>' and status = 'draft';
select approved_at = updated_at as chip_starts_off, now() - approved_at as staleness
  from day_summaries where track_day_id = '<DEMO_DAY_ID>' and status = 'approved';
-- expected: chip_starts_off = true, staleness ~00:00:00 — the DB overwrote the
-- stale value. If false, Task 4's "edited after approval" chip is born lit.
rollback;
```

(RLS DELETE denial can't be behaviorally tested from the SQL editor — postgres bypasses RLS; the `pg_policies` no-delete-row check above covers it.)

Record all outputs in the PR description. If anything unexpected: STOP the plan, report.

---

## Task 2: Shared lib — context assembly (pure), summary view, prompts, countable-lap predicate

**Files:**
- Create: `web/src/lib/day-summaries.ts` (pure assembly core + view selection)
- Create: `web/src/lib/coaching-prompts.ts` (both prompt builders + `AI_MODEL`)
- Modify: `web/src/lib/track-days.ts` (export `isCountableLap`; `validLapTimesMs` uses it)
- Test: `web/src/lib/__tests__/day-summaries.test.ts` (new), `web/src/lib/__tests__/coaching-prompts.test.ts` (new), `web/src/lib/__tests__/track-days.test.ts` (extend)

**Step 1: `isCountableLap` (the design's absorbed follow-up).** In `track-days.ts`, extract the one predicate; `validLapTimesMs` filters with it. Test: a lap with `lap_time_ms: 0` and one with `null` are not countable; positive is. Grep check: the coaching route's inline `lap.lap_time_ms !== null && lap.lap_time_ms > 0` filter disappears in Task 5.

```ts
/** THE one definition of a countable lap. validLapTimesMs returns the times;
 *  callers needing whole rows (lap tables) filter with this directly. */
export function isCountableLap(lap: { lap_time_ms: number | null }): boolean {
  return lap.lap_time_ms !== null && lap.lap_time_ms > 0;
}
```

**Step 2: Failing tests for the pure core** (`day-summaries.test.ts`). The core takes plain data (no supabase types beyond rows) and derives ONLY via existing lib functions:

```ts
describe('assembleDaySummaryContext', () => {
  it('orders sessions by bySessionStart and labels them Session 1..n', () => {});
  it('σ present only when canClaimConsistency(validLapTimesMs(laps)); otherwise consistency null with reason', () => {});
  it('deltas use deltaBaselineIndex (nearest earlier representative) with the baseline named', () => {});
  it('includes non-representative sessions, labeled, never dropped', () => {});
  it('focus items = focusPanelGroups active + resolvedThisDay, with text+status snapshotted and full cross-day assessment history', () => {});
  it('day identity (trackName, date, driverName, sessionCount) and notes text are in the object', () => {});
  it('empty sources are explicit: empty arrays and null notes survive as-is (no omission)', () => {});
  it('contains no ai_coaching_summary field anywhere (structural exclusion)', () => {
    // JSON.stringify(ctx) must not contain 'ai_coaching' — the input-set property.
  });
});
describe('informingIdsFrom', () => {
  it('derives session ids and assessment ids from the context object itself', () => {});
});
describe('daySummaryView', () => {
  it('none: no rows', () => {});
  it('draft only: current = draft, pendingDraft = null', () => {});
  it('approved only: current = approved', () => {});
  it('approved + draft: current = approved, pendingDraft = draft (revision in progress)', () => {});
  it('superseded rows are ignored entirely', () => {});
});
describe('editedAfterApproval', () => {
  it('true only when approved and updated_at > approved_at', () => {});
});
```

**Step 3: Implement `web/src/lib/day-summaries.ts`.** Shape (all derivations via existing lib imports — this module adds structure, not math):

```ts
export interface DaySummaryContext {
  day: { trackName: string; date: string; driverName: string; sessionCount: number; notes: string | null };
  sessions: Array<{
    id: string; label: string;                 // "Session 2"
    bestLapMs: number | null; countableLapCount: number;
    consistencySeconds: number | null;         // null unless canClaimConsistency
    consistencyUnavailableReason: string | null;
    delta: { vsLabel: string; bestLapDeltaMs: number | null; sigmaDeltaSeconds: number | null } | null;
    representativeness: string | null; representativenessNote: string | null;
  }>;
  focusItems: Array<{
    id: string; text: string; status: string;  // snapshotted — items are mutable
    origin: string | null;                     // "from {track}, {date}" | null
    assessments: Array<{ id: string; sessionId: string; sessionLabel: string;
                         judgment: string; note: string | null; createdAt: string }>;
  }>;
  coachingNotes: Array<{ sessionId: string; author: string; body: string; createdAt: string }>;
}
export function assembleDaySummaryContext(input: {/* rows from the fetch layer */}): DaySummaryContext;
export function informingIdsFrom(ctx: DaySummaryContext): { sessionIds: string[]; assessmentIds: string[] };
export function daySummaryView<R extends { status: string }>(rows: R[]): { current: R | null; pendingDraft: R | null };
export function editedAfterApproval(row: { status: string; approved_at: string | null; updated_at: string }): boolean;
```

`daySummaryView`: `approved = rows.find(status==='approved') ?? null; draft = rows.find(status==='draft') ?? null; current = approved ?? draft; pendingDraft = approved && draft ? draft : null`. Focus items via `focusPanelGroups` (`active` + `resolvedThisDay` — the resolved-this-day proxy inherited, not redefined); assessment history via `assessmentsInSessionOrder`.

**Step 4: Failing contract-string tests** (`coaching-prompts.test.ts`) — the testable half of the model contract, one test per design spine item 4:

```ts
describe('buildDaySummaryPrompt', () => {
  it('carries the three contract strings', () => {
    const p = buildDaySummaryPrompt(ctx);
    expect(p).toContain('NEVER author new driving instructions');
    expect(p).toContain('the data suggests earlier braking would help'); // named canonical counterexample
    expect(p).toContain('No coaching records exist for this day');       // empty-means-empty required phrasing
  });
  it('renders explicit empty markers for empty sources (never omits the section)', () => {});
  it('does not contain any ai_coaching text (input-set property, prompt level)', () => {});
});
describe('buildSessionCoachingPrompt', () => {
  it('carries the constraint + retrospective framing strings', () => {
    const p = buildSessionCoachingPrompt(args);
    expect(p).toContain('NEVER author new driving instructions');
    expect(p).toContain('never judge this session with hindsight');
  });
  it('evidence section lists only items eligible for the focal session — an item is absent from its own origin session', () => {});
  it('lap table contains countable laps only, lap numbers as recorded', () => {});
});
```

**Step 5: Implement `web/src/lib/coaching-prompts.ts`.**

```ts
export const AI_MODEL = 'claude-sonnet-4-6'; // one definition, both routes
```

`buildDaySummaryPrompt(ctx: DaySummaryContext): string` — renders ctx deterministically, then:

```
HARD CONSTRAINT
You may summarize coach-directed work: focus items, the coach's own assessments,
coach notes, and session data. You may NEVER author new driving instructions,
readiness or run-group decisions, setup changes, or safety recommendations.
Observations are claims about what happened, verifiable against the data
("laps 8-11 degraded to ±2.1s"). Prescriptions are claims about what the driver
should do ("carry more speed through 5") — never write them. Beware disguised
prescriptions: "the data suggests earlier braking would help" is a prescription
and is forbidden.

If a source is empty, state it plainly — for example: "No coaching records exist
for this day." Never pad or invent.

Write exactly five sections:
## Day overview          (how the day progressed — metrics-grounded)
## Coaching progression  (narrative from focus items and the coach's assessments)
## Important context     (anything limiting interpretation: flags, coach notes)
## Strengths demonstrated (only what the data or coach observations support)
## Carry-forward         (ONLY restate active focus items and explicit coach
                          notes; if none exist, say so)
```

`buildSessionCoachingPrompt(args: { ctx: DaySummaryContext; focalSessionId: string; eligibleItemIds: Set<string>; lapTable: string; driverProfile: {...} }): string` — same HARD CONSTRAINT block, plus:

```
Frame this session against the sessions that came before it. Later sessions in
the day, if present, are "subsequently" context only — never judge this session
with hindsight it did not have.

Write exactly three sections:
## Session in the day's arc   (deltas vs the named baseline; respect context flags —
                               a traffic-compromised run is framed, not scolded)
## Evidence on focus items    (per item: what this session's data shows against its
                               assessment history; if no items are in play, say so)
## Patterns worth the coach's attention  (verifiable data claims only)
```

The evidence section renders only items in `eligibleItemIds` (computed by the route via `focusItemsForSession` — Task 5).

**Step 6:** `cd web && npx jest src/lib && npx tsc --noEmit` — all green. **Step 7: Commit** — `feat(lib): day summary context core, summary view selection, constrained prompts, isCountableLap`

---

## Task 3: Fetch layer + summary routes

**Files:**
- Create: `web/src/data/day-summaries.ts` (fetch layer)
- Create: `web/src/app/api/days/[id]/summary/route.ts` (POST generate)
- Create: `web/src/app/api/day-summaries/[id]/route.ts` (PATCH final_text)
- Create: `web/src/app/api/day-summaries/[id]/approve/route.ts` (POST approve)
- Test: `web/src/app/api/days/[id]/summary/__tests__/route.test.ts` (follow `api/import-session/__tests__/route.test.ts` mock pattern)

**Step 1: Fetch layer.** `web/src/data/day-summaries.ts`:

```ts
export async function buildDaySummaryContext(dayId: string): Promise<DaySummaryContext | null>;
// Reuses getTrackDayDebrief(dayId) (web/src/data/track-days.ts:179 — day, driver,
// track, sessions+laps, focusItems+assessments, originSessions) plus one
// coaching_notes select for the day's session ids. Feeds assembleDaySummaryContext.
// Null when the day doesn't exist / isn't the coach's (RLS-empty).
export async function getDaySummaries(dayId: string): Promise<DaySummary[]>;
// select * where track_day_id = dayId, order created_at desc. Page filters via daySummaryView.
```

**Step 2: Failing route tests** (mock `@/data/day-summaries`, `@/lib/llm-telemetry`, `@/lib/auth/current-coach`, `@/lib/supabase/server` per the import-session pattern):

```ts
it('401 when no coach', () => {});
it('404 when builder returns null', () => {});
it('inserts draft with prompt_context EQUAL to the builder-returned object and informing ids from informingIdsFrom(ctx)', () => {
  // Deep-equality on the captured insert payload — the builder-identity regression.
  expect(captured.prompt_context).toEqual(ctx);
  expect(captured.informing_session_ids).toEqual(informingIdsFrom(ctx).sessionIds);
  expect(captured.final_text).toBe(captured.draft_text); // seeded at insert
  expect(captured.model).toBe(AI_MODEL);
  expect(captured).not.toHaveProperty('updated_at');
});
it('writes NO row when the model call fails (state 4 honesty)', () => {});
it('PATCH maps a write-matrix rejection to 409 {error:"replaced"} — never a 500', () => {
  // supabase update resolves with error.message containing 'day_summaries: superseded rows are frozen'
});
it('approve sends status/approved_by/approved_at and nothing else; same 409 mapping', () => {});
```

**Step 3: Implement.** All `getCurrentCoach()`-gated (401), body-validated (400), `{ error }` shapes matching the focus-items routes.

- **POST `/api/days/[id]/summary`:** ANTHROPIC_API_KEY check (same as coaching route) → `buildDaySummaryContext(dayId)` → 404 if null → `buildDaySummaryPrompt(ctx)` → `wrapLLMCall({ provider: 'anthropic', model: AI_MODEL, prompt, metadata: { project: 'track-app', feature: 'day-summary', coachId, dayId } }, ...)` with `max_tokens: 2000` → on empty/failed output return 500, **no insert** → insert `{ track_day_id, draft_text: output, final_text: output, prompt_context: ctx, model: AI_MODEL, informing_session_ids, informing_assessment_ids }` (BEFORE INSERT trigger handles draft supersession) → 201 with the row.
- **PATCH `/api/day-summaries/[id]`:** body `{ finalText: string }`, non-empty after trim → update `{ final_text }`. **409 mapping:** if the supabase error message contains `day_summaries:` (frozen row / illegal transition), return `409 { error: 'replaced', message: 'This draft was replaced — refresh to see the current draft.' }`; other errors stay 500.
- **POST `/api/day-summaries/[id]/approve`:** update `{ status: 'approved', approved_by: coach.id, approved_at: new Date().toISOString() }`. Same 409 mapping. The DB auto-supersedes the prior approved row; the route does not.

**Step 4:** `npx jest src/app/api && npx tsc --noEmit`. **Step 5: Commit** — `feat(api): day summary generate/edit/approve — provenance identity, typed replaced error`

---

## Task 4: Day-page slot UI

**Files:**
- Create: `web/src/components/days/DaySummarySlot.tsx` (client)
- Modify: `web/src/app/days/[id]/page.tsx` (render slot at the zone-3 comment, line ~193, ABOVE `DayNotes`; fetch `getDaySummaries`)
- Test: `web/src/components/days/__tests__/DaySummarySlot.test.tsx`

**Step 1: Failing component tests** — the five states from `daySummaryView` + chrome:

```ts
it('state 1 (none): renders Generate day summary button', () => {});
it('state 2 (draft): editable text, unapproved-AI-draft label, Approve + Regenerate', () => {});
it('state 3 (approved): final_text rendered, approver + date, Regenerate; no draft label', () => {});
it('state 3 chip: "Edited after approval" iff editedAfterApproval(row)', () => {});
it('state 5 (approved + draft): approved stays rendered as current; draft shown as "Revision in progress"', () => {});
it('state 4 (generation failed): error + retry, no row rendered', () => {});
it('409 from PATCH or approve renders "This draft was replaced — refresh to see the current draft."', () => {});
it('autosave PATCHes finalText debounced; approve sends no text payload', () => {});
```

**Step 2: Implement.** Props: `{ dayId, summaries: DaySummary[], approverName?: string }`; derive states with `daySummaryView` + `editedAfterApproval` (never re-derive locally — the lib functions are the semantics, test spine item 3). Behavior:

- **Generate / Regenerate:** POST `/api/days/[id]/summary`, pending state on the button, `router.refresh()` on success; failure renders state 4 (message + retry) without touching existing rows.
- **Editing (draft and approved):** textarea seeded from `final_text`; debounce 800ms + serialized in-flight/queued + flush on blur/unmount — copy the `DayNotes` pattern (`DayNotes.tsx:41-110`) with `useControlWrite` for status chrome. PATCH body `{ finalText }`.
- **Approve:** POST approve → `router.refresh()`. No payload.
- **409 anywhere:** replace the control area with the replaced-message + a Refresh button (`router.refresh()`).
- Labels: draft = "AI draft — not approved"; approved = "Approved by {name} · {date}"; chip = "Edited after approval". Match existing Card/Tailwind idioms; no new dependency.

**Step 3: Wire the page** — `getDaySummaries(params.id)` alongside the debrief fetch; render `<DaySummarySlot>` above `<DayNotes>`. **Step 4:** `npx jest && npx tsc --noEmit`. **Step 5: Commit** — `feat(days): AI day summary slot — five states, approval, edited-after-approval chip`

---

## Task 5: Session-coaching rewrite (observation-only, day-aware)

**Files:**
- Modify: `web/src/app/api/coaching/generate/route.ts`
- Test: extend the prompt tests from Task 2 if gaps emerge; route keeps its existing posture

**Step 1: Rewrite the route** keeping its skeleton (auth, API-key check, session fetch, laps fetch, gate, `wrapLLMCall`, store to `ai_coaching_summary`, response shape):

- Gate unchanged: `canClaimConsistency(validLapTimesMs(laps))`.
- Replace the inline lap-table filter with `laps.filter(isCountableLap)` (Task 2's predicate — the absorbed follow-up).
- Fetch day context: `buildDaySummaryContext(session.track_day_id)`. If `session.track_day_id` is null, return `500 { error: 'Session has no track day — data integrity issue' }` and log it. Post-P1 a session without a day is corrupt data, not a supported state. NO session-only fallback prompt: a fallback would be a second prompt definition — a shadow path that drifts from the contract precisely because it never runs. Dead defensive branches are where the one-definition rule goes to die.
- Eligible items via the **shared banner function** (`focusItemsForSession`, `track-days.ts:383`) with the focal session as anchor — inputs (assessedItemIds, originSessions, dayDate, trackTimezone) come from the same debrief data the fetch layer already returns. `eligibleItemIds` = `reviewed ∪ inPlay` ids. This is the origin-session exclusion arriving by reuse, not reimplementation.
- Prompt: `buildSessionCoachingPrompt({ ctx, focalSessionId, eligibleItemIds, lapTable, driverProfile })`. Model: `AI_MODEL`.
- Storage and response unchanged: overwrite `ai_coaching_summary`, same success JSON. (Load-bearing pairing lives in the design doc; the route comment references it in one line.)

**Step 2: Delete the old prompt sections** — "Strengths / Areas for Improvement / Next Session Goals" must not survive anywhere in the file. Grep check: `Areas for Improvement` appears nowhere in `web/src`.

**Step 3:** `npx jest && npx tsc --noEmit && npm run build`. **Step 4: Commit** — `feat(coaching): day-aware observation-only session coaching — one builder, shared eligibility`

---

## Task 6: Seed generator — day-awareness, cast reshape, purge order

**Files:**
- Modify: `web/scripts/seed/demo-scenarios.ts` (day-shaped scenario type + retuned cast)
- Modify: `web/scripts/seed/generate-demo-seed.ts` (track_days emission, stale-day sweep)
- Modify: `web/scripts/seed/purge-demo-data.sql`, `web/scripts/seed/purge-demo-data-preview.sql` (order + new tables)
- Delete: `web/supabase/scripts/cleanup-demo-data.sql` (the trap — mutates ALL drivers; a good and a poisoned purge script must not sit side by side)
- Test: `web/src/lib/__tests__/demo-scenarios.test.ts`, `web/src/lib/__tests__/generate-demo-seed.test.ts` (both co-arbiters, updated together)

**Step 1: Reshape the scenario type** — days own sessions:

```ts
export interface ScenarioSession {
  hourUtc: number;                 // 17-23 UTC = same-local-date daytime for US tracks
  lapTimesMs: number[];
  representativeness?: 'partial' | 'not_representative';
  representativenessNote?: string;
}
export interface ScenarioDay {
  weeksAgo: number; day: Weekday; trackName: string;
  sessions: ScenarioSession[];     // chronological
  notes?: string;                  // track_days.notes seed
}
// Scenario gains: days: ScenarioDay[] (replaces sessions);
// toStudentHistory flattens days->sessions (evaluateStudent is day-agnostic).
```

**Step 2: Retune the cast** — flag identities preserved, richness differentiated (design decision 8; the generator's `verifyScenarios` + jest are the arbiters, **run per driver over the full flattened session set**):

- **Kai Garcia (faded):** 2 days × ~4 sessions; the fade lives in the LAST session of the latest day.
- **Marcus Webb (regressed+sustained, building):** 2 days; PB early, both later days' bests > 1.01×PB.
- **Ava Torres (off_baseline):** 2 days; tight priors, latest session swings.
- **Elena Ross (ready):** 3 days × 4 sessions incl. one two-day weekend (Sat+Sun = two day rows); bests improving; latest day tells the full arc.
- **Jordan Lee (building/quiet):** ONE day, TWO short sessions (≤5 laps) — the n=1 rendering check; still no baseline, no flags.
- **Sam Whitaker (quiet control):** 3 days of flat sessions, NO loop richness ever — a Sam with a focus trail is a broken control.

Iterate lap arrays until `verifyScenarios` passes; update `demo-scenarios.test.ts` expectations in the same commit ("the test is the arbiter" — if analytics constants drifted, the test fails first).

**Step 3: Generator day-awareness.** Add deterministic UUIDs beside the existing ones (Postgres accepts these hex forms):

```ts
export function dayUuid(driverN: number, dayN: number): string {
  return `dd000000-${pad4(driverN)}-4000-b000-${pad12(dayN)}`;
}
```

- Session timestamps: `weekendDate` gains the session's `hourUtc` (multiple sessions per day, hours ascending).
- **Day dates via the app's own definition:** `import { localDateForTimezone } from '../../src/lib/track-days'` + a `TRACK_TIMEZONES` map (comment: must match `20260731_track_timezones.sql`; all five current tracks `America/Los_Angeles`). `track_days.date = localDateForTimezone(firstSessionIso, tz)` — SQL stays dumb values.
- **Days are delete-then-insert wholesale, same rationale as laps and the loop entities** — demo day rows are seed-owned. An upsert on `(id)` cannot work here: `track_days` is unique on `(driver_id, track_id, date)`, and the P1 backfill already created day rows for the demo drivers under app-generated ids. Any emitted day landing on the same driver/track/date hits that unique constraint, `ON CONFLICT (id)` doesn't catch it, and the refresh dies mid-script. Wholesale also deletes the stale-day-sweep problem entirely: orphaned backfill rows are swept by construction, and there is no second conflict target to reason about.
- **Ordered clear + emit** (assessments FK: judgments block direct session deletes; `sessions.track_day_id` is DB-nullable — P1 made it app-required, not DB-required):
  1. `DELETE FROM focus_items WHERE driver_id IN (demo)` (cascades assessments — BEFORE stale session deletes)
  2. `UPDATE sessions SET track_day_id = NULL WHERE driver_id IN (demo)` (unhook the FK)
  3. `DELETE FROM track_days WHERE driver_id IN (demo)` — ALL of them, including the P1-backfill rows (cascades `day_summaries`)
  4. existing stale laps/sessions deletes (`NOT IN` emitted session ids)
  5. `INSERT INTO track_days (id, driver_id, track_id, date, notes) ...` — plain INSERT, **no ON CONFLICT**: the clear above guarantees a clean slate, so a collision now is a real bug and must die loudly (add that comment in the emitted SQL; this is NOT the app's keys-only import upsert and must not be confused with it)
  6. session upserts repoint: sessions gain `track_day_id` (+ `representativeness`, `representativeness_note` when flagged) in both INSERT columns and the DO UPDATE SET list

  (Loop entities are delete-then-insert wholesale for the same reason; Task 7 inserts them fresh.)

**Step 4: Purge scripts.** Rewrite both to the design's order — `focus_item_assessments` → `focus_items` → `day_summaries` → `coaching_notes` → `laps` → `sessions` → `track_days` → `drivers` (with `driver_profiles` before `drivers`, as today) — preview shows a count per table. `git rm web/supabase/scripts/cleanup-demo-data.sql`.

**Step 5: Tests.** Extend `generate-demo-seed.test.ts`: determinism unchanged; emitted SQL contains plain day INSERTs (no ON CONFLICT) with `localDateForTimezone`-derived dates; the ordered clear appears with session-unhook and wholesale `track_days` delete BEFORE the day inserts; assessments-cleanup precedes stale session deletes; sessions carry `track_day_id`. Run: `cd web && npx jest src/lib/__tests__ && npx tsx scripts/seed/generate-demo-seed.ts --coach-email=scollier.ah@gmail.com --out=/tmp/demo-seed-check.sql` (verify report prints all six ✓; do NOT apply).

**Step 6: Commit** — `feat(seed): day-shaped demo cast, track_days emission, ordered purge; rm poisoned cleanup script`

---

## Task 7: Seed loop richness + contract-complete summary

**Files:**
- Modify: `web/scripts/seed/demo-scenarios.ts` (focus items, assessments, Elena's summary content)
- Modify: `web/scripts/seed/generate-demo-seed.ts` (emit focus_items / assessments / day_summaries)
- Test: extend `generate-demo-seed.test.ts`

**Step 1: Scenario richness** (differentiated, design decision 8):

```ts
export interface ScenarioFocusItem {
  n: number; text: string;
  status: 'active' | 'achieved' | 'paused' | 'dropped';
  origin: { dayIdx: number; sessionIdx: number } | null;  // null = "added outside a session"
  assessments: Array<{ dayIdx: number; sessionIdx: number;
                       judgment: 'improved' | 'keep_working' | 'no_change' | 'regressed';
                       note?: string }>;
}
```

- **Elena:** the end-to-end story — one item with `keep_working → improved → improved` across days ending `achieved` (cross-day carry-in demonstrated); one still-`active` item.
- **Marcus:** one `active` item with `keep_working`/`regressed` trail matching his flag.
- **Ava:** one **null-origin** item ("added outside a session") + one `paused` item (collapsed group renders).
- Kai: one active item, one assessment. **Jordan and Sam: none.**
- Focus-item text is coach-voice instruction ("Brake later into T5" is FINE here — the coach authors instructions; only AI may not).

**Step 2: Deterministic UUIDs** (same padding helpers):

```ts
focusItemUuid(driverN, itemN)               // dd000000-XXXX-4000-c000-...
assessmentUuid(driverN, itemN, dayIdx, sessionIdx)  // dd000000-XXXX-4000-d0II-DDSSS... (document the packing)
summaryUuid(driverN)                        // dd000000-XXXX-4000-e000-000000000001
```

Emit plain INSERTs (Task 6's wholesale delete cleared them): focus_items with `created_after_session_id` = origin's sessionUuid or NULL, assessments with their (item, session) pairs — the DB's unique cell constraint will reject any scenario typo, which is the point.

**Step 3: Elena's summary — contract-complete** (design decision 8):

- `prompt_context`: built by **the pure core** — the generator imports `assembleDaySummaryContext` and feeds it Elena's latest-day scenario data mapped to the core's input shape (sessions + laps + items + assessments + notes). Real-shaped by construction, not hand-imitated. Serialize into the INSERT as escaped JSON.
- `informing_session_ids` / `informing_assessment_ids`: via `informingIdsFrom(ctx)` — they resolve to the seeded deterministic UUIDs by construction.
- `draft_text`: ~120 words of plausible five-section output, observation-only (write it in the scenario file as a const; it must itself pass the review checklist — no invented instructions).
- `final_text`: identical except ONE tightened sentence (the draft/final daylight demoed as information).
- `model: 'seed'`, `status: 'approved'`, `approved_by: (SELECT id FROM coaches WHERE email = '<coach flag>')` (the generator's existing `--coach-email` input — never a hardcoded UUID), `approved_at: now()`.
- INSERT order: after track_days (FK), single row, no ON CONFLICT (Task 6's wholesale clear guarantees a clean slate; the BEFORE INSERT trigger finds no live draft; the write-matrix trigger never fires on INSERT).

**Step 4: Tests** — extend `generate-demo-seed.test.ts`: summary INSERT present exactly once; `model = 'seed'`; approved_by is the email subquery; `final_text ≠ draft_text`; every uuid in the informing arrays appears earlier in the emitted SQL as an inserted session/assessment id (the resolvability check, string-level); prompt_context parses as JSON and deep-equals the core's output for the same scenario input.

**Step 5:** Full run: `npx jest && npx tsc --noEmit`, then regenerate to `/tmp` and eyeball the verify report. **Step 6: Commit** — `feat(seed): focus histories, flags, notes + contract-complete approved summary (model='seed')`

**Step 7: HANDSHAKE note (main thread):** the refresh recipe (`generate` + `psql -f demo-seed.sql`) is **Scott's post-merge step**, not the executor's. Remind him the first post-P3 run sweeps the old 1-session-day rows and re-shapes everything — preview counts with the purge-preview script are unnecessary (no purge involved) but the generator's verify report should be pasted into the PR.

---

## Task 8: Final whole-branch review

Not a formality — it caught cross-cutting bugs in both prior phases. Review `git diff main...HEAD` against:

1. **Two-views sweep:** no second derivation of σ/gate/baseline/eligibility/grouping/current-summary outside the shared lib. `daySummaryView` is the only "which row is current" logic; grep for `status === 'approved'` outside `day-summaries.ts`. `isCountableLap` is the only lap predicate; grep the old inline filter.
2. **Input-set property:** `ai_coaching_summary` appears in NO prompt path, builder, or context type. Grep it: legal occurrences are the sessions-table column itself, the coaching route's storage write, and `AICoachingCard` display.
3. **Provenance identity:** the generate route stores the builder's returned object verbatim; informing IDs derived via `informingIdsFrom` only.
4. **Write-matrix discipline:** no route writes `updated_at`, `status` transitions only via approve, no DELETE on `day_summaries` anywhere in app code or seed (except the seed's own sweep, which runs as table owner by design).
5. **Contract strings:** all prompt requirements present (constraint block, canonical counterexample, empty-means-empty, retrospective framing). Legacy `ai_coaching_summary` rows are untouched (pre-contract artifacts — the design doc's tripwire line).
6. **Design-doc conformance:** intended gaps inherited (resolved-this-day proxy), origin-session exclusion via the shared function, no generation gate, no superseded-history UI, no draft/final diff view.
7. Full `npx jest && npx tsc --noEmit && npm run build`, no lockfile drift.

Fix findings (each TDD + commit), then hand to Scott for PR + merge. Live verification against prod (after Scott applies the migration): demo drivers only, record ids, delete after — note day-summary rows cannot be deleted via the app by design; QA residue removal is Scott's SQL, same as P2.
