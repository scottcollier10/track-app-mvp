-- Initial Schema for Track App
-- Creates all tables, indexes, and seed data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_email ON drivers(email);

COMMENT ON TABLE drivers IS 'Drivers who use the Track App';

-- Tracks table
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  length_meters INTEGER,
  config TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_name ON tracks(name);

COMMENT ON TABLE tracks IS 'Racing circuits/tracks';

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  total_time_ms INTEGER NOT NULL,
  best_lap_ms INTEGER,
  source TEXT DEFAULT 'ios_app',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_driver ON sessions(driver_id);
CREATE INDEX idx_sessions_track ON sessions(track_id);
CREATE INDEX idx_sessions_date ON sessions(date DESC);

COMMENT ON TABLE sessions IS 'Driving sessions at a track';

-- Laps table
CREATE TABLE laps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lap_number INTEGER NOT NULL,
  lap_time_ms INTEGER NOT NULL,
  sector_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, lap_number)
);

CREATE INDEX idx_laps_session ON laps(session_id);
CREATE INDEX idx_laps_time ON laps(lap_time_ms);

COMMENT ON TABLE laps IS 'Individual laps within a session';

-- Coaching Notes table
CREATE TABLE coaching_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_session ON coaching_notes(session_id);
CREATE INDEX idx_notes_created ON coaching_notes(created_at DESC);

COMMENT ON TABLE coaching_notes IS 'Coaching notes for sessions';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert sample tracks
INSERT INTO tracks (id, name, location, length_meters, config) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Laguna Seca', 'Monterey, CA', 3602, 'Full'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Thunderhill', 'Willows, CA', 4830, '5-Mile'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Buttonwillow', 'Buttonwillow, CA', 2016, 'Configuration #13'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Sonoma Raceway', 'Sonoma, CA', 4023, 'Full'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Streets of Willow', 'Rosamond, CA', 2414, 'Full');

-- Insert demo driver
INSERT INTO drivers (id, name, email) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'Demo Driver', 'demo@trackapp.dev');

-- Insert sample session
INSERT INTO sessions (id, driver_id, track_id, date, total_time_ms, best_lap_ms, source) VALUES
  ('750e8400-e29b-41d4-a716-446655440001',
   '650e8400-e29b-41d4-a716-446655440001',
   '550e8400-e29b-41d4-a716-446655440001',
   NOW() - INTERVAL '2 days',
   1200000,
   91800,
   'simulated');

-- Insert sample laps for the session
INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 1, 95000),
  ('750e8400-e29b-41d4-a716-446655440001', 2, 92500),
  ('750e8400-e29b-41d4-a716-446655440001', 3, 93200),
  ('750e8400-e29b-41d4-a716-446655440001', 4, 94100),
  ('750e8400-e29b-41d4-a716-446655440001', 5, 91800);

-- Insert sample coaching note
INSERT INTO coaching_notes (session_id, author, body) VALUES
  ('750e8400-e29b-41d4-a716-446655440001',
   'Coach Mike',
   'Great improvement on lap 5! Focus on carrying more speed through turn 6. Consider a later braking point into the corkscrew.');

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- For MVP, we'll keep RLS disabled or permissive
-- In production, you'd want proper auth-based policies

-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_notes ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for MVP (allow all operations)
-- In production, replace with auth-based policies

CREATE POLICY "Allow all operations on drivers" ON drivers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tracks" ON tracks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on laps" ON laps
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on coaching_notes" ON coaching_notes
  FOR ALL USING (true) WITH CHECK (true);
