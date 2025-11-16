-- 005_add_ai_coaching_column.sql
-- Add AI coaching summary column to sessions table

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ai_coaching_summary TEXT;

COMMENT ON COLUMN sessions.ai_coaching_summary IS 'AI-generated coaching feedback from Anthropic Claude';
