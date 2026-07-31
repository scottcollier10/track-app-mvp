# Coaching Loop (Phase 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the coaching loop — focus items, session-anchored assessments, the debrief sheet, representativeness UI, focus panel, evidence banner, day notes — per `docs/plans/2026-07-31-coaching-loop-phase2-design.md` (binding; read it first).

**Architecture:** Two additive SQL migrations (a proven-no-op timezone assertion, then the loop tables), shared derivations amended in `web/src/lib/track-days.ts` / `web/src/lib/insights.ts` (never forked), five thin API routes following the `add-note` pattern, then client UI (debrief sheet, panel, banner, notes) consuming the one set of shared functions.

**Tech Stack:** Next.js 14 (app router, server components + API routes), Supabase (PostgREST + RLS), Jest, TypeScript. Tests: `cd web && npx jest <path>`.

**House rules (apply to every task):**
- One definition per displayed value. Any `*Representative` variant function is a defect; amend the existing function.
- Deltas are signed numbers with no verdicts. σ only via `sessionConsistencySeconds()`, laps only via `validLapTimesMs()`, gate only via `canClaimConsistency()` (Task 3).
- `.env.local` points at HOSTED PROD. Migrations are applied by Scott via SQL editor after he reviews the SQL — the executor NEVER applies migrations. Any live verification uses demo drivers, records ids, deletes after.
- Scott merges the PR. Not you.

---

## Task 1: Timezone no-op migration

**Files:**
- Create: `web/supabase/migrations/20260731_track_timezones.sql`

No app code, no Jest test — the migration's DO block IS the test. Settled decision: this must prove itself a no-op.

**Step 1: Write the migration**

```sql
-- Populate tracks.timezone and PROVE existing track_day assignments already
-- agree with track-local dates. This migration moves nothing: there is no
-- assignment UPDATE in this file at all. If the assertion raises, STOP and
-- report to Scott — do not "fix" it here.

-- 1. Timezones first. The assertion below must read these values; run the
--    other way, coalesce(timezone,'UTC') makes it vacuously pass.
update public.tracks set timezone = 'America/Los_Angeles'
 where name in ('Thunderhill', 'Sonoma Raceway', 'Laguna Seca', 'Buttonwillow', 'Streets of Willow')
   and (timezone is null or timezone <> 'America/Los_Angeles');

-- Barber is not in the current seed; harmless zero-row match if absent.
update public.tracks set timezone = 'America/Chicago'
 where name = 'Barber'
   and (timezone is null or timezone <> 'America/Chicago');

-- 2. Assertion: each session's recomputed track-local date equals the date of
--    its linked track_day. Deliberately the SIMPLE form (not a re-bucketing
--    simulation): (s.date AT TIME ZONE tz)::date is the SQL restatement of
--    localDateForTimezone(); the simpler it is, the less it can test the SQL's
--    opinion instead of the app's.
do $$
declare
  moved integer;
begin
  select count(*) into moved
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date;

  if moved > 0 then
    raise exception 'timezone re-bucket would move % session(s); expected 0. STOP and report.', moved;
  end if;
end $$;
```

Note the track names must match `tracks.name` values exactly — verify against `web/supabase/migrations/20240101_initial_schema.sql` seed and `20260728_*` seeds before finalizing (e.g. confirm whether the row is `Thunderhill` or `Thunderhill Raceway Park`; adjust the IN list to the actual stored names).

**Step 2: Verify the SQL locally for syntax only**

Run: `cd web && node -e "console.log(require('fs').readFileSync('supabase/migrations/20260731_track_timezones.sql','utf8').length + ' bytes')"` (sanity that the file exists; there is no local Postgres — prod application is Scott's step).

**Step 3: Commit**

```bash
git add web/supabase/migrations/20260731_track_timezones.sql
git commit -m "feat(migrations): track timezones + no-op re-bucket assertion"
```

**Step 4: HANDSHAKE (main thread, not subagent):** show Scott the SQL. He applies via SQL editor and reports the outcome. Verification query for him to run after:
```sql
select name, timezone from public.tracks order by name;
select count(*) as mismatched from public.sessions s
  join public.track_days td on td.id = s.track_day_id
  join public.tracks t on t.id = s.track_id
 where (s.date at time zone coalesce(t.timezone,'UTC'))::date <> td.date;
-- expected: mismatched = 0
```
Record outputs in the PR description. If the DO block raised: STOP the plan, report.

---

## Task 2: Loop tables migration, types, keys-only upsert regression test

**Files:**
- Create: `web/supabase/migrations/20260731_coaching_loop.sql`
- Modify: `web/src/lib/types/database.ts` (add table types following the existing `track_days` shape)
- Modify: `web/src/lib/types/index.ts` (domain types)
- Test: `web/src/data/__tests__/track-days.test.ts` (extend)

**Step 1: Write the migration**

```sql
-- Coaching loop tables (Phase 2). See docs/plans/2026-07-31-coaching-loop-phase2-design.md.

-- Day notes: mutable coach scratchpad. NEVER add this to the import upsert
-- payload in resolveTrackDay — PostgREST compiles payload columns into
-- ON CONFLICT DO UPDATE SET, which would null it on every re-import.
alter table public.track_days add column if not exists notes text;
comment on column public.track_days.notes is
  'Coach day scratchpad. Mutable. Phase 3 summaries must snapshot this text into draft provenance at generation time.';

create table public.focus_items (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  text text not null,
  status text not null default 'active'
    check (status in ('active','achieved','paused','dropped')),
  -- Null = origin honestly unknown (panel-created). SET NULL so session
  -- deletion degrades to "origin unknown" instead of failing or lying.
  created_after_session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_focus_items_driver_status on public.focus_items(driver_id, status);
comment on table public.focus_items is
  'Driver-scoped coach instructions. Text editable (coach is sole author). Never deleted by workflow, never invisible in UI.';

create table public.focus_item_assessments (
  id uuid primary key default uuid_generate_v4(),
  focus_item_id uuid not null references public.focus_items(id) on delete cascade,
  -- RESTRICT: an assessment is a permanent coach judgment. Purge scripts must
  -- delete assessments BEFORE sessions.
  session_id uuid not null references public.sessions(id) on delete restrict,
  judgment text not null
    check (judgment in ('improved','keep_working','no_change','regressed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One assessment per item per session review; corrections rewrite this cell.
  unique (focus_item_id, session_id)
);
create index idx_assessments_session on public.focus_item_assessments(session_id);
comment on table public.focus_item_assessments is
  'Append-only across sessions; upsert-cell corrections within one (item, session). updated_at > created_at marks a corrected cell. No DELETE policy exists on purpose.';

alter table public.focus_items enable row level security;
alter table public.focus_item_assessments enable row level security;

-- Coach chain via drivers (mirror of sessions_all in 20260718_coach_scoped_rls.sql).
create policy focus_items_all on public.focus_items for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = focus_items.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = focus_items.driver_id
                        and d.coach_id = public.current_coach_id()));

-- SELECT + INSERT + UPDATE only. No DELETE policy: the DB enforces no-delete.
create policy assessments_select on public.focus_item_assessments for select to authenticated
  using (exists (select 1 from public.focus_items fi
                 join public.drivers d on d.id = fi.driver_id
                 where fi.id = focus_item_assessments.focus_item_id
                   and d.coach_id = public.current_coach_id()));
create policy assessments_insert on public.focus_item_assessments for insert to authenticated
  with check (exists (select 1 from public.focus_items fi
                      join public.drivers d on d.id = fi.driver_id
                      where fi.id = focus_item_assessments.focus_item_id
                        and d.coach_id = public.current_coach_id()));
create policy assessments_update on public.focus_item_assessments for update to authenticated
  using (exists (select 1 from public.focus_items fi
                 join public.drivers d on d.id = fi.driver_id
                 where fi.id = focus_item_assessments.focus_item_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.focus_items fi
                      join public.drivers d on d.id = fi.driver_id
                      where fi.id = focus_item_assessments.focus_item_id
                        and d.coach_id = public.current_coach_id()));
```

**Step 2: Write the failing regression test** (extend `web/src/data/__tests__/track-days.test.ts`, following its existing supabase mock pattern)

The invariant: `resolveTrackDay`'s upsert payload contains the three key columns and NOTHING else — that is what makes `notes` survive re-import (PostgREST only overwrites payload columns). Assert the payload shape exactly:

```ts
it('re-import upsert payload is keys-only, so coach day notes survive re-import', async () => {
  // Arrange the mock so .upsert captures its payload (follow the file's
  // existing mock structure), then:
  await resolveTrackDay('driver-1', 'track-1', '2026-07-12');
  expect(capturedUpsertPayload).toEqual({
    driver_id: 'driver-1',
    track_id: 'track-1',
    date: '2026-07-12',
  }); // toEqual, not toMatchObject: an EXTRA column is exactly the bug.
});
```

**Step 3: Run it** — `cd web && npx jest src/data/__tests__/track-days.test.ts`. If the existing mocks already capture the payload, this passes immediately (the invariant already holds); that is fine — the test's job is to pin it. Verify it FAILS if you temporarily add `notes: null` to `trackDayInsert` in `web/src/data/track-days.ts:92-96`, then revert. Record that check in the commit message.

**Step 4: Add types.** In `web/src/lib/types/database.ts`, add `focus_items` and `focus_item_assessments` Row/Insert/Update + Relationships entries and `notes: string | null` on `track_days`, exactly following the file's existing generated-style shape. In `web/src/lib/types/index.ts` add domain aliases (`FocusItem`, `FocusItemAssessment`, `FocusItemStatus`, `AssessmentJudgment`, `Representativeness`).

**Step 5: Typecheck + full tests** — `cd web && npx tsc --noEmit && npx jest`.

**Step 6: Commit**

```bash
git add web/supabase/migrations/20260731_coaching_loop.sql web/src/lib/types web/src/data/__tests__/track-days.test.ts
git commit -m "feat(migrations): focus items, assessments (append-only RLS), day notes + keys-only upsert pin"
```

**Step 7: HANDSHAKE (main thread):** show Scott the SQL; he applies; verification for him:
```sql
select tablename, policyname, cmd from pg_policies
 where tablename in ('focus_items','focus_item_assessments') order by 1,2;
-- expected: focus_items_all ALL; assessments select/insert/update — NO delete row
```
Additive-ahead-of-merge is the Phase 1 precedent and is safe.

---

## Task 3: Shared lib — `canClaimConsistency`, representativeness amendments, eligibility union

**Files:**
- Modify: `web/src/lib/insights.ts` (add `canClaimConsistency`)
- Modify: `web/src/lib/track-days.ts` (amend `dayBestLapMs`, `dayConsistencyTrend`, `sessionDelta` callers' baseline; add `representativeSessions`, `dayAggregateAnnotation`, `deltaBaselineIndex`, `focusItemsForSession`)
- Modify: `web/src/app/sessions/[id]/page.tsx:109`, `web/src/app/api/coaching/generate/route.ts:106`, `web/src/components/days/SessionProgressionStrip.tsx:97` (migrate onto the helper)
- Test: `web/src/lib/__tests__/track-days.test.ts`, `web/src/lib/__tests__/insights.test.ts` (extend)

**Step 1: Failing tests for `canClaimConsistency`** (in `insights.test.ts`):

```ts
describe('canClaimConsistency', () => {
  it('claims at exactly MIN_LAPS_FOR_INSIGHTS countable laps', () => {
    expect(canClaimConsistency(Array(MIN_LAPS_FOR_INSIGHTS).fill(90000))).toBe(true);
    expect(canClaimConsistency(Array(MIN_LAPS_FOR_INSIGHTS - 1).fill(90000))).toBe(false);
  });
});
```

**Step 2: Implement** in `web/src/lib/insights.ts` beside the constant:

```ts
/**
 * THE consistency gate — the one answer to "may this session claim a σ?".
 * Input MUST be validLapTimesMs() output (countable laps), never raw lap rows:
 * the coaching route once gated on raw row count while σ ran over fewer laps.
 */
export function canClaimConsistency(lapTimesMs: number[]): boolean {
  return lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS;
}
```

**Step 3: Migrate all gate sites onto it** — `sessions/[id]/page.tsx:109` (`lapTimes` there is already countable-lap derived; verify, then `canClaimConsistency(lapTimes)`), `coaching/generate/route.ts:106` (**behavior fix**: currently gates on raw `laps.length`; feed it `validLapTimesMs()` output — this is the disagreement the deferral existed to fix), `SessionProgressionStrip.tsx:97`, and the two internal length checks in `track-days.ts` (`dayConsistencyTrend:122`, `sessionDelta:257-258`). Grep check: `MIN_LAPS_FOR_INSIGHTS` should no longer appear in a `>=`/`<` comparison outside `insights.ts` (copy strings like "Needs two sessions of N+ laps" may keep the constant).

**Step 4: Failing tests for representativeness** (in `lib/__tests__/track-days.test.ts`):

```ts
// The one exclusion rule: only not_representative excludes. partial and null count.
describe('representativeSessions', () => {
  it('excludes only not_representative; null and partial count fully', () => { /* 4 sessions, one of each flavor -> 3 survive */ });
});
describe('day aggregates under representativeness', () => {
  it('pre-P2 days (all-null flags) produce byte-identical aggregates', () => {
    // dayBestLapMs / dayConsistencyTrend over all-null-flag sessions ===
    // their results over the same sessions without the field. The no-op pin.
  });
  it('dayBestLapMs ignores a not_representative session holding the fastest lap', () => {});
  it('dayConsistencyTrend skips not_representative sessions when picking first/last qualifying', () => {});
  it('dayAggregateAnnotation renders "(3 of 4 sessions)" only for strict subsets, null otherwise', () => {});
});
describe('deltaBaselineIndex', () => {
  it('returns nearest earlier non-excluded session index; null for session 1 or when all priors are excluded', () => {});
});
```

**Step 5: Implement.** AMEND, don't fork:
- `representativeSessions<T extends { representativeness: string | null }>(sessions: T[]): T[]` — filters `!== 'not_representative'`. The ONE filter definition.
- `dayBestLapMs` / `dayConsistencyTrend`: extend their input types with `representativeness: string | null` and apply `representativeSessions` first. Update existing callers (`days/[id]/page.tsx`, `drivers/TrackDayList.tsx`) to pass the field through.
- `dayAggregateAnnotation(total: number, counted: number): string | null` — `counted < total ? \`(${counted} of ${total} sessions)\` : null`.
- `deltaBaselineIndex(sessions: Array<{ representativeness: string | null }>, index: number): number | null` — nearest earlier index not excluded. `SessionProgressionStrip` migrates its `i - 1` onto this in Task 5/6 wiring; the definition lands here.

**Step 6: Failing tests for the eligibility union:**

```ts
describe('focusItemsForSession', () => {
  // Returns { reviewed, inPlay } — the FULL tagged union. reviewed = has an
  // assessment at this session (any current status). inPlay = active items in
  // play coming in: origin session strictly earlier by bySessionStart; null
  // origin falls back to created_at local-date <= day date (same-day tie INCLUDED
  // — noon-anchored session timestamps make wall-clock vs same-day items a coin
  // flip, so ties resolve toward showing the coach their own item).
  it('origin-session item appears from the next session onward, never in its origin session', () => {});
  it('null-origin item created the same local date is inPlay (tie included)', () => {});
  it('null-origin item created after the day date is not inPlay', () => {});
  it('item assessed at this session and since achieved is reviewed but not inPlay', () => {});
  it('paused/dropped items are neither, unless assessed at this session', () => {});
});
```

**Step 7: Implement:**

```ts
export interface FocusItemEligibility<I> { reviewed: I[]; inPlay: I[]; }
export function focusItemsForSession<I extends {
  id: string; status: string; created_at: string;
  created_after_session_id: string | null;
}>(args: {
  items: I[];
  assessedItemIds: Set<string>;            // assessments AT this session
  session: { id: string; date: string };
  originSessions: Map<string, { id: string; date: string }>; // id -> session, for origin ordering
  dayDate: string;                          // track_days.date of the session's day
  trackTimezone: string | null;
}): FocusItemEligibility<I>
```
`reviewed` = items whose id is in `assessedItemIds` (order: item created_at). `inPlay` = `status === 'active'` and not in this session's own origin position: with origin → `bySessionStart(origin, session) < 0`; null origin → `localDateForTimezone(created_at, trackTimezone) <= dayDate`. An item may be in both groups; the sheet renders `reviewed` as correctable and `inPlay \ reviewed` as assessable; the banner renders the two labeled groups.

**Step 8: Run everything** — `cd web && npx jest && npx tsc --noEmit`. Expected: all pass, including untouched Phase 1 suites.

**Step 9: Commit** — `git commit -m "feat(lib): canClaimConsistency (one gate), representativeness-aware aggregates, focus eligibility union"`

---

## Task 4: API routes

**Files (create):**
- `web/src/app/api/focus-items/route.ts` — POST create
- `web/src/app/api/focus-items/[id]/route.ts` — PATCH status/text
- `web/src/app/api/focus-items/[id]/assessments/route.ts` — PUT upsert-cell
- `web/src/app/api/sessions/[id]/context/route.ts` — PATCH representativeness
- `web/src/app/api/days/[id]/notes/route.ts` — PATCH notes

All follow `web/src/app/api/add-note/route.ts` exactly: `getCurrentCoach()` → 401; JSON body validation → 400; referenced-row existence via a scoped select → 404; write; wrapped 500. RLS does tenant scoping — routes do NOT re-implement coach checks beyond `getCurrentCoach()`.

Per-route contracts:
1. **POST /api/focus-items** `{ driverId, text, createdAfterSessionId? }`. Reject empty/whitespace text. `createdAfterSessionId` passes through as given — absent means honestly null, the route NEVER infers an origin session.
2. **PATCH /api/focus-items/[id]** `{ status? , text? }` — at least one. Validate status against the four values; reject empty text. Sets `updated_at`. Status transitions carry NO session anchor and create NO assessment row.
3. **PUT /api/focus-items/[id]/assessments** `{ sessionId, judgment, note? }` — `.upsert({ focus_item_id, session_id, judgment, note, updated_at: new Date().toISOString() }, { onConflict: 'focus_item_id,session_id' })`. This is the correction path AND the creation path: one write, the cell. Validate judgment enum.
4. **PATCH /api/sessions/[id]/context** `{ representativeness, note? }` — validate against the three values or null (null = clear back to representative); when `representative`/null, null the note too.
5. **PATCH /api/days/[id]/notes** `{ notes }` — string or null. Plain update of `track_days.notes`.

**Steps per route (TDD where the logic warrants it):** validation logic worth unit-testing is the enum/shape checks — extract a tiny `validate*` function per route only if the route grows beyond add-note's shape; otherwise route tests are skipped in this codebase (no existing route test harness; do not invent one — match the codebase's testing posture and rely on Task 3's lib tests + Task 8 review). Typecheck after each route: `npx tsc --noEmit`.

**Commit per route or as one commit:** `git commit -m "feat(api): coaching loop write routes (focus items, assessment cells, context, day notes)"`

---

## Task 5: Debrief sheet + import-confirmation flag chip + revalidation

**Files:**
- Create: `web/src/components/days/DebriefSheet.tsx` (client)
- Create: `web/src/components/sessions/ContextFlagChips.tsx` (client, shared)
- Create: `web/src/components/ui/PendingWrite.tsx` or a small `useControlWrite` hook (pending/failed/retry per control)
- Modify: `web/src/components/days/SessionProgressionStrip.tsx` (Debrief action per card; muting; context chips; baseline via `deltaBaselineIndex`)
- Modify: `web/src/app/days/[id]/page.tsx` (pass focus data + representativeness through; annotation on KPIs)
- Modify: the import confirmation UI (find the consumer of `uniqueTrackDayLinks` under `web/src/app/import*` / components; add `ContextFlagChips` per imported session)
- Modify: `web/src/data/track-days.ts` (extend day query with focus items + assessments for the driver)
- Test: `web/src/components/days/__tests__/DebriefSheet.test.tsx`, extend `SessionProgressionStrip.test.tsx`

**Behavior (from the design doc, binding):**
- Sheet opens from a "Debrief" action on EVERY session card (retroactive assessment is legitimate). Four zones:
  1. `ContextFlagChips` — three chips + note input when partial/not. Writes PATCH context.
  2. Delta block — baseline from `deltaBaselineIndex` over the day's sessions, named: "vs Session {n}"; when baseline is partial, propagate: "vs Session {n} · partial — {note}". Best lap Δ + σ Δ (both sides through `canClaimConsistency`), lap counts. Sector deltas ONLY when both sessions' laps carry `sector_data` (reuse `idealLapMs` per session from `@/lib/analytics-v2`; delta of ideal laps, signed, labeled "ideal-lap Δ"). Empty state: "No comparison baseline yet — first session of the day" / "— no earlier representative session". NEVER zeros.
  3. Assess — items from `focusItemsForSession`: `reviewed` rendered with current judgment, tappable to correct (PUT upsert-cell); `inPlay` not yet reviewed rendered with four judgment buttons + note. Each tap writes immediately.
  4. Add focus item — text input; POST with `createdAfterSessionId` = this session id.
- EVERY write control renders pending → saved/failed with a retry affordance (the hook). Optimistic is not hopeful.
- **Revalidation (the cure ships with the cause):** after any successful context-flag write, call `router.refresh()` so the server-rendered day page recomputes baselines, day-best, trend, annotation. The sheet's own delta block re-derives from refreshed props.
- Strip changes: `not_representative` cards mute (opacity + chip w/ note), `partial` cards chip only; deltas use `deltaBaselineIndex` (skip excluded baselines); day KPIs gain `dayAggregateAnnotation`.

**Steps:** (1) failing component tests — sheet renders the four zones; empty-state text when no baseline; partial-baseline naming; judgment tap fires PUT with `{sessionId, judgment}`; failed write shows retry. (2) implement `ContextFlagChips` + hook. (3) implement sheet. (4) wire strip + day page + import confirmation. (5) `npx jest && npx tsc --noEmit`. (6) commit: `feat(days): debrief sheet — session-anchored assessments, context flags, honest deltas`.

Sheet may be a simple fixed-bottom overlay; match existing Card/Tailwind idioms. No new UI dependency.

---

## Task 6: Focus panel + evidence banner + driver badge

**Files:**
- Create: `web/src/components/days/FocusPanel.tsx`
- Create: `web/src/components/sessions/EvidenceBanner.tsx`
- Modify: `web/src/app/days/[id]/page.tsx` (zone 2), `web/src/app/sessions/[id]/page.tsx` (banner under day header, ~line 183)
- Modify: `web/src/components/drivers/TrackDayList.tsx` (assessment-count badge per day row)
- Modify: data layer (`web/src/data/track-days.ts`, `web/src/data/sessions.ts`) to fetch items + assessments
- Test: `web/src/components/days/__tests__/FocusPanel.test.tsx`, `web/src/components/sessions/__tests__/EvidenceBanner.test.tsx`

**FocusPanel (read/manage ONLY — no assessment writes here):** three groups per the design doc §4 — Active (text, origin label from origin session's day: "from {track}, {date}" or "added outside a session"; compact judgment timeline from assessments ordered by session; pause/drop/achieve controls), Resolved this day (achieved/dropped WITH an assessment on this day's sessions), Paused/inactive (collapsed, driver-scoped, NOT day-filtered; reactivate control). "Add focus item" here posts with NO `createdAfterSessionId`. Status writes = PATCH route + `router.refresh()`, with the Task 5 pending/failed hook.

**EvidenceBanner:** two labeled groups from `focusItemsForSession` — "Reviewed in this session" (judgment + current status shown) and "Focus items" (present tense). Renders nothing when both groups are empty. Do NOT relabel as "active coming into this session" — the labels are the honesty.

**Driver badge:** in `TrackDayList`, per day row: count of assessments on that day's sessions ("{n} assessed") — a fact, no derivation, hidden at 0.

**Steps:** failing tests (grouping rules incl. the two intended gaps: panel-dropped item w/o same-day assessment appears only in Paused/inactive; banner omits historically-active-but-since-resolved-unassessed items) → implement → wire pages → full `npx jest && npx tsc --noEmit` → commit `feat(loop): focus panel, evidence banner, assessment-count badge`.

---

## Task 7: Day notes UI

**Files:**
- Create: `web/src/components/days/DayNotes.tsx` (client)
- Modify: `web/src/app/days/[id]/page.tsx` (zone 3, below FocusPanel)
- Test: `web/src/components/days/__tests__/DayNotes.test.tsx`

Textarea prefilled from `track_days.notes`, debounced save (~800ms after typing stops) to PATCH notes, explicit saved / saving / failed-with-retry state via the Task 5 hook. Empty saves as null. Label: "Day notes". No summary UI, no AI anything — the Phase 3 slot renders above this later.

Steps: failing test (debounced PATCH payload; failed→retry) → implement → wire → jest + tsc → commit `feat(days): day notes scratchpad`.

---

## Task 8: Final whole-branch review

Not a formality — Phase 1's whole-branch review caught cross-cutting bugs per-task reviews structurally could not see. Review the entire branch diff (`git diff main...HEAD`) against:

1. **Two-views sweep:** grep for any second derivation of day-best, σ, gate, baseline, eligibility, annotation outside the shared lib. Any `*Representative`-style fork = defect. `MIN_LAPS_FOR_INSIGHTS` comparisons outside `insights.ts` = defect.
2. **Honesty gates:** every σ from `sessionConsistencySeconds` behind `canClaimConsistency(validLapTimesMs(...))`; deltas signed, verdict-free; no scores.
3. **Design-doc conformance:** intended gaps still intact (banner non-reconstruction, resolved-this-day proxy); assessments have no DELETE path anywhere; panel makes no assessment writes; origin never inferred.
4. **Import invariant:** `resolveTrackDay` payload still keys-only; the pin test still asserts `toEqual`.
5. Full suite + typecheck + `npm run build`.

Fix what it finds (each fix TDD + commit), then hand to Scott for PR + merge. Live verification against prod: demo drivers only, record ids, delete after.
