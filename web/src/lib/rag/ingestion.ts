/**
 * RAG Document Ingestion
 *
 * Functions for ingesting documents into the RAG system.
 * Handles document creation, chunking, and embedding generation.
 */

import { supabase } from '../supabase/client';
import {
  CreateDocumentInput,
  CreateChunkInput,
  RAGDocument,
  RAGChunk,
  IngestionResult,
  ChunkingOptions,
} from './types';

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    separator = '\n\n',
  } = options;

  // Split by separator first
  const segments = text.split(separator).filter(s => s.trim());

  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of segments) {
    if (currentChunk.length + segment.length + separator.length <= chunkSize) {
      currentChunk += (currentChunk ? separator : '') + segment;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
/**
 * RAG Document Ingestion
 *
 * Functions for ingesting documents into the RAG system.
 * Handles document creation, chunking, and embedding generation.
 */

import { supabase } from '../supabase/client';
import {
  CreateDocumentInput,
  CreateChunkInput,
  RAGDocument,
  RAGChunk,
  IngestionResult,
  ChunkingOptions,
} from './types';

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    separator = '\n\n',
  } = options;

  // Split by separator first
  const segments = text.split(separator).filter(s => s.trim());

  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of segments) {
    if (currentChunk.length + segment.length + separator.length <= chunkSize) {
      currentChunk += (currentChunk ? separator : '') + segment;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // Handle segments larger than chunk size
      if (segment.length > chunkSize) {
        const words = segment.split(' ');
        currentChunk = '';

        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = word;
          }
        }
      } else {
        currentChunk = segment;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Add overlap between chunks
  if (overlap > 0 && chunks.length > 1) {
    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];

      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.slice(-overlap);
        chunk = overlapText + ' ' + chunk;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }

  return chunks;
}

/**
 * Count tokens in text (simple approximation)
 */
export function countTokens(text: string): number {
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Create a new document in the RAG system
 */
export async function createDocument(
  input: CreateDocumentInput
): Promise<RAGDocument> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .insert({
      title: input.title,
      content: input.content,
      document_type: input.document_type,
      metadata: input.metadata || {},
      driver_id: input.driver_id || null,
      track_id: input.track_id || null,
      session_id: input.session_id || null,
      status: 'pending',
      chunk_count: 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data as RAGDocument;
}

/**
 * Create chunks for a document
 */
export async function createChunks(
  inputs: CreateChunkInput[]
): Promise<RAGChunk[]> {
  if (inputs.length === 0) {
    return [];
  }

  const chunksToInsert = inputs.map(input => ({
    document_id: input.document_id,
    chunk_index: input.chunk_index,
    content: input.content,
    embedding: input.embedding || null,
    token_count: input.token_count,
    metadata: input.metadata || {},
  }));

  const { data, error } = await (supabase as any)
    .from('rag_chunks')
    .insert(chunksToInsert)
    .select();

  if (error) {
    throw new Error(`Failed to create chunks: ${error.message}`);
  }

  return data as RAGChunk[];
}

/**
 * Update document status and chunk count
 */
export async function updateDocumentStatus(
  documentId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  chunkCount?: number
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (chunkCount !== undefined) {
    updateData.chunk_count = chunkCount;
  }

  const { error } = await (supabase as any)
    .from('rag_documents')
    .update(updateData)
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

/**
 * Ingest a document into the RAG system
 * Creates the document, chunks it, and prepares for embedding
 */
export async function ingestDocument(
  input: CreateDocumentInput,
  chunkingOptions?: ChunkingOptions
): Promise<IngestionResult> {
  try {
    // Create the document
    const document = await createDocument(input);

    // Update status to processing
    await updateDocumentStatus(document.id, 'processing');

    // Chunk the content
    const textChunks = chunkText(input.content, chunkingOptions);

    // Create chunk inputs
    const chunkInputs: CreateChunkInput[] = textChunks.map((content, index) => ({
      document_id: document.id,
      chunk_index: index,
      content,
      token_count: countTokens(content),
      metadata: {
        document_title: input.title,
        document_type: input.document_type,
      },
    }));

    // Insert chunks
    const chunks = await createChunks(chunkInputs);

    // Update document status to completed
    await updateDocumentStatus(document.id, 'completed', chunks.length);

    return {
      document: { ...document, status: 'completed', chunk_count: chunks.length },
      chunks,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      document: null as unknown as RAGDocument,
      chunks: [],
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get a document by ID
 */
export async function getDocument(id: string): Promise<RAGDocument | null> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return data as RAGDocument;
}

/**
 * Get chunks for a document
 */
export async function getDocumentChunks(documentId: string): Promise<RAGChunk[]> {
  const { data, error } = await (supabase as any)
    .from('rag_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  return data as RAGChunk[];
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(id: string): Promise<void> {
  // Delete chunks first (foreign key constraint)
  const { error: chunksError } = await (supabase as any)
    .from('rag_chunks')
    .delete()
    .eq('document_id', id);

  if (chunksError) {
    throw new Error(`Failed to delete chunks: ${chunksError.message}`);
  }

  // Delete document
  const { error: docError } = await (supabase as any)
    .from('rag_documents')
    .delete()
    .eq('id', id);

  if (docError) {
    throw new Error(`Failed to delete document: ${docError.message}`);
  }
}

/**
 * List all documents with optional filtering
 */
export async function listDocuments(options?: {
  document_type?: string;
  driver_id?: string;
  track_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<RAGDocument[]> {
  let query = (supabase as any)
    .from('rag_documents')
    .select('*');

  if (options?.document_type) {
    query = query.eq('document_type', options.document_type);
  }

  if (options?.driver_id) {
    query = query.eq('driver_id', options.driver_id);
  }

  if (options?.track_id) {
    query = query.eq('track_id', options.track_id);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return data as RAGDocument[];
}

      // Handle segments larger than chunk size
      if (segment.length > chunkSize) {
        const words = segment.split(' ');
        currentChunk = '';

        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = word;
          }
        }
      } else {
        currentChunk = segment;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Add overlap between chunks
  if (overlap > 0 && chunks.length > 1) {
    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];

      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.slice(-overlap);
        chunk = overlapText + ' ' + chunk;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }

  return chunks;
}

/**
 * Count tokens in text (simple approximation)
 */
export function countTokens(text: string): number {
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Create a new document in the RAG system
 */
export async function createDocument(
  input: CreateDocumentInput
): Promise<RAGDocument> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .insert({
      title: input.title,
      content: input.content,
      document_type: input.document_type,
      metadata: input.metadata || {},
      driver_id: input.driver_id || null,
      track_id: input.track_id || null,
      session_id: input.session_id || null,
      status: 'pending',
      chunk_count: 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data as RAGDocument;
}

/**
 * Create chunks for a document
 */
export async function createChunks(
  inputs: CreateChunkInput[]
): Promise<RAGChunk[]> {
  if (inputs.length === 0) {
    return [];
  }

  const chunksToInsert = inputs.map(input => ({
    document_id: input.document_id,
    chunk_index: input.chunk_index,
    content: input.content,
    embedding: input.embedding || null,
    token_count: input.token_count,
    metadata: input.metadata || {},
  }));

  const { data, error } = await (supabase as any)
    .from('rag_chunks')
    .insert(chunksToInsert)
    .select();

  if (error) {
    throw new Error(`Failed to create chunks: ${error.message}`);
  }

  return data as RAGChunk[];
}

/**
 * Update document status and chunk count
 */
export async function updateDocumentStatus(
  documentId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  chunkCount?: number
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (chunkCount !== undefined) {
    updateData.chunk_count = chunkCount;
  }

  const { error } = await (supabase as any)
    .from('rag_documents')
    .update(updateData)
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

/**
 * Ingest a document into the RAG system
 * Creates the document, chunks it, and prepares for embedding
 */
export async function ingestDocument(
  input: CreateDocumentInput,
  chunkingOptions?: ChunkingOptions
): Promise<IngestionResult> {
  try {
    // Create the document
    const document = await createDocument(input);

    // Update status to processing
    await updateDocumentStatus(document.id, 'processing');

    // Chunk the content
    const textChunks = chunkText(input.content, chunkingOptions);

    // Create chunk inputs
    const chunkInputs: CreateChunkInput[] = textChunks.map((content, index) => ({
      document_id: document.id,
      chunk_index: index,
      content,
      token_count: countTokens(content),
      metadata: {
        document_title: input.title,
        document_type: input.document_type,
      },
    }));

    // Insert chunks
    const chunks = await createChunks(chunkInputs);

    // Update document status to completed
    await updateDocumentStatus(document.id, 'completed', chunks.length);

    return {
      document: { ...document, status: 'completed', chunk_count: chunks.length },
      chunks,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      document: null as unknown as RAGDocument,
      chunks: [],
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get a document by ID
 */
export async function getDocument(id: string): Promise<RAGDocument | null> {
  const { data, error } = await (supabase as any)
    .from('rag_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return data as RAGDocument;
}

/**
 * Get chunks for a document
 */
export async function getDocumentChunks(documentId: string): Promise<RAGChunk[]> {
  const { data, error } = await (supabase as any)
    .from('rag_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  return data as RAGChunk[];
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(id: string): Promise<void> {
  // Delete chunks first (foreign key constraint)
  const { error: chunksError } = await (supabase as any)
    .from('rag_chunks')
    .delete()
    .eq('document_id', id);

  if (chunksError) {
    throw new Error(`Failed to delete chunks: ${chunksError.message}`);
  }

  // Delete document
  const { error: docError } = await (supabase as any)
    .from('rag_documents')
    .delete()
    .eq('id', id);

  if (docError) {
    throw new Error(`Failed to delete document: ${docError.message}`);
  }
}

/**
 * List all documents with optional filtering
 */
export async function listDocuments(options?: {
  document_type?: string;
  driver_id?: string;
  track_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<RAGDocument[]> {
  let query = (supabase as any)
    .from('rag_documents')
    .select('*');

  if (options?.document_type) {
    query = query.eq('document_type', options.document_type);
  }

  if (options?.driver_id) {
    query = query.eq('driver_id', options.driver_id);
  }

  if (options?.track_id) {
    query = query.eq('track_id', options.track_id);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return data as RAGDocument[];
}
