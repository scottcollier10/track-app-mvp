-- Migration: Add LLM Logs Table for Telemetry Tracking
-- Description: Creates a table to track LLM API calls, costs, tokens, and performance
-- Date: 2024-11-17

-- Create llm_logs table
CREATE TABLE IF NOT EXISTS llm_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd DECIMAL(10,6),
  latency_ms INTEGER,
  project TEXT,
  feature TEXT,
  user_id TEXT,
  metadata JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_llm_logs_created_at ON llm_logs(created_at DESC);
CREATE INDEX idx_llm_logs_project ON llm_logs(project);
CREATE INDEX idx_llm_logs_feature ON llm_logs(feature);
CREATE INDEX idx_llm_logs_provider_model ON llm_logs(provider, model);

-- Add RLS policies (optional - adjust based on your security needs)
ALTER TABLE llm_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert logs
CREATE POLICY "Service role can insert logs"
  ON llm_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to read logs
CREATE POLICY "Service role can read logs"
  ON llm_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Comment on table
COMMENT ON TABLE llm_logs IS 'Tracks LLM API usage, costs, and performance metrics across all projects';
COMMENT ON COLUMN llm_logs.provider IS 'LLM provider (anthropic, openai, etc.)';
COMMENT ON COLUMN llm_logs.model IS 'Specific model used (e.g., claude-sonnet-4-20250514)';
COMMENT ON COLUMN llm_logs.tokens_in IS 'Input tokens (prompt)';
COMMENT ON COLUMN llm_logs.tokens_out IS 'Output tokens (completion)';
COMMENT ON COLUMN llm_logs.cost_usd IS 'Cost in USD for this call';
COMMENT ON COLUMN llm_logs.latency_ms IS 'Time taken for API call in milliseconds';
COMMENT ON COLUMN llm_logs.project IS 'Project name (e.g., track-app, content-ops-copilot)';
COMMENT ON COLUMN llm_logs.feature IS 'Feature name (e.g., ai-coaching, content-generation)';
COMMENT ON COLUMN llm_logs.user_id IS 'User/driver ID if applicable';
COMMENT ON COLUMN llm_logs.metadata IS 'Additional metadata (session_id, etc.)';
COMMENT ON COLUMN llm_logs.error IS 'Error message if call failed';
