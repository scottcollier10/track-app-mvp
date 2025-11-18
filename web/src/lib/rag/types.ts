/**
 * RAG System Type Definitions
 *
 * Universal types for Retrieval-Augmented Generation across all apps:
 * - Track App: docs, coaching notes, FAQs
 * - Content Ops Copilot: brief examples, style guides
 * - JobBot: resume examples, playbooks
 */

/**
 * Content types supported by RAG system
 */
export type ContentType = 'text' | 'markdown' | 'pdf' | 'url';

/**
 * Application identifiers for multi-tenant RAG
 */
export type AppId = 'track-app' | 'copilot' | 'jobbot' | string;

/**
 * RAG Document - represents a source document/file
 */
export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  document_type: string;
  metadata: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  driver_id?: string;
  track_id?: string;
  session_id?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility
export type RagDocument = RAGDocument;

/**
 * Database representation of RAG Document (snake_case)
 */
export interface RAGDocumentRow {
  id: string;
  title: string;
  content: string;
  document_type: string;
  metadata: Record<string, any>;
  status: string;
  driver_id?: string;
  track_id?: string;
  session_id?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * RAG Chunk - text segment with embedding
 */
export interface RAGChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  token_count: number;
  metadata: Record<string, any>;
  created_at: string;
}

// Alias for backward compatibility
export type RagChunk = RAGChunk;

/**
 * Database representation of RAG Chunk (snake_case)
 */
export interface RAGChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  token_count: number;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Options for RAG query/search
 */
export interface RAGQueryOptions {
  tenantId: string;
  appId: string;
  query: string;
  queryEmbedding?: number[]; // Pre-computed embedding (optional, will compute if not provided)
  topK?: number; // Number of results to return (default: 10)
  threshold?: number; // Minimum similarity threshold (default: 0.7)
  filters?: {
    sourceIds?: string[]; // Filter by specific source documents
    tags?: string[]; // Filter by metadata tags
    contentType?: ContentType; // Filter by content type
    [key: string]: any; // Additional custom filters
  };
}

/**
 * Result from RAG similarity search
 */
export interface RAGSearchResult {
  chunk: RAGChunk;
  document: RAGDocument;
  similarity: number;
}

// Alias for backward compatibility
export type SearchResult = RAGSearchResult;

/**
 * Options for search operations
 */
export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  document_type?: string;
  driver_id?: string;
  track_id?: string;
}

/**
 * Raw result from Supabase RPC search function
 */
export interface RAGSearchResultRow {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
  document_title: string;
  document_source_id: string;
  document_metadata: Record<string, any>;
  chunk_metadata: Record<string, any>;
}

/**
 * Options for chunking text
 */
export interface ChunkingOptions {
  chunkSize?: number; // Characters per chunk (default: 500)
  overlap?: number; // Character overlap between chunks (default: 50)
  separator?: string; // Separator to use (default: '\n\n')
  preserveParagraphs?: boolean; // Try to keep paragraphs intact (default: true)
}

/**
 * Document creation input
 */
export interface CreateDocumentInput {
  title: string;
  content: string;
  document_type: string;
  metadata?: Record<string, any>;
  driver_id?: string;
  track_id?: string;
  session_id?: string;
}

/**
 * Chunk creation input
 */
export interface CreateChunkInput {
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  token_count: number;
  metadata?: Record<string, any>;
}

/**
 * Batch chunk creation result
 */
export interface CreateChunksResult {
  chunks: RAGChunk[];
  documentId: string;
  totalChunks: number;
}

/**
 * Document ingestion result
 */
export interface IngestionResult {
  document: RAGDocument;
  chunks: RAGChunk[];
  success: boolean;
  error?: string;
}

/**
 * Embedding provider interface (for future extensibility)
 */
export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * RAG context for injection into prompts
 */
export interface RAGContext {
  query: string;
  results: RAGSearchResult[];
  formattedContext: string; // Pre-formatted context for prompt injection
}

/**
 * Helper to convert database row to RAGDocument
 */
export function rowToDocument(row: RAGDocumentRow): RAGDocument {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    document_type: row.document_type,
    metadata: row.metadata,
    status: row.status as RAGDocument['status'],
    driver_id: row.driver_id,
    track_id: row.track_id,
    session_id: row.session_id,
    chunk_count: row.chunk_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Helper to convert database row to RAGChunk
 */
export function rowToChunk(row: RAGChunkRow): RAGChunk {
  return {
    id: row.id,
    document_id: row.document_id,
    chunk_index: row.chunk_index,
    content: row.content,
    embedding: row.embedding,
    token_count: row.token_count,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

/**
 * Helper to convert RAGSearchResult to formatted context string
 */
export function formatSearchResultsForContext(results: RAGSearchResult[]): string {
  return results
    .map((result, index) => {
      const { chunk, document, similarity } = result;
      return `[Source ${index + 1}] ${document.title} (Relevance: ${(similarity * 100).toFixed(1)}%)
${chunk.content}`;
    })
    .join('\n\n---\n\n');
}
