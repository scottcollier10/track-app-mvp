-- Rollback for 20260718_coach_scoped_rls.sql.
-- Restores pre-week-2 behavior: permissive policies on every table, applying
-- to ALL roles (including anon). Run manually in the dashboard if needed.
-- Intentionally does NOT drop public.current_coach_id() — harmless if left.

-- 1. Drop all policies on affected tables (coach-scoped or otherwise)
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

-- 2. Recreate permissive policies (all roles, all commands)
create policy coaches_permissive on public.coaches for all using (true) with check (true);
create policy drivers_permissive on public.drivers for all using (true) with check (true);
create policy sessions_permissive on public.sessions for all using (true) with check (true);
create policy laps_permissive on public.laps for all using (true) with check (true);
create policy coaching_notes_permissive on public.coaching_notes for all using (true) with check (true);
create policy driver_profiles_permissive on public.driver_profiles for all using (true) with check (true);
create policy tracks_permissive on public.tracks for all using (true) with check (true);
create policy users_permissive on public.users for all using (true) with check (true);
create policy rag_documents_permissive on public.rag_documents for all using (true) with check (true);
create policy rag_chunks_permissive on public.rag_chunks for all using (true) with check (true);
create policy llm_logs_permissive on public.llm_logs for all using (true) with check (true);

-- 3. Restore the global-unique driver email constraint.
-- WARNING: this ALTER will FAIL if, since the migration ran, two coaches
-- created drivers sharing the same email (the per-coach constraint allowed
-- that). Resolve/merge those duplicate driver rows first, then re-run.
alter table public.drivers drop constraint if exists drivers_coach_email_unique;
alter table public.drivers add constraint drivers_email_key unique (email);
