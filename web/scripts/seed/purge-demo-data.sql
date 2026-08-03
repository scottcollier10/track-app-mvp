-- purge-demo-data.sql — DESTRUCTIVE. Run purge-demo-data-preview.sql first and approve counts.
-- Deletes all demo data (drivers with @trackapp.demo emails) and their children.
--
-- Order is load-bearing and matches the preview's row order:
--   focus_item_assessments -> focus_items -> day_summaries -> coaching_notes
--   -> laps -> sessions -> track_days -> driver_profiles -> drivers
--
-- Assessments first: focus_item_assessments.session_id is a plain FK
-- (DEFAULT/NO ACTION, chosen over RESTRICT precisely so a cascading driver
-- delete still works), which blocks deleting a session that has judgments
-- anchored to it. Deleting them explicitly here means this script never
-- depends on cascade evaluation order to succeed.
-- track_days after sessions: sessions.track_day_id references it.
BEGIN;

DELETE FROM focus_item_assessments WHERE focus_item_id IN (
  SELECT id FROM focus_items WHERE driver_id IN (
    SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
  )
);

DELETE FROM focus_items WHERE driver_id IN (
  SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
);

DELETE FROM day_summaries WHERE track_day_id IN (
  SELECT id FROM track_days WHERE driver_id IN (
    SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
  )
);

DELETE FROM coaching_notes WHERE session_id IN (
  SELECT id FROM sessions WHERE driver_id IN (
    SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
  )
);

DELETE FROM laps WHERE session_id IN (
  SELECT id FROM sessions WHERE driver_id IN (
    SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo'
  )
);

DELETE FROM sessions WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM track_days WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM driver_profiles WHERE driver_id IN (SELECT id FROM drivers WHERE email LIKE '%@trackapp.demo');

DELETE FROM drivers WHERE email LIKE '%@trackapp.demo';

COMMIT;
