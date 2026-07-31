-- Populate tracks.timezone and PROVE existing track_day assignments already
-- agree with track-local dates. This migration moves nothing: there is no
-- assignment UPDATE in this file at all. If the assertion raises, STOP and
-- report to Scott — do not "fix" it here.

-- 1. Timezones first. The assertion below must read these values; run the
--    other way, coalesce(timezone,'UTC') makes it vacuously pass.
--
-- Name variants: the repo's initial schema (20240101_initial_schema.sql:92-93)
-- seeds 'Thunderhill' and 'Buttonwillow', but the prod-verified demo seed
-- (scripts/seed/demo-scenarios.ts:47,49 — names recon-confirmed against prod
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
  unnamed integer;
  moved integer;
begin
  -- Guard against a vacuous pass: a track name the UPDATEs missed leaves
  -- timezone NULL, coalesce(...,'UTC') kicks in below, and the assertion
  -- passes for exactly the wrong reason. Any session-bearing track still
  -- NULL here means the IN list is wrong — fail loudly, not silently.
  select count(distinct t.id) into unnamed
    from public.tracks t
    join public.sessions s on s.track_id = t.id
   where t.timezone is null;

  if unnamed > 0 then
    raise exception '% session-bearing track(s) still have NULL timezone — the name lists above missed them. STOP and report.', unnamed;
  end if;

  select count(*) into moved
    from public.sessions s
    join public.track_days td on td.id = s.track_day_id
    join public.tracks t on t.id = s.track_id
   where (s.date at time zone coalesce(t.timezone, 'UTC'))::date <> td.date;

  if moved > 0 then
    raise exception 'timezone re-bucket would move % session(s); expected 0. STOP and report.', moved;
  end if;
end $$;
