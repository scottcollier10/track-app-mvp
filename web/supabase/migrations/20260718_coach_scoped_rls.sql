-- Coach-scoped RLS. Anon role gets NO policies: unauthenticated sees nothing.
-- Applied manually in the dashboard AFTER the week-2 code deploy.

-- 1. Drop all existing (permissive) policies on affected tables
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('coaches','drivers','sessions','laps','coaching_notes',
                        'driver_profiles','tracks','users','rag_documents',
                        'rag_chunks','llm_logs')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 1b. RLS must be ON for policies to gate anything. Idempotent.
-- (llm_logs is handled in its own guarded block below; see section 7.)
alter table public.coaches enable row level security;
alter table public.drivers enable row level security;
alter table public.sessions enable row level security;
alter table public.laps enable row level security;
alter table public.coaching_notes enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.users enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

-- 2. Helper: coach id for the current auth user
create or replace function public.current_coach_id()
returns uuid language sql stable as $$
  select id from public.coaches where auth_user_id = (select auth.uid())
$$;

-- 3. coaches — email arm lets an invited coach claim their unlinked row
create policy coaches_select on public.coaches for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (auth_user_id is null
        and lower(email) = lower((select auth.jwt()->>'email')))
  );
create policy coaches_update on public.coaches for update to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (auth_user_id is null
        and lower(email) = lower((select auth.jwt()->>'email')))
  )
  with check (auth_user_id = (select auth.uid()));
create policy coaches_insert on public.coaches for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

-- 4. drivers
create policy drivers_all on public.drivers for all to authenticated
  using (coach_id = public.current_coach_id())
  with check (coach_id = public.current_coach_id());

-- 5. sessions / driver_profiles (chain via drivers)
create policy sessions_all on public.sessions for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = sessions.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = sessions.driver_id
                        and d.coach_id = public.current_coach_id()));
create policy driver_profiles_all on public.driver_profiles for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = driver_profiles.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = driver_profiles.driver_id
                        and d.coach_id = public.current_coach_id()));

-- 6. laps / coaching_notes (chain via sessions -> drivers)
create policy laps_all on public.laps for all to authenticated
  using (exists (select 1 from public.sessions s
                 join public.drivers d on d.id = s.driver_id
                 where s.id = laps.session_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.sessions s
                      join public.drivers d on d.id = s.driver_id
                      where s.id = laps.session_id
                        and d.coach_id = public.current_coach_id()));
create policy coaching_notes_all on public.coaching_notes for all to authenticated
  using (exists (select 1 from public.sessions s
                 join public.drivers d on d.id = s.driver_id
                 where s.id = coaching_notes.session_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.sessions s
                      join public.drivers d on d.id = s.driver_id
                      where s.id = coaching_notes.session_id
                        and d.coach_id = public.current_coach_id()));

-- 7. Shared / non-tenant tables
create policy tracks_select on public.tracks for select to authenticated using (true);
create policy tracks_insert on public.tracks for insert to authenticated with check (true);
create policy users_select on public.users for select to authenticated using (true);
create policy rag_documents_select on public.rag_documents for select to authenticated using (true);
create policy rag_chunks_select on public.rag_chunks for select to authenticated using (true);

-- llm_logs does not exist yet (telemetry writes silently fail); guarded so
-- this migration is safe now and applies RLS if the table is created later.
-- If you create llm_logs, re-run this block.
do $$
begin
  if to_regclass('public.llm_logs') is not null then
    execute 'alter table public.llm_logs enable row level security';
    execute 'create policy llm_logs_select on public.llm_logs for select to authenticated using (true)';
    execute 'create policy llm_logs_insert on public.llm_logs for insert to authenticated with check (true)';
  end if;
end $$;

-- 8. drivers.email: global unique -> per-coach unique.
-- The import flow scopes driver lookup to the coach; two coaches may
-- legitimately share a driver email (e.g., a driver with two instructors).
-- The unique constraint on (email) is looked up by definition in
-- pg_constraint and dropped by its real name; if none exists the block
-- RAISEs so a name/shape mismatch can't silently leave the global unique
-- in place.
do $$
declare cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.drivers'::regclass
    and c.contype = 'u'
    and (select array_agg(a.attname::text order by a.attname)
         from unnest(c.conkey) k
         join pg_attribute a
           on a.attrelid = c.conrelid and a.attnum = k) = array['email'];
  if cname is null then
    raise exception 'expected a unique constraint on drivers(email); none found — inspect before proceeding';
  end if;
  execute format('alter table public.drivers drop constraint %I', cname);
end $$;
alter table public.drivers add constraint drivers_coach_email_unique unique (coach_id, email);
