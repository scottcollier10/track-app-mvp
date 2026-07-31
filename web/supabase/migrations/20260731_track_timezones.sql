-- Populate tracks.timezone and re-bucket EXACTLY the four diagnosed sessions
-- whose track_day assignments were UTC-bucketed instead of track-local.
--
-- History: this migration was first written to PROVE a no-op. Applied to prod
-- 2026-07-31, its assertion correctly RAISED (transaction rolled back, prod
-- unchanged): 4 sessions were bucketed by UTC date — two pre-noon-anchor
-- date-only imports at Laguna Seca stored as midnight UTC (= 4pm previous day
-- Pacific), and two real evening-Pacific timestamps at Buttonwillow/Sonoma
-- that UTC-bucket to the next day. Owner-approved re-bucket now, while
-- lossless: no coach-authored day data exists yet (the loop-tables migration
-- adding track_days.notes has NOT been applied to prod). Every guard below
-- still RAISEs on anything unexpected. If an assertion raises, STOP and
-- report to Scott — do not "fix" it here.
begin;

-- 1. Timezones first. The assertions below must read these values; run the
--    other way, coalesce(timezone,'UTC') makes it vacuously pass.
--
-- Name variants: the repo's initial schema
-- (web/supabase/migrations/20240101_initial_schema.sql:92-93)
-- seeds 'Thunderhill' and 'Buttonwillow', but the prod-verified demo seed
-- (web/scripts/seed/demo-scenarios.ts:47,49 — names recon-confirmed against prod
-- before the 7/27 seed ran) uses 'Thunderhill Raceway' and 'Buttonwillow
-- Raceway'. Both variants are listed; extras are a harmless zero-row match,
-- and the NULL-timezone guard below catches any variant this list still misses.
update public.tracks set timezone = 'America/Los_Angeles'
 where name in ('Thunderhill', 'Thunderhill Raceway',
                'Sonoma Raceway', 'Laguna Seca',
                'Buttonwillow', 'Buttonwillow Raceway',
                'Streets of Willow')
   and (timezone is null or timezone <> 'America/Los_Angeles');

-- Barber is not in the current seed; harmless zero-row match if absent.
update public.tracks set timezone = 'America/Chicago'
 where name = 'Barber'
   and (timezone is null or timezone <> 'America/Chicago');

do $$
declare
  -- The diagnosed set (2026-07-31, owner-confirmed):
  --   21e05f8d… + 85ec3f88…  scott.collier @ Laguna Seca,   2024-11-22 00:00 UTC -> 2024-11-21 local
  --   052a4757…              Cole Trickle  @ Buttonwillow,  2025-11-16 01:50 UTC -> 2025-11-15 local
  --   c900f074…              Ricky Bobby   @ Sonoma,        2025-11-17 01:46 UTC -> 2025-11-16 local
  expected_ids constant uuid[] := array[
    '21e05f8d-47d4-471c-8922-d2f8ffd9ab01',
    '85ec3f88-d78f-4719-96b6-aa4a51eca306',
    '052a4757-1af2-472f-ae33-3d39798acc27',
    'c900f074-f9ee-457a-a2a4-0acaf4ee239f'
  ]::uuid[];
  orphaned integer;
  unzoned integer;
  mismatched integer;
  mismatched_expected integer;
  old_day_ids uuid[];
  days_created integer;
  sessions_moved integer;
  days_deleted integer;
  empty_days integer;
begin
  -- The mismatch checks inner-join track_days, so a session with a NULL
  -- track_day_id would be silently excluded. Prove the invariant that join
  -- otherwise assumes (mirrors the 20260728 self-verify): every session is
  -- linked to a track day.
  select count(*) into orphaned
    from public.sessions
   where track_day_id is null;

  if orphaned > 0 then
    raise exception '% session(s) have no track_day link — backfill invariant broken. STOP and report.', orphaned;
  end if;

  -- Guard against a vacuous pass: a track name the UPDATEs missed leaves
  -- timezone NULL, coalesce(...,'UTC') kicks in below, and the assertions
  -- pass for exactly the wrong reason. Any session-bearing track still
  -- NULL here means the IN list is wrong — fail loudly, not silently.
  select count(distinct t.id) into unzoned
    from public.tracks t
    join public.sessions s on s.track_id = t.id
   where t.timezone is null;

  if unzoned > 0 then
    raise exception '% session-bearing track(s) still have NULL timezone — the name lists above missed them. STOP and report.', unzoned;
  end if;

  -- The mismatch predicate: (s.date at time zone tz)::date is the SQL
  -- restatement of localDateForTimezone(). Deliberately the SIMPLE form —
  -- the simpler it is, the less it can test the SQL's opinion instead of
  -- the app's.
  -- Fresh-replay hazard: the initial schema seeds a session at NOW() - 2 days which 20260728 bucketed by UTC date; a fresh replay of the whole chain between 00:00–08:00 UTC would raise here on pristine data — prod is the intended target and is unaffected.
  --
  -- Expected-set assertion: this migration moves exactly the four diagnosed
  -- sessions; anything else appearing in the mismatch set means the data
  -- changed since diagnosis — refuse to touch it.
  select count(*),
         count(*) filter (where s.id = any(expected_ids))
    into mismatched, mismatched_expected
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date;

  if mismatched <> 4 or mismatched_expected <> 4 then
    raise exception 'mismatch set differs from the diagnosed set (% mismatched, % of them in the diagnosed four; expected 4 and 4) — the data changed since diagnosis. STOP and report.', mismatched, mismatched_expected;
  end if;

  -- Capture the old day ids BEFORE repointing, so the emptied-day delete
  -- below is scoped to exactly the days these four sessions are leaving.
  select array_agg(distinct s.track_day_id) into old_day_ids
    from public.sessions s
   where s.id = any(expected_ids);

  -- Create target day rows. KEYS-ONLY payload — the same invariant as the
  -- import route's resolveTrackDay upsert: never write non-key columns here,
  -- so nothing coach-authored could ever be clobbered by this path.
  insert into public.track_days (driver_id, track_id, date)
  select distinct s.driver_id, s.track_id,
         (s.date at time zone coalesce(t.timezone, 'UTC'))::date
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date
  on conflict (driver_id, track_id, date) do nothing;
  get diagnostics days_created = row_count;

  -- Repoint the four sessions to the day row matching their track-local date.
  update public.sessions s
     set track_day_id = target.id
    from public.tracks t,
         public.track_days target
   where s.id = any(expected_ids)
     and t.id = s.track_id
     and target.driver_id = s.driver_id
     and target.track_id = s.track_id
     and target.date = (s.date at time zone coalesce(t.timezone, 'UTC'))::date;
  get diagnostics sessions_moved = row_count;

  -- Delete emptied days, SCOPED to the captured old day ids only. A
  -- pre-existing empty day elsewhere is not this migration's to sweep —
  -- the global assertion below reports it instead.
  delete from public.track_days td
   where td.id = any(old_day_ids)
     and not exists (select 1 from public.sessions s where s.track_day_id = td.id);
  get diagnostics days_deleted = row_count;

  -- Final assertion (a): after the move, zero mismatches remain.
  select count(*) into mismatched
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date;

  if mismatched > 0 then
    raise exception '% session(s) still mismatched after re-bucket; expected 0. STOP and report.', mismatched;
  end if;

  -- Final assertion (b): zero empty track_days exist GLOBALLY. If a
  -- pre-existing empty day exists we want to find out loudly, not sweep
  -- it silently.
  select count(*) into empty_days
    from public.track_days td
   where not exists (select 1 from public.sessions s where s.track_day_id = td.id);

  if empty_days > 0 then
    raise exception '% empty track_day row(s) exist after re-bucket; expected 0. A pre-existing empty day is not this migration''s to sweep. STOP and report.', empty_days;
  end if;

  -- Audit record: the SQL-editor NOTICE output of this run goes in the PR.
  raise notice 'timezone re-bucket: % session(s) moved (expected 4)', sessions_moved;
  raise notice 'timezone re-bucket: % target day row(s) created (expected <= 3: Nov 21 Laguna / Nov 15 Buttonwillow / Nov 16 Sonoma — some may already exist)', days_created;
  raise notice 'timezone re-bucket: % emptied old day row(s) deleted (expected 3)', days_deleted;
end $$;

commit;
