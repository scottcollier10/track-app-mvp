-- ========================================
-- Track App Demo Data Cleanup Script
-- ========================================
--
-- This script fixes unrealistic demo data to create a more believable
-- coaching dashboard experience.
--
-- ACTUAL SCHEMA (verified from track-app-supabase-schema_v2.4.txt):
-- - sessions: id, driver_id, track_id, date, total_time_ms, best_lap_ms, source, created_at, coach_notes, ai_coaching_summary, notes
-- - laps: id, session_id, lap_number, lap_time_ms, sector_data, created_at
--
-- NO stored columns for: consistency_score, driving_behavior_score, pace_trend
-- These are ALL calculated from lap times in the web app!
--
-- What we can manipulate:
-- 1. Driver count (delete excess drivers if > 20)
-- 2. lap_time_ms values in laps table
-- 3. best_lap_ms in sessions table (recalculated)
--
-- CRITICAL: Backup your database before running this script!
-- ========================================

-- STEP 1: Check current driver count and adjust if needed
DO $$
DECLARE
  current_driver_count INTEGER;
  drivers_to_delete INTEGER;
BEGIN
  SELECT COUNT(DISTINCT driver_id) INTO current_driver_count FROM sessions;
  RAISE NOTICE 'Current driver count: %', current_driver_count;

  IF current_driver_count > 20 THEN
    drivers_to_delete := current_driver_count - 20;
    RAISE NOTICE 'Need to delete % drivers to reach target of 20', drivers_to_delete;

    WITH drivers_to_remove AS (
      SELECT d.id
      FROM drivers d
      LEFT JOIN sessions s ON d.id = s.driver_id
      GROUP BY d.id
      ORDER BY COUNT(s.id) ASC
      LIMIT drivers_to_delete
    )
    DELETE FROM drivers
    WHERE id IN (SELECT id FROM drivers_to_remove);

    RAISE NOTICE 'Deleted % drivers', drivers_to_delete;
  ELSIF current_driver_count < 20 THEN
    RAISE NOTICE 'WARNING: Only % drivers exist. Cannot reach 20 without seeding more data.', current_driver_count;
    RAISE NOTICE 'Continuing with existing % drivers...', current_driver_count;
  ELSE
    RAISE NOTICE 'Already have exactly 20 drivers. No deletion needed.';
  END IF;
END $$;

-- STEP 2: Assign each driver a pace trend pattern and apply lap time modifications
-- Target distribution: 40% improving, 40% stable, 20% fading
DO $$
DECLARE
  driver_record RECORD;
  driver_num INTEGER := 0;
  total_drivers INTEGER;
  improving_target INTEGER;
  stable_target INTEGER;
  improving_count INTEGER := 0;
  stable_count INTEGER := 0;
  fading_count INTEGER := 0;
  pattern_type TEXT;
  session_record RECORD;
  max_lap INTEGER;
BEGIN
  -- Get total driver count
  SELECT COUNT(DISTINCT driver_id) INTO total_drivers FROM sessions;

  -- Calculate targets for each pattern type
  improving_target := FLOOR(total_drivers * 0.4);
  stable_target := FLOOR(total_drivers * 0.4);
  -- fading gets the remainder

  RAISE NOTICE 'Distributing % drivers: % improving, % stable, % fading',
    total_drivers, improving_target, stable_target, (total_drivers - improving_target - stable_target);

  -- Process each driver (with random ordering to avoid bias)
  FOR driver_record IN (
    WITH ranked_drivers AS (
      SELECT DISTINCT driver_id,
             ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn
      FROM sessions
    )
    SELECT driver_id FROM ranked_drivers ORDER BY rn
  ) LOOP
    driver_num := driver_num + 1;

    -- Assign pattern type based on distribution
    IF improving_count < improving_target THEN
      pattern_type := 'improving';
      improving_count := improving_count + 1;
    ELSIF stable_count < stable_target THEN
      pattern_type := 'stable';
      stable_count := stable_count + 1;
    ELSE
      pattern_type := 'fading';
      fading_count := fading_count + 1;
    END IF;

    -- Apply lap time modifications for each session of this driver
    FOR session_record IN (
      SELECT id FROM sessions WHERE driver_id = driver_record.driver_id
    ) LOOP
      -- Get max lap number for this session
      SELECT MAX(lap_number) INTO max_lap FROM laps WHERE session_id = session_record.id;

      IF pattern_type = 'improving' THEN
        -- IMPROVING: First 3 laps slower, last 3 laps faster
        -- First 3 laps: add 1500-3000ms (cold tires, learning track)
        UPDATE laps
        SET lap_time_ms = lap_time_ms + floor(random() * 1500 + 1500)::int
        WHERE session_id = session_record.id
          AND lap_number <= 3;

        -- Last 3 laps: subtract 800-2000ms (improved rhythm, confidence)
        UPDATE laps
        SET lap_time_ms = GREATEST(lap_time_ms - floor(random() * 1200 + 800)::int, 60000)
        WHERE session_id = session_record.id
          AND lap_number >= (max_lap - 2);

      ELSIF pattern_type = 'stable' THEN
        -- STABLE: Minimal change between first and last laps
        -- First 3 laps: slight warm-up penalty (300-800ms)
        UPDATE laps
        SET lap_time_ms = lap_time_ms + floor(random() * 500 + 300)::int
        WHERE session_id = session_record.id
          AND lap_number <= 3;

        -- Last 3 laps: slight degradation (300-800ms)
        UPDATE laps
        SET lap_time_ms = lap_time_ms + floor(random() * 500 + 300)::int
        WHERE session_id = session_record.id
          AND lap_number >= (max_lap - 2);

      ELSE
        -- FADING: First 3 laps faster, last 3 laps much slower
        -- First 3 laps: subtract 500-1200ms (strong start, fresh tires)
        UPDATE laps
        SET lap_time_ms = GREATEST(lap_time_ms - floor(random() * 700 + 500)::int, 60000)
        WHERE session_id = session_record.id
          AND lap_number <= 3;

        -- Last 3 laps: add 1500-3500ms (fatigue, tire degradation, loss of focus)
        UPDATE laps
        SET lap_time_ms = lap_time_ms + floor(random() * 2000 + 1500)::int
        WHERE session_id = session_record.id
          AND lap_number >= (max_lap - 2);
      END IF;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Applied patterns: % improving, % stable, % fading',
    improving_count, stable_count, fading_count;
END $$;

-- STEP 3: Add variance to ALL laps to create realistic consistency/behavior scores
-- This prevents 0% behavior scores and creates natural lap-to-lap variation
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE laps
  SET lap_time_ms = GREATEST(
    lap_time_ms + floor((random() - 0.5) * 1000)::int,  -- ±500ms variance
    60000  -- Minimum 60 seconds
  );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added realistic variance to % laps', updated_count;
END $$;

-- STEP 4: Recalculate best_lap_ms for each session
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE sessions s
  SET best_lap_ms = (
    SELECT MIN(lap_time_ms)
    FROM laps l
    WHERE l.session_id = s.id
  );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Recalculated best lap for % sessions', updated_count;
END $$;

-- ========================================
-- VERIFICATION - Show final stats
-- ========================================

-- Driver and session counts
SELECT
  'Total Drivers' as metric,
  COUNT(DISTINCT driver_id)::text as value
FROM sessions

UNION ALL

SELECT
  'Total Sessions' as metric,
  COUNT(*)::text as value
FROM sessions

UNION ALL

SELECT
  'Total Laps' as metric,
  COUNT(*)::text as value
FROM laps

UNION ALL

SELECT
  'Avg Laps per Session' as metric,
  ROUND(AVG(lap_count))::text as value
FROM (
  SELECT COUNT(*) as lap_count
  FROM laps
  GROUP BY session_id
) lap_counts;

-- Lap time statistics
SELECT
  '=== LAP TIME STATISTICS ===' as section,
  '' as data

UNION ALL

SELECT
  'Min lap time' as section,
  CONCAT(ROUND(MIN(lap_time_ms) / 1000.0, 2), 's') as data
FROM laps

UNION ALL

SELECT
  'Max lap time' as section,
  CONCAT(ROUND(MAX(lap_time_ms) / 1000.0, 2), 's') as data
FROM laps

UNION ALL

SELECT
  'Avg lap time' as section,
  CONCAT(ROUND(AVG(lap_time_ms) / 1000.0, 2), 's') as data
FROM laps

UNION ALL

SELECT
  'Std deviation' as section,
  CONCAT(ROUND(STDDEV(lap_time_ms) / 1000.0, 2), 's') as data
FROM laps;
