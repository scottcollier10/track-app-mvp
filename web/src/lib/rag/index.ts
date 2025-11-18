/**
 * RAG System - Universal Retrieval-Augmented Generation Foundation
 *
 * Export all RAG functionality for easy importing across applications
 */

// Types
export * from './types';

// Retrieval functions
export {
  // searchChunks,  // TODO: Implement
  // getDocument,
  // getDocumentChunks,
  // listDocuments,
  // getDocumentsBySourceIds,
  // deleteDocument,
  // buildRAGContext,
  // getChunkCount,
  // sourceExists,
} from './retrieval';

// Ingestion functions
export {
  chunkText,
  createDocument,
  createChunks,
  updateChunkEmbedding,
  batchUpdateEmbeddings,
  ingestDocument,
  deleteDocumentChunks,
  rechunkDocument,
  updateDocumentMetadata,
} from './ingestion';
