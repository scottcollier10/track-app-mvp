/**
 * RAG System Types
 *
 * Type definitions for the Retrieval-Augmented Generation system.
 * These types represent the rag_documents and rag_chunks tables in the database.
 */

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DocumentType = 'session_notes' | 'coaching_feedback' | 'track_guide' | 'general';

/**
 * RAG Document - represents a document stored for retrieval
 */
export interface RagDocument {
  id: string;
  title: string;
  content: string;
  document_type: DocumentType;
  metadata: Record<string, unknown>;
  status: DocumentStatus;
  driver_id: string | null;
  track_id: string | null;
  session_id: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * RAG Chunk - represents a chunk of a document with embedding
 */
export interface RagChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  token_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Input for creating a new document
 */
export interface CreateDocumentInput {
  title: string;
  content: string;
  document_type: DocumentType;
  metadata?: Record<string, unknown>;
  driver_id?: string | null;
  track_id?: string | null;
  session_id?: string | null;
}

/**
 * Input for creating a new chunk
 */
export interface CreateChunkInput {
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[] | null;
  token_count: number;
  metadata?: Record<string, unknown>;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  chunk: RagChunk;
  document: RagDocument;
  similarity: number;
}

/**
 * Options for document search
 */
export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  document_type?: DocumentType;
  driver_id?: string;
  track_id?: string;
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  document: RagDocument;
  chunks: RagChunk[];
  success: boolean;
  error?: string;
}

/**
 * Chunking options
 */
export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}
