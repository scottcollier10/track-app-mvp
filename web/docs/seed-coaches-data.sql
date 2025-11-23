-- Seed Data for Coach Dashboard
-- Run this AFTER running the migration 008_add_coaches_table.sql

-- This script creates:
-- 1. A demo coach
-- 2. Multiple drivers assigned to that coach
-- 3. Multiple sessions for each driver

DO $$
DECLARE
  coach_uuid UUID := 'c1111111-1111-1111-1111-111111111111';
  driver1_uuid UUID := gen_random_uuid();
  driver2_uuid UUID := gen_random_uuid();
  driver3_uuid UUID := gen_random_uuid();
  track1_uuid UUID;
  track2_uuid UUID;
  session1_uuid UUID;
  session2_uuid UUID;
  session3_uuid UUID;
  session4_uuid UUID;
  session5_uuid UUID;
  session6_uuid UUID;
BEGIN
  -- Get track IDs (assuming tracks exist)
  SELECT id INTO track1_uuid FROM tracks ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO track2_uuid FROM tracks ORDER BY created_at LIMIT 1 OFFSET 1;

  -- If only one track exists, use it for all sessions
  IF track2_uuid IS NULL THEN
    track2_uuid := track1_uuid;
  END IF;

  -- Insert demo coach (if not exists)
  INSERT INTO coaches (id, name, email)
  VALUES (coach_uuid, 'Demo Coach', 'coach@trackapp.dev')
  ON CONFLICT (id) DO NOTHING;

  -- Insert 3 drivers
  INSERT INTO drivers (id, name, email, coach_id) VALUES
    (driver1_uuid, 'Ricky Bobby', 'ricky.bobby@trackapp.dev', coach_uuid),
    (driver2_uuid, 'Cal Naughton Jr', 'cal.naughton@trackapp.dev', coach_uuid),
    (driver3_uuid, 'Jean Girard', 'jean.girard@trackapp.dev', coach_uuid)
  ON CONFLICT (email) DO NOTHING;

  -- Ricky Bobby: 3 sessions
  session1_uuid := gen_random_uuid();
  session2_uuid := gen_random_uuid();
  session3_uuid := gen_random_uuid();

  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms)
  VALUES
    (session1_uuid, NOW() - INTERVAL '3 days', driver1_uuid, track1_uuid, 89500, 900000),
    (session2_uuid, NOW() - INTERVAL '2 days', driver1_uuid, track2_uuid, 87200, 850000),
    (session3_uuid, NOW() - INTERVAL '1 day', driver1_uuid, track1_uuid, 88100, 880000);

  -- Add laps for Ricky Bobby's sessions
  INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES
    (session1_uuid, 1, 91000), (session1_uuid, 2, 90200), (session1_uuid, 3, 89500),
    (session1_uuid, 4, 89800), (session1_uuid, 5, 90100),
    (session2_uuid, 1, 88900), (session2_uuid, 2, 87800), (session2_uuid, 3, 87200),
    (session2_uuid, 4, 87500), (session2_uuid, 5, 87900),
    (session3_uuid, 1, 89200), (session3_uuid, 2, 88600), (session3_uuid, 3, 88100),
    (session3_uuid, 4, 88400), (session3_uuid, 5, 88700);

  -- Cal Naughton Jr: 2 sessions
  session4_uuid := gen_random_uuid();
  session5_uuid := gen_random_uuid();

  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms)
  VALUES
    (session4_uuid, NOW() - INTERVAL '4 days', driver2_uuid, track1_uuid, 90200, 920000),
    (session5_uuid, NOW() - INTERVAL '1 day', driver2_uuid, track1_uuid, 89800, 900000);

  -- Add laps for Cal's sessions
  INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES
    (session4_uuid, 1, 92000), (session4_uuid, 2, 91200), (session4_uuid, 3, 90200),
    (session4_uuid, 4, 90500), (session4_uuid, 5, 91000),
    (session5_uuid, 1, 91500), (session5_uuid, 2, 90800), (session5_uuid, 3, 89800),
    (session5_uuid, 4, 90100), (session5_uuid, 5, 90400);

  -- Jean Girard: 4 sessions
  session6_uuid := gen_random_uuid();

  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms)
  VALUES
    (session6_uuid, NOW() - INTERVAL '5 days', driver3_uuid, track2_uuid, 86100, 870000);

  INSERT INTO sessions (id, date, driver_id, track_id, best_lap_ms, total_time_ms)
  SELECT gen_random_uuid(), NOW() - INTERVAL (i::text || ' days')::interval, driver3_uuid, track1_uuid,
         85000 + (i * 100), 850000 + (i * 10000)
  FROM generate_series(1, 3) AS i;

  -- Add laps for Jean's first session
  INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES
    (session6_uuid, 1, 87500), (session6_uuid, 2, 86800), (session6_uuid, 3, 86100),
    (session6_uuid, 4, 86400), (session6_uuid, 5, 86900);

  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE 'Coach: Demo Coach (ID: %)', coach_uuid;
  RAISE NOTICE 'Driver 1: Ricky Bobby - 3 sessions';
  RAISE NOTICE 'Driver 2: Cal Naughton Jr - 2 sessions';
  RAISE NOTICE 'Driver 3: Jean Girard - 4 sessions';

END $$;

-- Verify the data
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
