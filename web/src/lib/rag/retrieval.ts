/**
 * RAG Retrieval Functions
 *
 * Vector similarity search and document retrieval using Supabase pgvector
 */

import { supabase as supabaseRaw } from '@/lib/supabase/client';
const supabase = supabaseRaw as any;
import {
  RAGDocument,
  RAGChunk,
  RAGQueryOptions,
  RAGSearchResult,
  RAGSearchResultRow,
  RAGDocumentRow,
  RAGChunkRow,
  rowToDocument,
  rowToChunk,
  RAGContext,
  formatSearchResultsForContext,
} from './types';

/**
 * Search chunks using vector similarity
 *
 * @param options - Query options including query string, filters, and parameters
 * @returns Array of search results with similarity scores
 *
 * @example
 * ```typescript
 * const results = await searchChunks({
 *   tenantId: 'user-123',
 *   appId: 'track-app',
 *   query: 'How to improve lap times?',
 *   topK: 5,
 *   threshold: 0.7
 * });
 * ```
 */
export async function searchChunks(
  options: RAGQueryOptions
): Promise<RAGSearchResult[]> {
  const {
    tenantId,
    appId,
    query,
    queryEmbedding,
    topK = 10,
    threshold = 0.7,
    filters = {},
  } = options;

  // Validate required parameters
  if (!tenantId || !appId) {
    throw new Error('tenantId and appId are required for RAG search');
  }

  // IMPORTANT: queryEmbedding must be provided by the calling application
  // This keeps the RAG system LLM-agnostic
  if (!queryEmbedding) {
    throw new Error(
      'queryEmbedding is required. Please generate embeddings using your preferred provider (OpenAI, Cohere, etc.)'
    );
  }

  // Validate embedding dimension
  if (queryEmbedding.length !== 1536) {
    throw new Error(
      `Invalid embedding dimension: expected 1536, got ${queryEmbedding.length}`
    );
  }

  // Call Supabase RPC function for vector search
  const { data, error } = await supabase.rpc('search_rag_chunks', {
    query_embedding: queryEmbedding,
    query_tenant_id: tenantId,
    query_app_id: appId,
    match_threshold: threshold,
    match_count: topK,
    filter_source_ids: filters.sourceIds || null,
  });

  if (error) {
    throw new Error(`RAG search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform raw results into typed search results
  return data.map((row: RAGSearchResultRow) => ({
    chunk: {
      id: row.chunk_id,
      documentId: row.document_id,
      tenantId,
      appId,
      chunkText: row.chunk_text,
      chunkIndex: row.chunk_index,
      metadata: row.chunk_metadata,
      createdAt: new Date(),
    },
    document: {
      id: row.document_id,
      tenantId,
      appId,
      sourceId: row.document_source_id,
      title: row.document_title,
      contentType: 'text', // Type will be in metadata if needed
      metadata: row.document_metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    similarity: row.similarity,
  }));
}

/**
 * Get a document by ID
 *
 * @param documentId - UUID of the document
 * @returns Document or null if not found
 */
export async function getDocument(
  documentId: string
): Promise<RAGDocument | null> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return rowToDocument(data as RAGDocumentRow);
}

/**
 * Get all chunks for a document
 *
 * @param documentId - UUID of the document
 * @returns Array of chunks ordered by chunk_index
 */
export async function getDocumentChunks(
  documentId: string
): Promise<RAGChunk[]> {
  const { data, error } = await supabase
    .from('rag_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get document chunks: ${error.message}`);
  }

  return (data as RAGChunkRow[]).map(rowToChunk);
}

/**
 * List documents for a tenant/app
 *
 * @param tenantId - Tenant identifier
 * @param appId - Application identifier
 * @param limit - Maximum number of documents to return (default: 100)
 * @returns Array of documents
 */
export async function listDocuments(
  tenantId: string,
  appId: string,
  limit: number = 100
): Promise<RAGDocument[]> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return (data as RAGDocumentRow[]).map(rowToDocument);
}

/**
 * Get documents by source IDs
 *
 * @param sourceIds - Array of source IDs
 * @param tenantId - Tenant identifier
 * @param appId - Application identifier
 * @returns Array of matching documents
 */
export async function getDocumentsBySourceIds(
  sourceIds: string[],
  tenantId: string,
  appId: string
): Promise<RAGDocument[]> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('app_id', appId)
    .in('source_id', sourceIds);

  if (error) {
    throw new Error(`Failed to get documents by source IDs: ${error.message}`);
  }

  return (data as RAGDocumentRow[]).map(rowToDocument);
}

/**
 * Delete a document and all its chunks
 *
 * @param documentId - UUID of the document to delete
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Chunks will be deleted automatically via CASCADE
  const { error } = await supabase
    .from('rag_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Build RAG context from search results
 *
 * @param options - Query options
 * @returns RAG context with formatted text for prompt injection
 *
 * @example
 * ```typescript
 * const context = await buildRAGContext({
 *   tenantId: 'user-123',
 *   appId: 'track-app',
 *   query: 'How to improve lap times?',
 *   queryEmbedding: embeddings,
 *   topK: 3
 * });
 *
 * const prompt = `Answer the question using the following context:
 *
 * ${context.formattedContext}
 *
 * Question: ${context.query}`;
 * ```
 */
export async function buildRAGContext(
  options: RAGQueryOptions
): Promise<RAGContext> {
  const results = await searchChunks(options);

  return {
    query: options.query,
    results,
    formattedContext: formatSearchResultsForContext(results),
  };
}

/**
 * Get chunk count for a document
 *
 * @param documentId - UUID of the document
 * @returns Number of chunks
 */
export async function getChunkCount(documentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to get chunk count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Check if a source already exists
 *
 * @param sourceId - Source identifier
 * @param tenantId - Tenant identifier
 * @param appId - Application identifier
 * @returns True if source exists
 */
export async function sourceExists(
  sourceId: string,
  tenantId: string,
  appId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('rag_documents')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId)
    .eq('tenant_id', tenantId)
    .eq('app_id', appId);

  if (error) {
    throw new Error(`Failed to check source existence: ${error.message}`);
  }

  return (count || 0) > 0;
}
