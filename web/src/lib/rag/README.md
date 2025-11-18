# Universal RAG System

A reusable Retrieval-Augmented Generation (RAG) foundation built on Supabase pgvector for knowledge base capabilities across all projects.

## Overview

This RAG system provides:
- **Multi-tenant architecture**: Isolated data per tenant and application
- **Storage-agnostic design**: References to files, not file storage itself
- **LLM-neutral**: Retrieval only, applications decide which model to use
- **Composable**: Separate ingestion, chunking, embedding, and retrieval

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Applications                     │
│  Track App • Content Ops Copilot • JobBot       │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              RAG System (LLM-Agnostic)          │
│  ┌──────────────┐        ┌──────────────┐      │
│  │  Ingestion   │        │  Retrieval   │      │
│  │  - Chunking  │        │  - Search    │      │
│  │  - Storage   │        │  - Context   │      │
│  └──────────────┘        └──────────────┘      │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│          Supabase pgvector Database             │
│  ┌─────────────────┐  ┌────────────────┐       │
│  │  rag_documents  │  │   rag_chunks   │       │
│  │  (metadata)     │  │  (embeddings)  │       │
│  └─────────────────┘  └────────────────┘       │
└─────────────────────────────────────────────────┘
```

## Database Schema

### `rag_documents`
Stores source document metadata:
- `tenant_id`: Multi-tenant isolation (e.g., user ID, org ID)
- `app_id`: Application identifier (track-app, copilot, jobbot)
- `source_id`: External reference (file ID, URL, etc.)
- `title`: Human-readable title
- `content_type`: text | markdown | pdf | url
- `storage_location`: Path/URL to original file
- `metadata`: JSONB for custom fields (tags, author, etc.)

### `rag_chunks`
Stores text chunks with vector embeddings:
- `document_id`: Reference to parent document
- `chunk_text`: Actual text content
- `chunk_index`: Position in document (0-based)
- `embedding`: Vector embedding (1536 dimensions for OpenAI)
- `metadata`: JSONB for custom fields (token_count, etc.)

## Usage Examples

### 1. Track App: Coaching Notes & FAQs

```typescript
import { ingestDocument, updateChunkEmbedding } from '@/lib/rag/ingestion';
import { searchChunks, buildRAGContext } from '@/lib/rag/retrieval';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// INGESTION: Store coach notes
async function storeCoachNotes(userId: string, sessionId: string, notes: string) {
  // 1. Ingest document (creates chunks without embeddings)
  const result = await ingestDocument(
    {
      tenantId: userId,
      appId: 'track-app',
      sourceId: sessionId,
      title: `Session ${sessionId} Notes`,
      contentType: 'text',
      metadata: {
        sessionId,
        type: 'coach-notes',
        tags: ['coaching', 'feedback']
      }
    },
    notes,
    { chunkSize: 500, overlap: 50 }
  );

  // 2. Generate embeddings for each chunk
  for (const chunk of result.chunks) {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk.chunkText
    });

    await updateChunkEmbedding(chunk.id, embedding.data[0].embedding);
  }

  return result;
}

// RETRIEVAL: Find relevant coaching tips
async function getRelevantCoachingTips(userId: string, query: string) {
  // 1. Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  // 2. Search for relevant chunks
  const results = await searchChunks({
    tenantId: userId,
    appId: 'track-app',
    query,
    queryEmbedding: queryEmbedding.data[0].embedding,
    topK: 5,
    threshold: 0.7,
    filters: {
      tags: ['coaching']
    }
  });

  return results;
}

// CONTEXT BUILDING: Prepare RAG context for LLM
async function generateAICoaching(userId: string, driverId: string, question: string) {
  // 1. Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question
  });

  // 2. Build RAG context
  const context = await buildRAGContext({
    tenantId: userId,
    appId: 'track-app',
    query: question,
    queryEmbedding: queryEmbedding.data[0].embedding,
    topK: 3
  });

  // 3. Use context in prompt
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an AI racing coach. Use the following context from previous coaching sessions to answer the driver's question.

Context:
${context.formattedContext}`
      },
      {
        role: 'user',
        content: question
      }
    ]
  });

  return completion.choices[0].message.content;
}
```

### 2. Content Ops Copilot: Brief Examples & Style Guides

```typescript
// INGESTION: Store style guide
async function storeStyleGuide(orgId: string, guideName: string, content: string) {
  const result = await ingestDocument(
    {
      tenantId: orgId,
      appId: 'copilot',
      sourceId: `style-guide-${guideName}`,
      title: guideName,
      contentType: 'markdown',
      metadata: {
        type: 'style-guide',
        version: '1.0'
      }
    },
    content,
    { chunkSize: 800, overlap: 100, preserveParagraphs: true }
  );

  // Add embeddings (same pattern as Track App)
  // ...

  return result;
}

// RETRIEVAL: Find similar brief examples
async function findSimilarBriefs(orgId: string, briefDescription: string) {
  const queryEmbedding = await generateEmbedding(briefDescription);

  const results = await searchChunks({
    tenantId: orgId,
    appId: 'copilot',
    query: briefDescription,
    queryEmbedding,
    topK: 5,
    filters: {
      tags: ['brief-example']
    }
  });

  return results;
}
```

### 3. JobBot: Resume Examples & Playbooks

```typescript
// INGESTION: Store resume playbook
async function storeResumePlaybook(userId: string, industry: string, content: string) {
  const result = await ingestDocument(
    {
      tenantId: userId,
      appId: 'jobbot',
      sourceId: `playbook-${industry}`,
      title: `${industry} Resume Playbook`,
      contentType: 'text',
      metadata: {
        type: 'playbook',
        industry,
        tags: ['resume', 'best-practices']
      }
    },
    content
  );

  // Add embeddings
  // ...

  return result;
}

// RETRIEVAL: Find relevant resume tips
async function getResumeTips(userId: string, role: string, experience: string) {
  const query = `Resume tips for ${role} with ${experience} experience`;
  const queryEmbedding = await generateEmbedding(query);

  const context = await buildRAGContext({
    tenantId: userId,
    appId: 'jobbot',
    query,
    queryEmbedding,
    topK: 3
  });

  return context;
}
```

## Multi-Tenant Best Practices

### 1. Always Scope by Tenant + App
```typescript
// ✅ Good: Isolated by tenant and app
const results = await searchChunks({
  tenantId: userId,
  appId: 'track-app',
  query: 'coaching tips',
  queryEmbedding
});

// ❌ Bad: Missing tenant isolation
const results = await searchChunks({
  appId: 'track-app',
  query: 'coaching tips',
  queryEmbedding
});
```

### 2. Use Descriptive Source IDs
```typescript
// ✅ Good: Clear, unique identifiers
sourceId: `session-${sessionId}`
sourceId: `doc-${fileId}`
sourceId: `url-${urlHash}`

// ❌ Bad: Generic or ambiguous
sourceId: 'document'
sourceId: '123'
```

### 3. Leverage Metadata for Filtering
```typescript
metadata: {
  type: 'coach-notes',
  sessionId: '12345',
  tags: ['coaching', 'feedback', 'advanced'],
  author: 'coach-smith',
  date: '2025-11-17'
}

// Then filter in queries:
filters: {
  tags: ['coaching', 'advanced']
}
```

## Embedding Model Recommendations

### OpenAI (Recommended)
- **text-embedding-3-small**: 1536 dimensions, $0.02/1M tokens
- **text-embedding-3-large**: 3072 dimensions (requires schema update)
- **text-embedding-ada-002**: 1536 dimensions (legacy)

### Cohere
- **embed-english-v3.0**: Configurable dimensions
- **embed-multilingual-v3.0**: For multi-language support

### Open Source
- **sentence-transformers**: Free, self-hosted
- **Instructor**: High quality, customizable

### Current Default
The system is configured for **1536 dimensions** (OpenAI standard). To support other dimensions:

```sql
-- Add column for different dimension
ALTER TABLE rag_chunks ADD COLUMN embedding_768 vector(768);
CREATE INDEX idx_rag_chunks_embedding_768 ON rag_chunks
  USING ivfflat (embedding_768 vector_cosine_ops);
```

## Chunking Strategies

### Small Chunks (300-500 chars)
**Best for:** FAQs, quick tips, definitions
```typescript
chunkText(content, { chunkSize: 400, overlap: 50 });
```

### Medium Chunks (500-1000 chars)
**Best for:** Coaching notes, article sections, how-tos
```typescript
chunkText(content, { chunkSize: 800, overlap: 100 });
```

### Large Chunks (1000-2000 chars)
**Best for:** Long-form content, detailed guides, case studies
```typescript
chunkText(content, { chunkSize: 1500, overlap: 200 });
```

### Preserve Paragraphs
**Best for:** Markdown, structured content
```typescript
chunkText(content, {
  chunkSize: 800,
  overlap: 100,
  preserveParagraphs: true
});
```

## Performance Optimization

### 1. Vector Index Tuning
The IVFFlat index is optimized for ~10K+ vectors with `lists=100`. Adjust based on scale:

```sql
-- For 1K-10K vectors
CREATE INDEX ... WITH (lists = 10);

-- For 10K-100K vectors
CREATE INDEX ... WITH (lists = 100);

-- For 100K-1M vectors
CREATE INDEX ... WITH (lists = 1000);
```

### 2. Batch Operations
Always use batch functions for bulk operations:

```typescript
// ✅ Good: Batch update
await batchUpdateEmbeddings([
  { chunkId: '...', embedding: [...] },
  { chunkId: '...', embedding: [...] },
  // ...
]);

// ❌ Bad: Individual updates
for (const chunk of chunks) {
  await updateChunkEmbedding(chunk.id, embedding);
}
```

### 3. Similarity Thresholds
Tune threshold based on use case:
- **0.9+**: Very strict, near-exact matches
- **0.7-0.9**: Good balance for most use cases
- **0.5-0.7**: Broader matches, more results
- **< 0.5**: Very loose, may include irrelevant results

## API Reference

### Ingestion
- `ingestDocument()` - Complete workflow: create document + chunks
- `createDocument()` - Create document metadata
- `createChunks()` - Store chunks for a document
- `updateChunkEmbedding()` - Add/update embedding for a chunk
- `batchUpdateEmbeddings()` - Bulk update embeddings
- `chunkText()` - Split text into chunks

### Retrieval
- `searchChunks()` - Vector similarity search
- `buildRAGContext()` - Search + format for prompt injection
- `getDocument()` - Get document by ID
- `getDocumentChunks()` - Get all chunks for a document
- `listDocuments()` - List documents for tenant/app
- `sourceExists()` - Check if source already ingested

## Migration

The database schema is in `supabase/migrations/007_add_rag_system.sql`.

Run migration:
```bash
# Local development
supabase db reset

# Production
supabase db push
```

## Future Enhancements

- [ ] Support for multiple embedding dimensions
- [ ] Hybrid search (vector + keyword)
- [ ] Automatic re-ranking
- [ ] Chunk metadata enrichment
- [ ] Usage analytics
- [ ] Cost tracking per tenant
- [ ] Document versioning
- [ ] Automatic chunk refresh on source update

## Questions?

For implementation questions or issues, please refer to:
- Supabase pgvector docs: https://supabase.com/docs/guides/ai/vector-columns
- OpenAI embeddings guide: https://platform.openai.com/docs/guides/embeddings
