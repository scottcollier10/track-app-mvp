-- Track days: explicit entity, implicitly created (design doc 2026-07-28).
-- Additive + idempotent. Safe to apply before app code deploys.
begin;

-- Track timezone drives "local date" for day grouping. Nullable; UTC fallback.
alter table public.tracks add column if not exists timezone text;

create table if not exists public.track_days (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique (driver_id, track_id, date)
);
create index if not exists idx_track_days_driver on public.track_days(driver_id);

comment on table public.track_days is
  'One driver''s day at a track. Auto-upserted on import from (driver, track, local date).';

alter table public.sessions
  add column if not exists track_day_id uuid references public.track_days(id),
  add column if not exists representativeness text
    check (representativeness in ('representative', 'partial', 'not_representative')),
  add column if not exists representativeness_note text;
create index if not exists idx_sessions_track_day on public.sessions(track_day_id);

comment on column public.sessions.representativeness is
  'Coach-set context flag. NULL = representative. UI lands in Phase 2.';

-- RLS: same driver->coach chain as sessions_all (20260718_coach_scoped_rls.sql).
alter table public.track_days enable row level security;
drop policy if exists track_days_all on public.track_days;
create policy track_days_all on public.track_days for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = track_days.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = track_days.driver_id
                        and d.coach_id = public.current_coach_id()));

-- Backfill: group existing sessions by (driver, track, local date). Idempotent.
insert into public.track_days (driver_id, track_id, date)
select distinct s.driver_id, s.track_id,
       (s.date at time zone coalesce(t.timezone, 'UTC'))::date
from public.sessions s
join public.tracks t on t.id = s.track_id
on conflict (driver_id, track_id, date) do nothing;

update public.sessions s
set track_day_id = td.id
from public.tracks t, public.track_days td
where t.id = s.track_id
  and td.driver_id = s.driver_id
  and td.track_id = s.track_id
  and td.date = (s.date at time zone coalesce(t.timezone, 'UTC'))::date
  and s.track_day_id is null;

-- Self-verify (project pattern: counts-first, fail loudly).
do $$
declare
  orphan_sessions int;
  day_count int;
begin
  select count(*) into orphan_sessions from public.sessions where track_day_id is null;
  select count(*) into day_count from public.track_days;
  raise notice 'track_days: % rows; sessions without day: %', day_count, orphan_sessions;
  if orphan_sessions > 0 then
    raise exception 'Backfill incomplete: % sessions lack track_day_id', orphan_sessions;
  end if;
end $$;

commit;
