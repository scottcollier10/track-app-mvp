-- purge-demo-data-preview.sql — READ ONLY.
-- Shows exactly what purge-demo-data.sql would delete. Run and review before purging.
-- Scope: all drivers whose email ends in @trackapp.demo (Dec 2025 seed + current demo cast).
-- Row order matches the purge's delete order, so a surprising count is easy to
-- trace back to the statement that would produce it.

WITH demo_drivers AS (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
),
demo_sessions AS (
  SELECT id FROM sessions WHERE driver_id IN (SELECT id FROM demo_drivers)
),
demo_days AS (
  SELECT id FROM track_days WHERE driver_id IN (SELECT id FROM demo_drivers)
),
demo_focus_items AS (
  SELECT id FROM focus_items WHERE driver_id IN (SELECT id FROM demo_drivers)
)
SELECT 'focus_item_assessments' AS table_name,
       count(*) AS rows_to_delete
  FROM focus_item_assessments WHERE focus_item_id IN (SELECT id FROM demo_focus_items)
UNION ALL
SELECT 'focus_items', count(*) FROM demo_focus_items
UNION ALL
SELECT 'day_summaries', count(*) FROM day_summaries WHERE track_day_id IN (SELECT id FROM demo_days)
UNION ALL
SELECT 'coaching_notes', count(*) FROM coaching_notes WHERE session_id IN (SELECT id FROM demo_sessions)
UNION ALL
SELECT 'laps', count(*) FROM laps WHERE session_id IN (SELECT id FROM demo_sessions)
UNION ALL
SELECT 'sessions', count(*) FROM demo_sessions
UNION ALL
SELECT 'track_days', count(*) FROM demo_days
UNION ALL
SELECT 'driver_profiles', count(*) FROM driver_profiles WHERE driver_id IN (SELECT id FROM demo_drivers)
UNION ALL
SELECT 'drivers', count(*) FROM demo_drivers;

-- The drivers themselves, for eyeball confirmation:
SELECT id, name, email, coach_id, created_at FROM drivers WHERE email LIKE '%@trackapp.demo' ORDER BY created_at;
