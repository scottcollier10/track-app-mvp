-- Drop public.users: demo-era table, confirmed dead 2026-07-19.
-- Evidence: zero code references (no .from('users') anywhere), no FKs in or
-- out (auth flows use auth.users; coaches.auth_user_id -> auth.users), only a
-- defensive read policy from the week-2 RLS migration, 0 rows in prod.
-- 20260718_coach_scoped_rls.sql updated in the same commit to remove users
-- references (precedent: llm_logs guarded-block update, PR #10).

drop policy if exists users_select on public.users;
drop table if exists public.users;
