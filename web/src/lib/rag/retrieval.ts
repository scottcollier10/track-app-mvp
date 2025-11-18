/**
 * RAG Document Retrieval
 *
 * Functions for retrieving and searching documents in the RAG system.
 * Handles similarity search using embeddings.
 */

import { supabase } from '../supabase/client';
import {
  RagDocument,
  RagChunk,
  SearchResult,
  SearchOptions,
} from './types';

/**
 * Search for similar chunks using vector similarity
 * Note: This requires the pgvector extension and a similarity search function in Supabase
 */
export async function searchSimilarChunks(
  embedding: number[],
  options: Omit<SearchOptions, 'query'> = {}
): Promise<SearchResult[]> {
  const {
    limit = 5,
    threshold = 0.7,
    document_type,
    driver_id,
    track_id,
  } = options;

  // Build the RPC call for vector similarity search
  // This assumes a function like 'match_chunks' exists in Supabase
  const { data, error } = await (supabase as any).rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_document_type: document_type || null,
    filter_driver_id: driver_id || null,
    filter_track_id: track_id || null,
  });

  if (error) {
    // If the function doesn't exist, fall back to basic retrieval
    if (error.code === '42883') {
      console.warn('match_chunks function not found, falling back to basic retrieval');
      return basicSearch(options);
    }
    throw new Error(`Failed to search chunks: ${error.message}`);
  }

  return (data || []).map((result: any) => ({
    chunk: {
      id: result.id,
      document_id: result.document_id,
      chunk_index: result.chunk_index,
      content: result.content,
      embedding: result.embedding,
      token_count: result.token_count,
      metadata: result.metadata,
      created_at: result.created_at,
    } as RagChunk,
    document: {
      id: result.document_id,
      title: result.document_title || '',
      content: '',
      document_type: result.document_type || 'general',
      metadata: result.document_metadata || {},
      status: result.document_status || 'completed',
      driver_id: result.driver_id,
      track_id: result.track_id,
      session_id: result.session_id,
      chunk_count: result.chunk_count || 0,
      created_at: result.document_created_at || result.created_at,
      updated_at: result.document_updated_at || result.created_at,
    } as RagDocument,
    similarity: result.similarity || 0,
  }));
}

/**
 * Basic text search without embeddings
 * Falls back to this when vector search is not available
 */
export async function basicSearch(
  options: Omit<SearchOptions, 'query'> & { query?: string }
): Promise<SearchResult[]> {
  const {
    query,
    limit = 5,
    document_type,
    driver_id,
    track_id,
  } = options;

  // Get chunks with their documents
  let chunkQuery = (supabase as any)
    .from('rag_chunks')
    .select('*, rag_documents!inner(*)');

  if (query) {
    chunkQuery = chunkQuery.ilike('content', `%${query}%`);
  }

  if (document_type) {
    chunkQuery = chunkQuery.eq('rag_documents.document_type', document_type);
  }

  if (driver_id) {
    chunkQuery = chunkQuery.eq('rag_documents.driver_id', driver_id);
  }

  if (track_id) {
    chunkQuery = chunkQuery.eq('rag_documents.track_id', track_id);
  }

  chunkQuery = chunkQuery
    .limit(limit)
    .order('created_at', { ascending: false });

  const { data, error } = await chunkQuery;

  if (error) {
    throw new Error(`Failed to search: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    chunk: {
      id: row.id,
      document_id: row.document_id,
      chunk_index: row.chunk_index,
      content: row.content,
      embedding: row.embedding,
      token_count: row.token_count,
      metadata: row.metadata,
      created_at: row.created_at,
    } as RagChunk,
    document: row.rag_documents as RagDocument,
    similarity: query ? calculateTextSimilarity(query, row.content) : 1,
  }));
}

/**
 * Calculate simple text similarity (Jaccard index)
 */
function calculateTextSimilarity(query: string, text: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const textWords = new Set(text.toLowerCase().split(/\s+/));

  const queryArray = Array.from(queryWords);
  const textArray = Array.from(textWords);

  const intersection = queryArray.filter(x => textWords.has(x));
  const union = new Set(queryArray.concat(textArray));

  return intersection.length / union.size;
}

/**
 * Get relevant context for a query
 * Returns formatted context string for use in prompts
 */
export async function getRelevantContext(
  options: SearchOptions
): Promise<string> {
  // For now, use basic search
  // When embeddings are implemented, this will use searchSimilarChunks
  const results = await basicSearch({
    ...options,
    query: options.query,
  });

  if (results.length === 0) {
    return '';
  }

  // Format results as context
  const contextParts = results.map((result, index) => {
    const { chunk, document } = result;
    return `[Source ${index + 1}: ${document.title}]\n${chunk.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

/**
 * Get document by ID with its chunks
 */
export async function getDocumentWithChunks(
  documentId: string
): Promise<{ document: RagDocument; chunks: RagChunk[] } | null> {
  // Get document
  const { data: document, error: docError } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (docError) {
    if (docError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get document: ${docError.message}`);
  }

  // Get chunks
  const { data: chunks, error: chunksError } = await (supabase as any)
    .from('rag_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to get chunks: ${chunksError.message}`);
  }

  return {
    document: document as RagDocument,
    chunks: (chunks || []) as RagChunk[],
  };
}

/**
 * Get all chunks for multiple documents
 */
export async function getChunksForDocuments(
  documentIds: string[]
): Promise<Map<string, RagChunk[]>> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const { data, error } = await (supabase as any)
    .from('rag_chunks')
    .select('*')
    .in('document_id', documentIds)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  // Group chunks by document ID
  const chunkMap = new Map<string, RagChunk[]>();

  for (const chunk of data || []) {
    const typedChunk = chunk as RagChunk;
    const existing = chunkMap.get(typedChunk.document_id) || [];
    existing.push(typedChunk);
    chunkMap.set(typedChunk.document_id, existing);
  }

  return chunkMap;
}

/**
 * Search documents by metadata
 */
export async function searchByMetadata(
  metadataKey: string,
  metadataValue: unknown,
  limit = 10
): Promise<RagDocument[]> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .contains('metadata', { [metadataKey]: metadataValue })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search by metadata: ${error.message}`);
  }

  return (data || []) as RagDocument[];
}

/**
 * Get documents by session ID
 */
export async function getDocumentsBySession(
  sessionId: string
): Promise<RagDocument[]> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get documents by session: ${error.message}`);
  }

  return (data || []) as RagDocument[];
}

/**
 * Get documents by driver ID
 */
export async function getDocumentsByDriver(
  driverId: string,
  limit = 50
): Promise<RagDocument[]> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get documents by driver: ${error.message}`);
  }

  return (data || []) as RagDocument[];
}

/**
 * Get documents by track ID
 */
export async function getDocumentsByTrack(
  trackId: string,
  limit = 50
): Promise<RagDocument[]> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('track_id', trackId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get documents by track: ${error.message}`);
  }

  return (data || []) as RagDocument[];
}
