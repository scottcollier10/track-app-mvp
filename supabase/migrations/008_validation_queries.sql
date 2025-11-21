-- ============================================================================
-- Migration 008 Validation Queries
-- ============================================================================
-- Run these queries AFTER applying migration 008 to verify success
-- ============================================================================

-- Query 1: Verify we have exactly 5 tracks
-- Expected: track_count = 5
SELECT
  COUNT(*) as track_count,
  CASE
    WHEN COUNT(*) = 5 THEN '✓ PASS: Correct number of tracks'
    ELSE '✗ FAIL: Expected 5 tracks, found ' || COUNT(*)
  END as status
FROM tracks;

-- ============================================================================

-- Query 2: Verify no duplicate track names exist
-- Expected: 0 rows returned
SELECT
  name,
  config,
  COUNT(*) as duplicate_count,
  '✗ FAIL: Duplicate tracks found' as status
FROM tracks
GROUP BY name, config
HAVING COUNT(*) > 1;

-- If no rows returned, that's a PASS
-- Run this to confirm:
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM tracks
      GROUP BY name, config
      HAVING COUNT(*) > 1
    ) THEN '✓ PASS: No duplicate tracks'
    ELSE '✗ FAIL: Duplicate tracks exist'
  END as duplicate_check;

-- ============================================================================

-- Query 3: Verify all sessions have valid track references (no orphans)
-- Expected: orphaned_sessions = 0
SELECT
  COUNT(*) as orphaned_sessions,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS: No orphaned sessions'
    ELSE '✗ FAIL: Found ' || COUNT(*) || ' orphaned sessions'
  END as status
FROM sessions s
LEFT JOIN tracks t ON s.track_id = t.id
WHERE t.id IS NULL;

-- ============================================================================

-- Query 4: Verify final track list matches iOS target
-- Expected: 5 rows with specific track names
SELECT
  t.name || ' - ' || t.config as display_name,
  t.location,
  ROUND(t.length_meters::numeric / 1000, 2) as length_km,
  COUNT(s.id) as session_count
FROM tracks t
LEFT JOIN sessions s ON s.track_id = t.id
GROUP BY t.id, t.name, t.config, t.location, t.length_meters
ORDER BY t.name;

-- Expected tracks:
-- 1. Buttonwillow Raceway - Configuration #13 (Buttonwillow, CA - 2.02 km)
-- 2. Laguna Seca - Full (Monterey, CA - 3.60 km)
-- 3. Sonoma Raceway - Full (Sonoma, CA - 4.02 km)
-- 4. Streets of Willow - Full (Rosamond, CA - 2.41 km)
-- 5. Thunderhill Raceway - 5-Mile (Willows, CA - 4.83 km)

-- ============================================================================

-- Query 5: Verify specific canonical tracks exist
-- Expected: All 5 tracks should be found
SELECT
  name,
  config,
  '✓ Found' as status
FROM tracks
WHERE
  (name = 'Buttonwillow Raceway' AND config = 'Configuration #13')
  OR (name = 'Laguna Seca' AND config = 'Full')
  OR (name = 'Sonoma Raceway' AND config = 'Full')
  OR (name = 'Streets of Willow' AND config = 'Full')
  OR (name = 'Thunderhill Raceway' AND config = '5-Mile')
ORDER BY name;

-- Verify count
SELECT
  CASE
    WHEN COUNT(*) = 5 THEN '✓ PASS: All 5 canonical tracks found'
    ELSE '✗ FAIL: Expected 5 canonical tracks, found ' || COUNT(*)
  END as canonical_tracks_check
FROM tracks
WHERE
  (name = 'Buttonwillow Raceway' AND config = 'Configuration #13')
  OR (name = 'Laguna Seca' AND config = 'Full')
  OR (name = 'Sonoma Raceway' AND config = 'Full')
  OR (name = 'Streets of Willow' AND config = 'Full')
  OR (name = 'Thunderhill Raceway' AND config = '5-Mile');

-- ============================================================================

-- Query 6: Verify duplicate tracks are gone
-- Expected: 0 rows returned
SELECT
  name,
  config,
  '✗ FAIL: Duplicate track still exists' as status
FROM tracks
WHERE
  (name = 'Buttonwillow' AND config = 'Configuration #13')
  OR (name = 'Thunderhill' AND config = '5-Mile');

-- Verify count
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS: Duplicate tracks successfully removed'
    ELSE '✗ FAIL: Found ' || COUNT(*) || ' duplicate tracks that should have been removed'
  END as duplicate_removal_check
FROM tracks
WHERE
  (name = 'Buttonwillow' AND config = 'Configuration #13')
  OR (name = 'Thunderhill' AND config = '5-Mile');

-- ============================================================================

-- Query 7: Compare session counts before and after
-- This helps verify no sessions were lost during migration
-- (Run this against a backup to compare)
SELECT
  'Current session count' as description,
  COUNT(*) as count
FROM sessions
UNION ALL
SELECT
  'Current track count',
  COUNT(*)
FROM tracks;

-- ============================================================================

-- Summary Report
-- ============================================================================
SELECT '=== MIGRATION 008 VALIDATION SUMMARY ===' as report;

WITH validation_results AS (
  SELECT
    1 as test_order,
    'Track Count' as test_name,
    CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END as result,
    COUNT(*)::text || ' tracks' as details
  FROM tracks

  UNION ALL

  SELECT
    2,
    'No Duplicates',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM tracks GROUP BY name, config HAVING COUNT(*) > 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Checked for duplicate name+config combinations'

  UNION ALL

  SELECT
    3,
    'No Orphaned Sessions',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text || ' orphaned sessions'
  FROM sessions s
  LEFT JOIN tracks t ON s.track_id = t.id
  WHERE t.id IS NULL

  UNION ALL

  SELECT
    4,
    'Canonical Tracks Present',
    CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text || ' of 5 canonical tracks found'
  FROM tracks
  WHERE
    (name = 'Buttonwillow Raceway' AND config = 'Configuration #13')
    OR (name = 'Laguna Seca' AND config = 'Full')
    OR (name = 'Sonoma Raceway' AND config = 'Full')
    OR (name = 'Streets of Willow' AND config = 'Full')
    OR (name = 'Thunderhill Raceway' AND config = '5-Mile')

  UNION ALL

  SELECT
    5,
    'Duplicates Removed',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*)::text || ' duplicate tracks remain'
  FROM tracks
  WHERE
    (name = 'Buttonwillow' AND config = 'Configuration #13')
    OR (name = 'Thunderhill' AND config = '5-Mile')
)
SELECT
  test_order,
  test_name,
  result,
  details
FROM validation_results
ORDER BY test_order;

-- Final verdict
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM (
        SELECT CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END as r FROM tracks
        UNION ALL
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM tracks GROUP BY name, config HAVING COUNT(*) > 1) THEN 'PASS' ELSE 'FAIL' END
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END FROM sessions s LEFT JOIN tracks t ON s.track_id = t.id WHERE t.id IS NULL
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END FROM tracks WHERE (name = 'Buttonwillow Raceway' AND config = 'Configuration #13') OR (name = 'Laguna Seca' AND config = 'Full') OR (name = 'Sonoma Raceway' AND config = 'Full') OR (name = 'Streets of Willow' AND config = 'Full') OR (name = 'Thunderhill Raceway' AND config = '5-Mile')
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END FROM tracks WHERE (name = 'Buttonwillow' AND config = 'Configuration #13') OR (name = 'Thunderhill' AND config = '5-Mile')
      ) results WHERE r = 'FAIL'
    )
    THEN '✓✓✓ ALL TESTS PASSED - MIGRATION SUCCESSFUL ✓✓✓'
    ELSE '✗✗✗ SOME TESTS FAILED - REVIEW REQUIRED ✗✗✗'
  END as final_verdict;

-- ============================================================================
