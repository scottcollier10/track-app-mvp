-- Add notes column to sessions table
ALTER TABLE sessions
ADD COLUMN notes TEXT;

-- Add index for faster queries
CREATE INDEX idx_sessions_notes ON sessions(id) WHERE notes IS NOT NULL;
