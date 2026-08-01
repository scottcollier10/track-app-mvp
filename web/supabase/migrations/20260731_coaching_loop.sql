-- Coaching loop tables (Phase 2). See docs/plans/2026-07-31-coaching-loop-phase2-design.md.
-- Additive + idempotent. Safe to apply before app code deploys.
begin;

-- Day notes: mutable coach scratchpad. NEVER add this to the import upsert
-- payload in resolveTrackDay — PostgREST compiles payload columns into
-- ON CONFLICT DO UPDATE SET, which would null it on every re-import.
alter table public.track_days add column if not exists notes text;
comment on column public.track_days.notes is
  'Coach day scratchpad. Mutable. Phase 3 summaries must snapshot this text into draft provenance at generation time.';

create table if not exists public.focus_items (
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
create index if not exists idx_focus_items_driver_status on public.focus_items(driver_id, status);
comment on table public.focus_items is
  'Driver-scoped coach instructions. Text editable (coach is sole author). Never deleted by workflow, never invisible in UI.';

create table if not exists public.focus_item_assessments (
  id uuid primary key default uuid_generate_v4(),
  focus_item_id uuid not null references public.focus_items(id) on delete cascade,
  -- Deliberately DEFAULT (NO ACTION), not RESTRICT: both block deleting a
  -- session that has assessments (an assessment is a permanent coach judgment;
  -- purge scripts must delete assessments BEFORE sessions) — but NO ACTION
  -- checks at end-of-statement, so a cascading driver delete that removes
  -- sessions AND assessments (via drivers -> focus_items -> assessments)
  -- succeeds regardless of cascade evaluation order. RESTRICT checks
  -- immediately and can fail that same delete. Demo purge flows delete drivers.
  session_id uuid not null references public.sessions(id),
  judgment text not null
    check (judgment in ('improved','keep_working','no_change','regressed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One assessment per item per session review; corrections rewrite this cell.
  unique (focus_item_id, session_id)
);
create index if not exists idx_assessments_session on public.focus_item_assessments(session_id);
comment on table public.focus_item_assessments is
  'Append-only across sessions; upsert-cell corrections within one (item, session). updated_at > created_at marks a corrected cell. No DELETE policy exists on purpose.';

-- updated_at is maintained HERE, not by app code: the assessments table
-- comment claims "updated_at > created_at marks a corrected cell", and a
-- PostgREST upsert only writes payload columns — a forgotten updated_at in
-- app code would silently break correction detection. The DB owns the claim.
-- Note: an ON CONFLICT DO UPDATE that changes nothing still fires BEFORE
-- UPDATE triggers, so a no-op re-submit marks the cell "corrected". That is
-- intentional: a re-submit IS a coach re-review.
-- Empty search_path per the standing Supabase lint; now() resolves via
-- pg_catalog, which is always searched implicitly.
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists focus_items_set_updated_at on public.focus_items;
create trigger focus_items_set_updated_at
  before update on public.focus_items
  for each row execute function public.set_updated_at();

drop trigger if exists assessments_set_updated_at on public.focus_item_assessments;
create trigger assessments_set_updated_at
  before update on public.focus_item_assessments
  for each row execute function public.set_updated_at();

alter table public.focus_items enable row level security;
alter table public.focus_item_assessments enable row level security;

-- Coach chain via drivers (mirror of sessions_all in 20260718_coach_scoped_rls.sql).
drop policy if exists focus_items_all on public.focus_items;
create policy focus_items_all on public.focus_items for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = focus_items.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = focus_items.driver_id
                        and d.coach_id = public.current_coach_id()));

-- SELECT + INSERT + UPDATE only. No DELETE policy: the DB enforces no-delete.
drop policy if exists assessments_select on public.focus_item_assessments;
create policy assessments_select on public.focus_item_assessments for select to authenticated
  using (exists (select 1 from public.focus_items fi
                 join public.drivers d on d.id = fi.driver_id
                 where fi.id = focus_item_assessments.focus_item_id
                   and d.coach_id = public.current_coach_id()));
drop policy if exists assessments_insert on public.focus_item_assessments;
create policy assessments_insert on public.focus_item_assessments for insert to authenticated
  with check (exists (select 1 from public.focus_items fi
                      join public.drivers d on d.id = fi.driver_id
                      where fi.id = focus_item_assessments.focus_item_id
                        and d.coach_id = public.current_coach_id()));
drop policy if exists assessments_update on public.focus_item_assessments;
create policy assessments_update on public.focus_item_assessments for update to authenticated
  using (exists (select 1 from public.focus_items fi
                 join public.drivers d on d.id = fi.driver_id
                 where fi.id = focus_item_assessments.focus_item_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.focus_items fi
                      join public.drivers d on d.id = fi.driver_id
                      where fi.id = focus_item_assessments.focus_item_id
                        and d.coach_id = public.current_coach_id()));

commit;
