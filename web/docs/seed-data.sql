-- Seed Data for Track App V1 Dashboard & Analytics
-- Run these in Supabase SQL Editor after running migrations.sql

-- Note: This script assumes you have at least one driver and 2-3 tracks in your database
-- Adjust the UUIDs below to match your actual driver_id and track_id values

-- IMPORTANT: Replace these UUIDs with actual UUIDs from your database
-- Get them by running: SELECT id, name FROM drivers; and SELECT id, name FROM tracks;

-- Example Driver ID (replace with actual)
-- Get by running: SELECT id FROM drivers LIMIT 1;
DO $$
DECLARE
  driver_uuid UUID;
  track1_uuid UUID;
  track2_uuid UUID;
  track3_uuid UUID;
  session1_uuid UUID := gen_random_uuid();
  session2_uuid UUID := gen_random_uuid();
  session3_uuid UUID := gen_random_uuid();
  session4_uuid UUID := gen_random_uuid();
  session5_uuid UUID := gen_random_uuid();
BEGIN
  -- Get first driver
  SELECT id INTO driver_uuid FROM drivers LIMIT 1;

  -- Get track IDs (assuming you have at least 2 tracks)
  SELECT id INTO track1_uuid FROM tracks ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO track2_uuid FROM tracks ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO track3_uuid FROM tracks ORDER BY created_at LIMIT 1 OFFSET 2;

  -- If only one track exists, use it for all sessions
  IF track2_uuid IS NULL THEN
    track2_uuid := track1_uuid;
  END IF;
  IF track3_uuid IS NULL THEN
    track3_uuid := track1_uuid;
  END IF;

  -- Session 1: Laguna Seca - 10 laps (Nov 10, 2024)
  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms, coach_notes)
  VALUES (
    session1_uuid,
    '2024-11-10T14:30:00Z',
    driver_uuid,
    track1_uuid,
    91234,
    912340,
    'Great session! Driver showed significant improvement in late braking zones. Sector 2 still needs work - losing time in the corkscrew. Focus on carrying more speed through turn 8 next time.'
  );

  -- Session 1 Laps (10 laps, best: 91234ms)
  INSERT INTO laps (id, session_id, lap_number, lap_time_ms) VALUES
    (gen_random_uuid(), session1_uuid, 1, 93450),
    (gen_random_uuid(), session1_uuid, 2, 92100),
    (gen_random_uuid(), session1_uuid, 3, 91234),  -- best lap
    (gen_random_uuid(), session1_uuid, 4, 91890),
    (gen_random_uuid(), session1_uuid, 5, 92345),
    (gen_random_uuid(), session1_uuid, 6, 91567),
    (gen_random_uuid(), session1_uuid, 7, 91789),
    (gen_random_uuid(), session1_uuid, 8, 91456),
    (gen_random_uuid(), session1_uuid, 9, 92123),
    (gen_random_uuid(), session1_uuid, 10, 91678);

  -- Session 2: Thunderhill - 12 laps (Nov 8, 2024)
  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms, coach_notes)
  VALUES (
    session2_uuid,
    '2024-11-08T10:15:00Z',
    driver_uuid,
    track2_uuid,
    87456,
    1052640,
    NULL
  );

  -- Session 2 Laps (12 laps, best: 87456ms)
  INSERT INTO laps (id, session_id, lap_number, lap_time_ms) VALUES
    (gen_random_uuid(), session2_uuid, 1, 89234),
    (gen_random_uuid(), session2_uuid, 2, 88123),
    (gen_random_uuid(), session2_uuid, 3, 87890),
    (gen_random_uuid(), session2_uuid, 4, 87456),  -- best lap
    (gen_random_uuid(), session2_uuid, 5, 88234),
    (gen_random_uuid(), session2_uuid, 6, 87789),
    (gen_random_uuid(), session2_uuid, 7, 88012),
    (gen_random_uuid(), session2_uuid, 8, 87923),
    (gen_random_uuid(), session2_uuid, 9, 88456),
    (gen_random_uuid(), session2_uuid, 10, 88234),
    (gen_random_uuid(), session2_uuid, 11, 87678),
    (gen_random_uuid(), session2_uuid, 12, 88901);

  -- Session 3: Laguna Seca - 8 laps (Nov 5, 2024)
  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms, coach_notes)
  VALUES (
    session3_uuid,
    '2024-11-05T15:45:00Z',
    driver_uuid,
    track1_uuid,
    92567,
    743200,
    'First session at this track. Driver is still learning the racing line. Consistency improved throughout the session. Work on entry speed for turn 1 and throttle application out of turn 11.'
  );

  -- Session 3 Laps (8 laps, best: 92567ms)
  INSERT INTO laps (id, session_id, lap_number, lap_time_ms) VALUES
    (gen_random_uuid(), session3_uuid, 1, 95234),
    (gen_random_uuid(), session3_uuid, 2, 94123),
    (gen_random_uuid(), session3_uuid, 3, 93456),
    (gen_random_uuid(), session3_uuid, 4, 92567),  -- best lap
    (gen_random_uuid(), session3_uuid, 5, 93123),
    (gen_random_uuid(), session3_uuid, 6, 92789),
    (gen_random_uuid(), session3_uuid, 7, 93234),
    (gen_random_uuid(), session3_uuid, 8, 92901);

  -- Session 4: Sonoma - 15 laps (Oct 30, 2024)
  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms, coach_notes)
  VALUES (
    session4_uuid,
    '2024-10-30T13:00:00Z',
    driver_uuid,
    track3_uuid,
    94123,
    1426850,
    NULL
  );

  -- Session 4 Laps (15 laps, best: 94123ms)
  INSERT INTO laps (id, session_id, lap_number, lap_time_ms) VALUES
    (gen_random_uuid(), session4_uuid, 1, 96456),
    (gen_random_uuid(), session4_uuid, 2, 95234),
    (gen_random_uuid(), session4_uuid, 3, 94789),
    (gen_random_uuid(), session4_uuid, 4, 94123),  -- best lap
    (gen_random_uuid(), session4_uuid, 5, 95012),
    (gen_random_uuid(), session4_uuid, 6, 94567),
    (gen_random_uuid(), session4_uuid, 7, 94890),
    (gen_random_uuid(), session4_uuid, 8, 94345),
    (gen_random_uuid(), session4_uuid, 9, 95123),
    (gen_random_uuid(), session4_uuid, 10, 94678),
    (gen_random_uuid(), session4_uuid, 11, 94234),
    (gen_random_uuid(), session4_uuid, 12, 95456),
    (gen_random_uuid(), session4_uuid, 13, 94901),
    (gen_random_uuid(), session4_uuid, 14, 95234),
    (gen_random_uuid(), session4_uuid, 15, 94567);

  -- Session 5: Thunderhill - 10 laps (Oct 28, 2024)
  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms, coach_notes)
  VALUES (
    session5_uuid,
    '2024-10-28T11:30:00Z',
    driver_uuid,
    track2_uuid,
    88234,
    892340,
    'Excellent consistency today. Driver demonstrated improved racecraft and smooth inputs. Pace trend shows improvement throughout the session. Ready to move up to advanced group.'
  );

  -- Session 5 Laps (10 laps, best: 88234ms)
  INSERT INTO laps (id, session_id, lap_number, lap_time_ms) VALUES
    (gen_random_uuid(), session5_uuid, 1, 90123),
    (gen_random_uuid(), session5_uuid, 2, 89456),
    (gen_random_uuid(), session5_uuid, 3, 88789),
    (gen_random_uuid(), session5_uuid, 4, 88456),
    (gen_random_uuid(), session5_uuid, 5, 88234),  -- best lap
    (gen_random_uuid(), session5_uuid, 6, 88567),
    (gen_random_uuid(), session5_uuid, 7, 88345),
    (gen_random_uuid(), session5_uuid, 8, 88901),
    (gen_random_uuid(), session5_uuid, 9, 88456),
    (gen_random_uuid(), session5_uuid, 10, 88678);

END $$;

-- Verify seed data was inserted
SELECT
  s.date,
  t.name as track,
  d.name as driver,
  COUNT(l.id) as lap_count,
  s.best_lap_ms,
  CASE WHEN s.coach_notes IS NOT NULL THEN 'Yes' ELSE 'No' END as has_notes
FROM sessions s
LEFT JOIN tracks t ON s.track_id = t.id
LEFT JOIN drivers d ON s.driver_id = d.id
LEFT JOIN laps l ON l.session_id = s.id
GROUP BY s.id, s.date, t.name, d.name, s.best_lap_ms, s.coach_notes
ORDER BY s.date DESC;

-- Summary statistics
SELECT
  'Total Sessions' as metric,
  COUNT(*)::text as value
FROM sessions
UNION ALL
SELECT
  'Total Laps',
  COUNT(*)::text
FROM laps
UNION ALL
SELECT
  'Sessions with Coach Notes',
  COUNT(*)::text
FROM sessions
WHERE coach_notes IS NOT NULL;
