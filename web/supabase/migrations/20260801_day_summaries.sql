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
  -- The FK blocks deleting a coach who has approved a summary: approval
  -- attribution is a permanent record.
  approved_by uuid references public.coaches(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The write matrix below is BEFORE UPDATE only, so it cannot see an INSERT.
  -- These close that path: no row is born 'approved' without an approver (the
  -- demo seed INSERTs an approved row directly), and no draft carries approval
  -- fields. A 'superseded' row legitimately retains the approval fields it
  -- carried out of 'approved', so neither constraint constrains that status.
  constraint day_summaries_approved_has_approver
    check (status <> 'approved'
           or (approved_by is not null and approved_at is not null)),
  constraint day_summaries_draft_is_unapproved
    check (status <> 'draft' or (approved_by is null and approved_at is null))
);
comment on table public.day_summaries is
  'Append-only AI day-summary generations. draft_text/provenance immutable; final_text coach-authored; superseded rows frozen. No DELETE policy on purpose.';
comment on column public.day_summaries.model is
  'Model id of the generation that produced draft_text. Demo-seeded rows use ''seed'': the row never claims a generation that did not run.';
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
  -- The third INSERT-path hole, and the one that can't join the two CHECK
  -- constraints on the table above: 'superseded' is legal as a destination but
  -- illegal as a birth state, and a CHECK sees only the finished row, never how
  -- it got there. Only 'draft' (generate route, via the column default) and
  -- 'approved' (demo seed's direct insert) are legitimate. A row born
  -- superseded is invisible to current-summary selection, frozen by the write
  -- matrix, and — with no DELETE policy, on purpose — permanent.
  if new.status = 'superseded' then
    raise exception 'day_summaries: rows cannot be inserted as superseded';
  end if;

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
--                track_day_id / created_at / id immutable
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
     or new.created_at         is distinct from old.created_at
     or new.id                 is distinct from old.id then
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
      -- DB owns the timestamp, same reason set_updated_at owns updated_at: a
      -- route-computed approved_at is earlier than the DB's now() by one round
      -- trip, which would light the "edited after approval" chip on every
      -- approval. now() is the transaction timestamp, so this and updated_at
      -- land identical and the marker starts false.
      new.approved_at := now();
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
-- The two BEFORE UPDATE triggers fire in alphabetical order —
-- day_summaries_enforce_matrix before day_summaries_set_updated_at — which is
-- the order we want (matrix validates, then updated_at stamps). Nothing
-- depends on it today: set_updated_at overwrites new.updated_at
-- unconditionally and the matrix never reads updated_at, so either order
-- yields the same row. It would start mattering if updated_at ever joined the
-- immutable column list above, which renaming could then silently break.
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
