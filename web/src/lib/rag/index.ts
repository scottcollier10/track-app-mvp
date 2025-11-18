/**
 * RAG System - Universal Retrieval-Augmented Generation Foundation
 *
 * Export all RAG functionality for easy importing across applications
 */

// Types
export * from './types';

// Ingestion functions that exist
export {
  chunkText,
  createDocument,
  createChunks,
} from './ingestion';

// Retrieval functions - commented out until implemented
// export {
//   searchChunks,
//   getDocument,
//   getDocumentChunks,
//   listDocuments,
//   getDocumentsBySourceIds,
//   deleteDocument,
//   buildRAGContext,
//   getChunkCount,
//   sourceExists,
// } from './retrieval';

// More ingestion functions - commented out until implemented
// export {
//   updateChunkEmbedding,
//   batchUpdateEmbeddings,
//   ingestDocument,
//   deleteDocumentChunks,
//   rechunkDocument,
//   updateDocumentMetadata,
// } from './ingestion';
