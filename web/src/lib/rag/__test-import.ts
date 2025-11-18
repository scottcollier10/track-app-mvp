/**
 * Test import to verify TypeScript compilation
 * This file can be deleted - it's just for verification
 */

import {
  // Types
  RAGDocument,
  RAGChunk,
  RAGQueryOptions,
  RAGSearchResult,
  ContentType,
  AppId,

  // Retrieval
  searchChunks,
  getDocument,
  buildRAGContext,

  // Ingestion
  chunkText,
  createDocument,
  ingestDocument,
} from './index';

// Type checks
const doc: RAGDocument = {
  id: 'test',
  tenantId: 'tenant-1',
  appId: 'track-app',
  sourceId: 'source-1',
  title: 'Test Doc',
  contentType: 'text',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const queryOptions: RAGQueryOptions = {
  tenantId: 'tenant-1',
  appId: 'track-app',
  query: 'test query',
  queryEmbedding: new Array(1536).fill(0),
  topK: 5,
};

// Export to avoid unused variable errors
export { doc, queryOptions };
