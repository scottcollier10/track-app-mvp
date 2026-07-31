-- Populate tracks.timezone and PROVE existing track_day assignments already
-- agree with track-local dates. This migration moves nothing: there is no
-- assignment UPDATE in this file at all. If the assertion raises, STOP and
-- report to Scott — do not "fix" it here.
begin;

-- 1. Timezones first. The assertion below must read these values; run the
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
  orphaned integer;
  unzoned integer;
  moved integer;
begin
  -- The moved-count check inner-joins track_days, so a session with a NULL
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
  -- timezone NULL, coalesce(...,'UTC') kicks in below, and the assertion
  -- passes for exactly the wrong reason. Any session-bearing track still
  -- NULL here means the IN list is wrong — fail loudly, not silently.
  select count(distinct t.id) into unzoned
    from public.tracks t
    join public.sessions s on s.track_id = t.id
   where t.timezone is null;

  if unzoned > 0 then
    raise exception '% session-bearing track(s) still have NULL timezone — the name lists above missed them. STOP and report.', unzoned;
  end if;

  -- Deliberately the SIMPLE form (not a re-bucketing simulation):
  -- (s.date at time zone tz)::date is the SQL restatement of
  -- localDateForTimezone(); the simpler it is, the less it can test the
  -- SQL's opinion instead of the app's.
  -- Fresh-replay hazard: the initial schema seeds a session at NOW() - 2 days which 20260728 bucketed by UTC date; a fresh replay of the whole chain between 00:00–08:00 UTC would raise here on pristine data — prod is the intended target and is unaffected.
  select count(*) into moved
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date;

  if moved > 0 then
    raise exception 'timezone re-bucket would move % session(s); expected 0. STOP and report.', moved;
  end if;
end $$;

commit;
