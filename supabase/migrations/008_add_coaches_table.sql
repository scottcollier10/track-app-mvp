-- 008_add_coaches_table.sql
-- Add coaches table and coach_id to drivers table

-- Create coaches table
CREATE TABLE IF NOT EXISTS coaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaches_email ON coaches(email);

COMMENT ON TABLE coaches IS 'Coaches who manage multiple drivers';

-- Add coach_id column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES coaches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_coach_id ON drivers(coach_id);

-- Enable RLS on coaches table
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for MVP (allow all operations)
-- In production, replace with auth-based policies
DROP POLICY IF EXISTS "Allow all operations on coaches" ON coaches;
CREATE POLICY "Allow all operations on coaches" ON coaches
  FOR ALL USING (true) WITH CHECK (true);

-- Insert demo coach
INSERT INTO coaches (id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Demo Coach', 'coach@trackapp.dev')
ON CONFLICT (id) DO NOTHING;

-- Assign all existing drivers to the demo coach
UPDATE drivers SET coach_id = 'c1111111-1111-1111-1111-111111111111' WHERE coach_id IS NULL;
