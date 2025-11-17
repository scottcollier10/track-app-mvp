/**
 * RAG Ingestion Utilities
 *
 * Functions for processing and storing documents in the RAG system
 */

import { supabase } from '../supabase/client';
import {
  RAGDocument,
  RAGChunk,
  CreateDocumentInput,
  CreateChunkInput,
  CreateChunksResult,
  ChunkingOptions,
  IngestionResult,
  RAGDocumentRow,
  RAGChunkRow,
  rowToDocument,
  rowToChunk,
} from './types';

/**
 * Chunk text into segments with overlap
 *
 * @param text - Text to chunk
 * @param options - Chunking configuration
 * @returns Array of text chunks
 *
 * @example
 * ```typescript
 * const chunks = chunkText(documentText, {
 *   chunkSize: 500,
 *   overlap: 50,
 *   preserveParagraphs: true
 * });
 * ```
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    chunkSize = 500,
    overlap = 50,
    separator = '\n\n',
    preserveParagraphs = true,
  } = options;

  // Validate inputs
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('overlap must be between 0 and chunkSize');
  }

  // Clean text
  const cleanedText = text.trim();
  if (!cleanedText) {
    return [];
  }

  const chunks: string[] = [];

  if (preserveParagraphs) {
    // Split by paragraphs first
    const paragraphs = cleanedText.split(separator).filter((p) => p.trim());
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      // If paragraph alone exceeds chunk size, split it
      if (trimmedParagraph.length > chunkSize) {
        // Save current chunk if it exists
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // Split large paragraph into smaller chunks
        const subChunks = splitBySize(trimmedParagraph, chunkSize, overlap);
        chunks.push(...subChunks);
      }
      // If adding paragraph would exceed chunk size, start new chunk
      else if (currentChunk.length + trimmedParagraph.length > chunkSize) {
        chunks.push(currentChunk.trim());
        // Start new chunk with overlap from previous
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + trimmedParagraph;
      }
      // Add to current chunk
      else {
        currentChunk +=
          (currentChunk ? separator : '') + trimmedParagraph;
      }
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
  } else {
    // Simple size-based chunking without paragraph preservation
    const splitChunks = splitBySize(cleanedText, chunkSize, overlap);
    chunks.push(...splitChunks);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Split text by size with overlap
 */
function splitBySize(
  text: string,
  size: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + size;
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start = end - overlap;
  }

  return chunks;
}

/**
 * Get overlap text from end of chunk
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (overlapSize === 0 || text.length === 0) return '';
  const overlap = text.slice(-overlapSize);
  return overlap + '\n\n';
}

/**
 * Create a document record
 *
 * @param input - Document creation input
 * @returns Created document
 *
 * @example
 * ```typescript
 * const doc = await createDocument({
 *   tenantId: 'user-123',
 *   appId: 'track-app',
 *   sourceId: 'doc-456',
 *   title: 'Track Guide',
 *   contentType: 'markdown',
 *   storageLocation: 's3://bucket/track-guide.md',
 *   metadata: { tags: ['guide', 'racing'] }
 * });
 * ```
 */
export async function createDocument(
  input: CreateDocumentInput
): Promise<RAGDocument> {
  const { data, error } = await supabase
  .from('rag_documents')
  .insert([{
      tenant_id: input.tenantId,
      app_id: input.appId,
      source_id: input.sourceId,
      title: input.title,
      content_type: input.contentType,
      storage_location: input.storageLocation,
      metadata: input.metadata || {},
    }])  // Close array brackets
  .select()
  .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return rowToDocument(data as RAGDocumentRow);
}

/**
 * Create chunks for a document
 *
 * @param documentId - UUID of the parent document
 * @param chunks - Array of chunk inputs
 * @returns Result with created chunks
 *
 * @example
 * ```typescript
 * const result = await createChunks(documentId, [
 *   {
 *     chunkText: 'First chunk...',
 *     chunkIndex: 0,
 *     embedding: [0.1, 0.2, ...],
 *     metadata: { tokens: 100 }
 *   },
 *   // ... more chunks
 * ]);
 * ```
 */
export async function createChunks(
  documentId: string,
  chunks: CreateChunkInput[]
): Promise<CreateChunksResult> {
  // Get document to extract tenant_id and app_id
  const { data: docData, error: docError } = await supabase
    .from('rag_documents')
    .select('tenant_id, app_id')
    .eq('id', documentId)
    .single();

  if (docError) {
    throw new Error(`Failed to get document: ${docError.message}`);
  }

  const { tenant_id, app_id } = docData;

  // Prepare chunk rows
  const chunkRows = chunks.map((chunk) => ({
    document_id: documentId,
    tenant_id,
    app_id,
    chunk_text: chunk.chunkText,
    chunk_index: chunk.chunkIndex,
    embedding: chunk.embedding || null,
    metadata: chunk.metadata || {},
  }));

  // Insert chunks in batches (Supabase has limits)
  const BATCH_SIZE = 100;
  const createdChunks: RAGChunk[] = [];

  for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
    const batch = chunkRows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('rag_chunks')
      .insert(batch)
      .select();

    if (error) {
      throw new Error(`Failed to create chunks: ${error.message}`);
    }

    createdChunks.push(...(data as RAGChunkRow[]).map(rowToChunk));
  }

  return {
    chunks: createdChunks,
    documentId,
    totalChunks: createdChunks.length,
  };
}

/**
 * Update chunk embeddings
 *
 * @param chunkId - UUID of the chunk
 * @param embedding - Vector embedding
 */
export async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  // Validate embedding dimension
  if (embedding.length !== 1536) {
    throw new Error(
      `Invalid embedding dimension: expected 1536, got ${embedding.length}`
    );
  }

  const { error } = await supabase
    .from('rag_chunks')
    .update({ embedding })
    .eq('id', chunkId);

  if (error) {
    throw new Error(`Failed to update chunk embedding: ${error.message}`);
  }
}

/**
 * Batch update chunk embeddings
 *
 * @param updates - Array of { chunkId, embedding } objects
 */
export async function batchUpdateEmbeddings(
  updates: Array<{ chunkId: string; embedding: number[] }>
): Promise<void> {
  // Validate all embeddings
  for (const update of updates) {
    if (update.embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension for chunk ${update.chunkId}: expected 1536, got ${update.embedding.length}`
      );
    }
  }

  // Update in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Use Promise.all for parallel updates within batch
    await Promise.all(
      batch.map((update) =>
        supabase
          .from('rag_chunks')
          .update({ embedding: update.embedding })
          .eq('id', update.chunkId)
      )
    );
  }
}

/**
 * Complete ingestion workflow: create document + chunks
 *
 * @param input - Document creation input
 * @param text - Full text content to chunk
 * @param chunkingOptions - Chunking configuration
 * @returns Ingestion result with document and chunks
 *
 * @example
 * ```typescript
 * const result = await ingestDocument(
 *   {
 *     tenantId: 'user-123',
 *     appId: 'track-app',
 *     sourceId: 'doc-456',
 *     title: 'Track Guide',
 *     contentType: 'markdown'
 *   },
 *   documentText,
 *   { chunkSize: 500, overlap: 50 }
 * );
 *
 * // Later: add embeddings per-app
 * for (const chunk of result.chunks) {
 *   const embedding = await generateEmbedding(chunk.chunkText);
 *   await updateChunkEmbedding(chunk.id, embedding);
 * }
 * ```
 */
export async function ingestDocument(
  input: CreateDocumentInput,
  text: string,
  chunkingOptions?: ChunkingOptions
): Promise<IngestionResult> {
  try {
    // 1. Create document
    const document = await createDocument(input);

    // 2. Chunk text
    const textChunks = chunkText(text, chunkingOptions);

    // 3. Create chunk records (without embeddings initially)
    const chunkInputs: CreateChunkInput[] = textChunks.map(
      (chunkText, index) => ({
        chunkText,
        chunkIndex: index,
        metadata: {
          length: chunkText.length,
        },
      })
    );

    const { chunks } = await createChunks(document.id, chunkInputs);

    return {
      document,
      chunks,
      totalChunks: chunks.length,
      success: true,
    };
  } catch (error) {
    return {
      document: null as any,
      chunks: [],
      totalChunks: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete all chunks for a document
 *
 * @param documentId - UUID of the document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('rag_chunks')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to delete document chunks: ${error.message}`);
  }
}

/**
 * Re-chunk and replace chunks for a document
 *
 * @param documentId - UUID of the document
 * @param text - New text content
 * @param chunkingOptions - Chunking configuration
 * @returns Updated chunks
 */
export async function rechunkDocument(
  documentId: string,
  text: string,
  chunkingOptions?: ChunkingOptions
): Promise<RAGChunk[]> {
  // Delete existing chunks
  await deleteDocumentChunks(documentId);

  // Create new chunks
  const textChunks = chunkText(text, chunkingOptions);
  const chunkInputs: CreateChunkInput[] = textChunks.map(
    (chunkText, index) => ({
      chunkText,
      chunkIndex: index,
      metadata: {
        length: chunkText.length,
      },
    })
  );

  const { chunks } = await createChunks(documentId, chunkInputs);
  return chunks;
}

/**
 * Update document metadata
 *
 * @param documentId - UUID of the document
 * @param metadata - New metadata to merge
 */
export async function updateDocumentMetadata(
  documentId: string,
  metadata: Record<string, any>
): Promise<void> {
  // Get current metadata
  const { data: docData, error: fetchError } = await supabase
    .from('rag_documents')
    .select('metadata')
    .eq('id', documentId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to get document: ${fetchError.message}`);
  }

  // Merge metadata
  const updatedMetadata = {
    ...docData.metadata,
    ...metadata,
  };

  // Update document
  const { error } = await supabase
    .from('rag_documents')
    .update({ metadata: updatedMetadata })
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document metadata: ${error.message}`);
  }
}
