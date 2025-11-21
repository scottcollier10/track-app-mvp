-- ============================================================================
-- Migration 008: Sync Track Data Between iOS and Web
-- ============================================================================
-- Purpose: Remove duplicate tracks and ensure track names match iOS app exactly
--
-- Current State: 7 tracks with duplicates
-- Target State: 5 clean tracks matching iOS app
--
-- Duplicates to merge:
--   1. "Buttonwillow" → merge into "Buttonwillow Raceway"
--   2. "Thunderhill" → merge into "Thunderhill Raceway"
--
-- IMPORTANT: This migration preserves all sessions by moving them to canonical tracks
-- before deleting duplicates. NO sessions will be orphaned.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create backup table for rollback safety
-- ============================================================================
-- Create a backup of current track-session relationships
CREATE TEMP TABLE track_session_backup AS
SELECT
  s.id as session_id,
  s.track_id,
  t.name as track_name,
  t.config as track_config,
  t.location,
  t.length_meters
FROM sessions s
JOIN tracks t ON s.track_id = t.id;

-- Log current state
DO $$
DECLARE
  track_count INTEGER;
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO track_count FROM tracks;
  SELECT COUNT(*) INTO session_count FROM sessions;

  RAISE NOTICE '=== MIGRATION 008 START ===';
  RAISE NOTICE 'Current tracks: %', track_count;
  RAISE NOTICE 'Current sessions: %', session_count;
END $$;

-- ============================================================================
-- STEP 2: Identify duplicate tracks and canonical tracks
-- ============================================================================
-- Display current track status
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '--- Current Tracks ---';
  FOR rec IN
    SELECT
      id,
      name,
      config,
      location,
      (SELECT COUNT(*) FROM sessions WHERE track_id = tracks.id) as session_count
    FROM tracks
    ORDER BY name, config
  LOOP
    RAISE NOTICE 'Track: % (%) - % sessions - ID: %', rec.name, rec.config, rec.session_count, rec.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Migrate sessions from duplicate tracks to canonical tracks
-- ============================================================================

-- Case 1: Buttonwillow → Buttonwillow Raceway
-- Move all sessions from "Buttonwillow" to "Buttonwillow Raceway"
DO $$
DECLARE
  duplicate_id UUID;
  canonical_id UUID;
  sessions_moved INTEGER := 0;
BEGIN
  -- Find the duplicate track (without "Raceway")
  SELECT id INTO duplicate_id
  FROM tracks
  WHERE name = 'Buttonwillow'
    AND config = 'Configuration #13'
  LIMIT 1;

  -- Find the canonical track (with "Raceway")
  SELECT id INTO canonical_id
  FROM tracks
  WHERE name = 'Buttonwillow Raceway'
    AND config = 'Configuration #13'
  LIMIT 1;

  IF duplicate_id IS NOT NULL AND canonical_id IS NOT NULL THEN
    -- Update sessions to point to canonical track
    UPDATE sessions
    SET track_id = canonical_id
    WHERE track_id = duplicate_id;

    GET DIAGNOSTICS sessions_moved = ROW_COUNT;

    RAISE NOTICE 'Buttonwillow: Moved % sessions from % to %', sessions_moved, duplicate_id, canonical_id;
  ELSIF duplicate_id IS NOT NULL THEN
    RAISE WARNING 'Buttonwillow: Duplicate found but no canonical track exists!';
  ELSE
    RAISE NOTICE 'Buttonwillow: No duplicate track found (already clean)';
  END IF;
END $$;

-- Case 2: Thunderhill → Thunderhill Raceway
-- Move all sessions from "Thunderhill" to "Thunderhill Raceway"
DO $$
DECLARE
  duplicate_id UUID;
  canonical_id UUID;
  sessions_moved INTEGER := 0;
BEGIN
  -- Find the duplicate track (without "Raceway")
  SELECT id INTO duplicate_id
  FROM tracks
  WHERE name = 'Thunderhill'
    AND config = '5-Mile'
  LIMIT 1;

  -- Find the canonical track (with "Raceway")
  SELECT id INTO canonical_id
  FROM tracks
  WHERE name = 'Thunderhill Raceway'
    AND config = '5-Mile'
  LIMIT 1;

  IF duplicate_id IS NOT NULL AND canonical_id IS NOT NULL THEN
    -- Update sessions to point to canonical track
    UPDATE sessions
    SET track_id = canonical_id
    WHERE track_id = duplicate_id;

    GET DIAGNOSTICS sessions_moved = ROW_COUNT;

    RAISE NOTICE 'Thunderhill: Moved % sessions from % to %', sessions_moved, duplicate_id, canonical_id;
  ELSIF duplicate_id IS NOT NULL THEN
    RAISE WARNING 'Thunderhill: Duplicate found but no canonical track exists!';
  ELSE
    RAISE NOTICE 'Thunderhill: No duplicate track found (already clean)';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify no sessions are orphaned before deletion
-- ============================================================================
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM sessions s
  LEFT JOIN tracks t ON s.track_id = t.id
  WHERE t.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: % orphaned sessions detected!', orphaned_count;
  END IF;

  RAISE NOTICE 'SAFETY CHECK PASSED: No orphaned sessions';
END $$;

-- ============================================================================
-- STEP 5: Delete duplicate tracks
-- ============================================================================
-- Delete "Buttonwillow" (keeping "Buttonwillow Raceway")
DELETE FROM tracks
WHERE name = 'Buttonwillow'
  AND config = 'Configuration #13'
  AND NOT EXISTS (
    SELECT 1 FROM sessions WHERE track_id = tracks.id
  );

-- Delete "Thunderhill" (keeping "Thunderhill Raceway")
DELETE FROM tracks
WHERE name = 'Thunderhill'
  AND config = '5-Mile'
  AND NOT EXISTS (
    SELECT 1 FROM sessions WHERE track_id = tracks.id
  );

-- ============================================================================
-- STEP 6: Verify final state matches iOS target (5 tracks)
-- ============================================================================
DO $$
DECLARE
  final_track_count INTEGER;
  final_session_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO final_track_count FROM tracks;
  SELECT COUNT(*) INTO final_session_count FROM sessions;

  RAISE NOTICE '=== MIGRATION 008 COMPLETE ===';
  RAISE NOTICE 'Final tracks: %', final_track_count;
  RAISE NOTICE 'Final sessions: %', final_session_count;

  IF final_track_count != 5 THEN
    RAISE WARNING 'Expected 5 tracks but found %', final_track_count;
  END IF;

  RAISE NOTICE '--- Final Track List ---';
  FOR rec IN
    SELECT
      name,
      config,
      location,
      length_meters,
      (SELECT COUNT(*) FROM sessions WHERE track_id = tracks.id) as session_count
    FROM tracks
    ORDER BY name
  LOOP
    RAISE NOTICE '✓ % - % (%, % km) - % sessions',
      rec.name,
      rec.config,
      rec.location,
      ROUND(rec.length_meters::numeric / 1000, 2),
      rec.session_count;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Cleanup temporary tables
-- ============================================================================
DROP TABLE IF EXISTS track_session_backup;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If you need to rollback this migration, you'll need to restore from a backup
-- taken BEFORE running this migration. The rollback process is:
--
-- 1. Restore the entire 'tracks' table from backup
-- 2. Restore the 'sessions' table from backup
--
-- Example rollback SQL (requires backup data):
--
-- BEGIN;
--
-- -- Restore tracks table
-- TRUNCATE TABLE tracks CASCADE;
-- COPY tracks FROM '/path/to/tracks_backup.csv' WITH (FORMAT csv, HEADER true);
--
-- -- Restore sessions table
-- TRUNCATE TABLE sessions CASCADE;
-- COPY sessions FROM '/path/to/sessions_backup.csv' WITH (FORMAT csv, HEADER true);
--
-- COMMIT;
--
-- PREVENTION: Before running this migration, create a backup:
--
-- -- Backup tracks
-- COPY (SELECT * FROM tracks) TO '/tmp/tracks_backup_before_008.csv' WITH (FORMAT csv, HEADER true);
--
-- -- Backup sessions
-- COPY (SELECT * FROM sessions) TO '/tmp/sessions_backup_before_008.csv' WITH (FORMAT csv, HEADER true);
-- ============================================================================

-- ============================================================================
-- VALIDATION QUERIES (run these after migration)
-- ============================================================================

-- Query 1: Verify we have exactly 5 tracks
-- SELECT COUNT(*) as track_count FROM tracks;
-- Expected result: 5

-- Query 2: Verify no duplicate track names
-- SELECT name, config, COUNT(*) as count
-- FROM tracks
-- GROUP BY name, config
-- HAVING COUNT(*) > 1;
-- Expected result: 0 rows

-- Query 3: Verify all sessions have valid track references
-- SELECT COUNT(*) as orphaned_sessions
-- FROM sessions s
-- LEFT JOIN tracks t ON s.track_id = t.id
-- WHERE t.id IS NULL;
-- Expected result: 0

-- Query 4: View final tracks with session counts
-- SELECT
--   t.name,
--   t.config,
--   t.location,
--   ROUND(t.length_meters::numeric / 1000, 2) as length_km,
--   COUNT(s.id) as session_count
-- FROM tracks t
-- LEFT JOIN sessions s ON s.track_id = t.id
-- GROUP BY t.id, t.name, t.config, t.location, t.length_meters
-- ORDER BY t.name;
-- Expected result: 5 tracks matching iOS app
-- ============================================================================
