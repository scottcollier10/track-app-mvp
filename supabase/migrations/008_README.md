# Migration 008: Sync Track Data Between iOS and Web

## Overview

This migration removes duplicate track records and ensures track data is consistent between the iOS app and web dashboard.

**Current State:** 7 tracks (with duplicates)
**Target State:** 5 tracks (matching iOS app)

## What This Migration Does

1. **Identifies Duplicates:**
   - Buttonwillow vs Buttonwillow Raceway
   - Thunderhill vs Thunderhill Raceway

2. **Migrates Sessions:**
   - Moves all sessions from duplicate tracks to canonical tracks
   - Preserves all session data and relationships

3. **Removes Duplicates:**
   - Safely deletes duplicate track records
   - Only deletes after confirming no sessions reference them

4. **Validates Results:**
   - Ensures exactly 5 tracks remain
   - Confirms no orphaned sessions
   - Verifies all canonical tracks exist

## Target Tracks (iOS Format)

After migration, these 5 tracks will remain:

1. **Buttonwillow Raceway - Configuration #13** (Buttonwillow, CA - 2.02 km)
2. **Laguna Seca - Full** (Monterey, CA - 3.60 km)
3. **Sonoma Raceway - Full** (Sonoma, CA - 4.02 km)
4. **Streets of Willow - Full** (Rosamond, CA - 2.41 km)
5. **Thunderhill Raceway - 5-Mile** (Willows, CA - 4.83 km)

## Pre-Migration Checklist

**CRITICAL: Create a backup before running this migration!**

```sql
-- Backup tracks table
COPY (SELECT * FROM tracks ORDER BY created_at)
TO '/tmp/tracks_backup_before_008.csv'
WITH (FORMAT csv, HEADER true);

-- Backup sessions table
COPY (SELECT * FROM sessions ORDER BY created_at)
TO '/tmp/sessions_backup_before_008.csv'
WITH (FORMAT csv, HEADER true);

-- Verify backup files were created
\! ls -lh /tmp/*_backup_before_008.csv
```

## How to Run This Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `008_sync_tracks_with_ios.sql`
4. Paste and click **Run**
5. Review the output messages to confirm success

### Option 2: Supabase CLI

```bash
# From project root
supabase db push

# Or apply specific migration
psql $DATABASE_URL < supabase/migrations/008_sync_tracks_with_ios.sql
```

## Post-Migration Validation

After running the migration, validate the results:

```sql
-- Run all validation queries
\i supabase/migrations/008_validation_queries.sql
```

### Expected Output

You should see:

```
✓ PASS: Correct number of tracks (5)
✓ PASS: No duplicate tracks
✓ PASS: No orphaned sessions
✓ PASS: All 5 canonical tracks found
✓ PASS: Duplicate tracks successfully removed
✓✓✓ ALL TESTS PASSED - MIGRATION SUCCESSFUL ✓✓✓
```

### Manual Verification

```sql
-- View final track list
SELECT
  name || ' - ' || config as display_name,
  location,
  ROUND(length_meters::numeric / 1000, 2) as length_km,
  (SELECT COUNT(*) FROM sessions WHERE track_id = tracks.id) as session_count
FROM tracks
ORDER BY name;
```

## Rollback Instructions

If you need to rollback:

```sql
BEGIN;

-- Restore tracks from backup
TRUNCATE TABLE tracks CASCADE;
COPY tracks FROM '/tmp/tracks_backup_before_008.csv'
WITH (FORMAT csv, HEADER true);

-- Restore sessions from backup
TRUNCATE TABLE sessions CASCADE;
COPY sessions FROM '/tmp/sessions_backup_before_008.csv'
WITH (FORMAT csv, HEADER true);

COMMIT;
```

**Note:** Using `CASCADE` will also clear dependent data (sessions, laps, etc.), so both tables must be restored.

## Safety Features

This migration includes multiple safety checks:

1. **Pre-flight Checks:**
   - Verifies duplicate and canonical tracks exist before proceeding

2. **Session Migration:**
   - Moves sessions to canonical tracks before deleting duplicates
   - Uses transactional updates to prevent data loss

3. **Orphan Detection:**
   - Checks for orphaned sessions before deletion
   - Aborts with error if any orphans are detected

4. **Conditional Deletion:**
   - Only deletes tracks that have zero sessions
   - Uses `NOT EXISTS` clause for additional safety

5. **Detailed Logging:**
   - Provides NOTICE messages throughout execution
   - Shows before/after state for verification

## Troubleshooting

### Issue: Migration reports canonical track not found

**Cause:** The canonical track (e.g., "Buttonwillow Raceway") doesn't exist in your database.

**Solution:**
```sql
-- Manually create the missing canonical track
INSERT INTO tracks (name, location, length_meters, config)
VALUES ('Buttonwillow Raceway', 'Buttonwillow, CA', 2016, 'Configuration #13');

-- Then re-run the migration
```

### Issue: Orphaned sessions detected

**Cause:** Some sessions reference tracks that don't exist.

**Solution:**
```sql
-- Find orphaned sessions
SELECT s.*, 'Missing track_id: ' || s.track_id as issue
FROM sessions s
LEFT JOIN tracks t ON s.track_id = t.id
WHERE t.id IS NULL;

-- Fix by assigning to a valid track or deleting invalid sessions
-- (Choose the appropriate solution based on your data)
```

### Issue: Track count is not 5 after migration

**Cause:** Your database state differs from expected.

**Solution:**
```sql
-- View all current tracks
SELECT * FROM tracks ORDER BY name, config;

-- Identify which tracks are missing or extra
-- Manually adjust as needed
```

## Impact Analysis

- **Data Loss:** None - all sessions are preserved
- **Downtime:** Minimal (< 1 second for typical database sizes)
- **Reversibility:** Reversible with backup restoration
- **Foreign Keys:** Preserved - all relationships maintained

## Questions?

If you encounter any issues:

1. Check the migration output messages
2. Run the validation queries
3. Review the rollback instructions
4. Check troubleshooting section above

## References

- Database Schema: `web/supabase/migrations/20240101_initial_schema.sql`
- iOS Track Format: As displayed in iOS app track list
- Session Import: `web/src/app/api/import-session/route.ts`
