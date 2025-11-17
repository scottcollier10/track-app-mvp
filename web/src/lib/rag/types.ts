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
  tenantId: string;
  appId: string;
  sourceId: string;
  title: string;
  contentType: ContentType;
  storageLocation?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database representation of RAG Document (snake_case)
 */
export interface RAGDocumentRow {
  id: string;
  tenant_id: string;
  app_id: string;
  source_id: string;
  title: string;
  content_type: string;
  storage_location?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * RAG Chunk - text segment with embedding
 */
export interface RAGChunk {
  id: string;
  documentId: string;
  tenantId: string;
  appId: string;
  chunkText: string;
  chunkIndex: number;
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Database representation of RAG Chunk (snake_case)
 */
export interface RAGChunkRow {
  id: string;
  document_id: string;
  tenant_id: string;
  app_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding?: number[];
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
  tenantId: string;
  appId: string;
  sourceId: string;
  title: string;
  contentType: ContentType;
  storageLocation?: string;
  metadata?: Record<string, any>;
}

/**
 * Chunk creation input
 */
export interface CreateChunkInput {
  chunkText: string;
  chunkIndex: number;
  embedding?: number[];
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
  totalChunks: number;
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
    tenantId: row.tenant_id,
    appId: row.app_id,
    sourceId: row.source_id,
    title: row.title,
    contentType: row.content_type as ContentType,
    storageLocation: row.storage_location,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Helper to convert database row to RAGChunk
 */
export function rowToChunk(row: RAGChunkRow): RAGChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    chunkText: row.chunk_text,
    chunkIndex: row.chunk_index,
    embedding: row.embedding,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
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
${chunk.chunkText}`;
    })
    .join('\n\n---\n\n');
}
