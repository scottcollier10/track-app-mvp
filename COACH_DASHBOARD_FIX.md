# Coach Dashboard Session Count Fix

## Problem

The Coach Dashboard at `/coach` was showing incorrect session counts for drivers:
- Example: Ricky Bobby showing "(1 session)" when actually having 3 sessions in the database
- Root cause: Missing database schema for the coaches feature

## Root Cause Analysis

The Coach Dashboard feature was added without the corresponding database schema:
1. **Missing `coaches` table** - The API routes expect a coaches table but it didn't exist
2. **Missing `coach_id` column** - The drivers table needed a foreign key to coaches
3. **Query failures** - The `.eq('coach_id', coachId)` filter was failing silently

## Solution

### Step 1: Run the Migration

Execute the migration to add the coaches table and coach_id column:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/008_add_coaches_table.sql
```

This migration will:
- Create the `coaches` table
- Add `coach_id` column to the `drivers` table
- Insert the demo coach with ID `c1111111-1111-1111-1111-111111111111`
- Assign all existing drivers to the demo coach

### Step 2: Seed Demo Data (Optional)

If you want to populate the database with demo drivers and sessions for testing:

```bash
# In Supabase SQL Editor, run:
web/docs/seed-coaches-data.sql
```

This will create:
- 1 Demo Coach
- 3 Drivers: Ricky Bobby (3 sessions), Cal Naughton Jr (2 sessions), Jean Girard (4 sessions)
- Multiple sessions with laps for each driver

### Step 3: Verify the Fix

1. Run the verification query in Supabase SQL Editor:

```sql
SELECT
  c.name as coach_name,
  d.name as driver_name,
  COUNT(s.id) as session_count
FROM coaches c
LEFT JOIN drivers d ON d.coach_id = c.id
LEFT JOIN sessions s ON s.driver_id = d.id
WHERE c.id = 'c1111111-1111-1111-1111-111111111111'
GROUP BY c.name, d.name, d.id
ORDER BY d.name;
```

2. Visit `/coach` in your browser
3. Verify that each driver shows the correct session count

## Files Changed

1. **supabase/migrations/008_add_coaches_table.sql** - New migration file
2. **web/src/lib/types/database.ts** - Updated TypeScript types
3. **web/docs/seed-coaches-data.sql** - Demo data for testing
4. **web/src/app/api/coaches/[coachId]/drivers/route.ts** - Removed debug logs

## Database Schema

### Coaches Table

```sql
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Drivers Table (updated)

Added column:
```sql
coach_id UUID REFERENCES coaches(id) ON DELETE SET NULL
```

## Testing

After applying the migration:

1. **Check driver list**: All drivers should be visible
2. **Check session counts**: Each driver should show the correct number of sessions
3. **Check stats**: Total sessions, best lap, and improved drivers stats should be accurate
4. **Check comparison table**: Driver-track comparison should work with filters

## Notes

- The demo coach ID `c1111111-1111-1111-1111-111111111111` is hardcoded in `web/src/app/coach/page.tsx`
- All existing drivers will be assigned to the demo coach automatically
- The migration is idempotent (safe to run multiple times)
