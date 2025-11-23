-- 008_add_authentication.sql
-- Add Supabase Auth integration and Row Level Security

-- ============================================================================
-- STEP 1: Link drivers table to auth.users
-- ============================================================================

-- Add a note: drivers.id will now match auth.users.id
-- This requires careful migration for existing data

-- For new installations, we'll keep the structure
-- For existing data, you would need to migrate driver records to auth.users first

COMMENT ON TABLE drivers IS 'Driver records linked to auth.users. drivers.id = auth.users.id';

-- ============================================================================
-- STEP 2: Create trigger function to auto-create driver profile on signup
-- ============================================================================

-- Function to create driver profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a driver record with the same ID as the auth user
  INSERT INTO public.drivers (id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW()
  );

  -- Create a driver profile with default values
  INSERT INTO public.driver_profiles (driver_id, experience_level, total_sessions)
  VALUES (NEW.id, 'beginner', 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- DRIVERS POLICIES
-- Users can read their own driver record
CREATE POLICY "Users can read own driver record"
  ON drivers FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own driver record
CREATE POLICY "Users can update own driver record"
  ON drivers FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do anything (for migrations, admin operations)
CREATE POLICY "Service role has full access to drivers"
  ON drivers FOR ALL
  USING (auth.role() = 'service_role');

-- DRIVER PROFILES POLICIES
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON driver_profiles FOR SELECT
  USING (auth.uid() = driver_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON driver_profiles FOR UPDATE
  USING (auth.uid() = driver_id);

-- Service role has full access
CREATE POLICY "Service role has full access to profiles"
  ON driver_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- SESSIONS POLICIES
-- Users can read their own sessions
CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = driver_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = driver_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = driver_id);

-- Service role has full access
CREATE POLICY "Service role has full access to sessions"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role');

-- LAPS POLICIES
-- Users can read laps for their own sessions
CREATE POLICY "Users can read own session laps"
  ON laps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = laps.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Users can insert laps for their own sessions
CREATE POLICY "Users can insert own session laps"
  ON laps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = laps.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Users can update laps for their own sessions
CREATE POLICY "Users can update own session laps"
  ON laps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = laps.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Users can delete laps for their own sessions
CREATE POLICY "Users can delete own session laps"
  ON laps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = laps.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to laps"
  ON laps FOR ALL
  USING (auth.role() = 'service_role');

-- COACHING NOTES POLICIES
-- Users can read notes for their own sessions
CREATE POLICY "Users can read own session notes"
  ON coaching_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = coaching_notes.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Users can insert notes for their own sessions
CREATE POLICY "Users can insert own session notes"
  ON coaching_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = coaching_notes.session_id
      AND sessions.driver_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to coaching notes"
  ON coaching_notes FOR ALL
  USING (auth.role() = 'service_role');

-- TRACKS POLICIES
-- Tracks are public - all authenticated users can read
CREATE POLICY "Authenticated users can read tracks"
  ON tracks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can modify tracks
CREATE POLICY "Service role has full access to tracks"
  ON tracks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

-- Grant usage on auth schema to authenticated users
-- This allows RLS policies to use auth.uid()
GRANT USAGE ON SCHEMA auth TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates driver and driver_profile records when a new user signs up via Supabase Auth';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Triggers driver profile creation on user signup';
