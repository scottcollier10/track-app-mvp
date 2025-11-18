-- Migration: Add RAG System Foundation
-- Description: Creates tables for universal RAG system with pgvector support
-- Date: 2025-11-17

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (source files/content)
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'markdown', 'pdf', 'url')),
  storage_location TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks table (processed text segments with embeddings)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension (1536), compatible with text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast retrieval
CREATE INDEX idx_rag_documents_tenant_app ON rag_documents(tenant_id, app_id);
CREATE INDEX idx_rag_documents_source ON rag_documents(source_id);
CREATE INDEX idx_rag_documents_created_at ON rag_documents(created_at DESC);
CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_rag_chunks_tenant_app ON rag_chunks(tenant_id, app_id);

-- Vector similarity search index (IVFFlat for performance)
-- Note: IVFFlat requires training data. With lists=100, it's optimized for ~10K+ vectors
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rag_documents
CREATE POLICY "Service role can manage documents"
  ON rag_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for rag_chunks
CREATE POLICY "Service role can manage chunks"
  ON rag_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE rag_documents IS 'Source documents for RAG system across all apps (Track App, Content Ops Copilot, JobBot)';
COMMENT ON TABLE rag_chunks IS 'Text chunks with embeddings for vector similarity search';

COMMENT ON COLUMN rag_documents.tenant_id IS 'Multi-tenant identifier (user_id, org_id, etc.)';
COMMENT ON COLUMN rag_documents.app_id IS 'Application identifier (track-app, copilot, jobbot)';
COMMENT ON COLUMN rag_documents.source_id IS 'External reference ID (file ID, URL, etc.)';
COMMENT ON COLUMN rag_documents.content_type IS 'Type of content: text, markdown, pdf, url';
COMMENT ON COLUMN rag_documents.storage_location IS 'Path or URL to original file (storage-agnostic)';
COMMENT ON COLUMN rag_documents.metadata IS 'Additional metadata (tags, author, date, etc.)';

COMMENT ON COLUMN rag_chunks.document_id IS 'Reference to parent document';
COMMENT ON COLUMN rag_chunks.chunk_text IS 'Text content of this chunk';
COMMENT ON COLUMN rag_chunks.chunk_index IS 'Position of chunk in document (0-based)';
COMMENT ON COLUMN rag_chunks.embedding IS 'Vector embedding (1536 dimensions for OpenAI models)';
COMMENT ON COLUMN rag_chunks.metadata IS 'Additional metadata (token_count, etc.)';

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_rag_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_rag_documents_updated_at
  BEFORE UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_rag_documents_updated_at();

-- Create function for vector similarity search
-- This will be called via Supabase RPC
CREATE OR REPLACE FUNCTION search_rag_chunks(
  query_embedding vector(1536),
  query_tenant_id TEXT,
  query_app_id TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_source_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  chunk_text TEXT,
  chunk_index INT,
  similarity FLOAT,
  document_title TEXT,
  document_source_id TEXT,
  document_metadata JSONB,
  chunk_metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.chunk_text,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.title AS document_title,
    d.source_id AS document_source_id,
    d.metadata AS document_metadata,
    c.metadata AS chunk_metadata
  FROM rag_chunks c
  JOIN rag_documents d ON c.document_id = d.id
  WHERE
    c.tenant_id = query_tenant_id
    AND c.app_id = query_app_id
    AND (filter_source_ids IS NULL OR d.source_id = ANY(filter_source_ids))
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_rag_chunks IS 'Vector similarity search for RAG chunks with tenant/app filtering';
