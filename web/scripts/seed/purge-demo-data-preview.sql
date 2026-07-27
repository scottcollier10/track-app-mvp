-- purge-demo-data-preview.sql — READ ONLY.
-- Shows exactly what purge-demo-data.sql would delete. Run and review before purging.
-- Scope: all drivers whose email ends in @trackapp.demo (Dec 2025 seed + current demo cast).

WITH demo_drivers AS (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
),
demo_sessions AS (
  SELECT id FROM sessions WHERE driver_id IN (SELECT id FROM demo_drivers)
)
SELECT 'drivers' AS table_name, count(*) AS rows_to_delete FROM demo_drivers
UNION ALL
SELECT 'driver_profiles', count(*) FROM driver_profiles WHERE driver_id IN (SELECT id FROM demo_drivers)
UNION ALL
SELECT 'sessions', count(*) FROM demo_sessions
UNION ALL
SELECT 'laps', count(*) FROM laps WHERE session_id IN (SELECT id FROM demo_sessions)
UNION ALL
SELECT 'coaching_notes', count(*) FROM coaching_notes WHERE session_id IN (SELECT id FROM demo_sessions);

-- The drivers themselves, for eyeball confirmation:
SELECT id, name, email, coach_id, created_at FROM drivers WHERE email LIKE '%@trackapp.demo' ORDER BY created_at;
