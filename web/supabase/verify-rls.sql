-- Run in the SQL editor AFTER applying the migration.
-- Fill in the auth user ids + emails first (dashboard -> Authentication -> Users).
--
-- IMPORTANT: run this only after BOTH coaches have logged in at least once,
-- so ensureCoach has linked their coach rows (auth_user_id set). Before
-- linking, a coach's own row is unlinked and current_coach_id() returns
-- NULL, which would false-fail the "own" checks and false-pass the
-- "foreign" checks (NULL comparisons filter out every row).
begin;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"<COACH_A_AUTH_USER_ID>","email":"<coach-a-email>","role":"authenticated"}';
select 'A sees own coach row' as check, count(*) = 1 as pass from coaches;
select 'A sees own drivers' as check, count(*) > 0 as pass from drivers;
select 'A sees own sessions' as check, count(*) > 0 as pass from sessions;
rollback;

begin;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"<COACH_B_AUTH_USER_ID>","email":"<coach-b-email>","role":"authenticated"}';
-- "is distinct from" (not <>) so NULL coach_id rows would also count as
-- foreign if ever visible.
select 'B sees no foreign drivers' as check, count(*) = 0 as pass
  from drivers where coach_id is distinct from public.current_coach_id();
-- Once B is linked, coaches.email UNIQUE guarantees no OTHER unlinked row
-- can match B's email, so zero rows here is a correct assertion. The only
-- false-fail: B's auth email changed after linking AND an unlinked coach
-- row exists with the new email — not a real leak, just the claim arm.
select 'B sees no foreign coach rows' as check, count(*) = 0 as pass
  from coaches where auth_user_id is distinct from auth.uid();
rollback;

begin;
set local role anon;
select 'anon sees no drivers' as check, count(*) = 0 as pass from drivers;
select 'anon sees no sessions' as check, count(*) = 0 as pass from sessions;
select 'anon sees no coaches' as check, count(*) = 0 as pass from coaches;
rollback;
