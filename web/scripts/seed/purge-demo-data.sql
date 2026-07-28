-- purge-demo-data.sql — DESTRUCTIVE. Run purge-demo-data-preview.sql first and approve counts.
-- Deletes all demo data (drivers with @trackapp.demo emails) and their children.
BEGIN;

WITH demo_drivers AS (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
),
demo_sessions AS (
  SELECT id FROM sessions WHERE driver_id IN (SELECT id FROM demo_drivers)
)
DELETE FROM coaching_notes WHERE session_id IN (SELECT id FROM demo_sessions);

DELETE FROM laps WHERE session_id IN (
  SELECT s.id FROM sessions s JOIN drivers d ON d.id = s.driver_id WHERE d.email LIKE '%@trackapp.demo'
);

DELETE FROM sessions WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM driver_profiles WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM drivers WHERE email LIKE '%@trackapp.demo';

COMMIT;
