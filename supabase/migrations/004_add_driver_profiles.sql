-- 004_add_driver_profiles.sql
-- Driver profiles for AI coaching context

-- Create driver profiles table
CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  total_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- Index for fast lookups
CREATE INDEX idx_driver_profiles_driver_id ON driver_profiles(driver_id);

-- Comment
COMMENT ON TABLE driver_profiles IS 'Extended driver information for AI coaching personalization';
