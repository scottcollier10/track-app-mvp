import { NextResponse } from 'next/server';
import { createDocument, chunkText, createChunks } from '@/lib/rag/ingestion';

export async function POST() {
  try {
    // Test document content
    const testContent = `
Track App MVP - AI Coaching System

The Track App is a comprehensive racing analytics platform designed to help drivers improve their performance through AI-powered coaching insights.

Key Features:
- Session tracking and lap time analysis
- AI-generated coaching feedback based on performance patterns
- Consistency scoring and pace trend analysis
- Driver profiles with experience levels and session history
- Track-specific performance analytics

The AI coaching system analyzes multiple factors including:
1. Lap time consistency across sessions
2. Pace improvement trends over time
3. Sector times and cornering performance
4. Late-session fatigue patterns
5. Track-specific challenges and opportunities

Future enhancements include longitudinal tracking, remote coaching workflows, and an AI coach with memory that learns your driving patterns over time.
    `.trim();

    // Step 1: Create document record
    const document = await createDocument({
      tenantId: 'track-app',
      appId: 'track-app-mvp',
      sourceId: 'test-doc-001',
      title: 'Track App MVP Overview',
      contentType: 'text',
      storageLocation: 'inline',
      metadata: {
        category: 'documentation',
        version: '1.0',
        createdBy: 'system-test',
      },
    });

    // Step 2: Chunk the text
    const textChunks = chunkText(testContent, {
      chunkSize: 200,
      chunkOverlap: 50,
    });

    // Step 3: Create chunk records
    const chunkInputs = textChunks.map((chunkText, index) => ({
      documentId: document.id,
      tenantId: 'track-app',
      appId: 'track-app-mvp',
      chunkText,
      chunkIndex: index,
      metadata: {
        paragraph: index,
        length: chunkText.length,
      },
    }));

    const chunks = await createChunks(chunkInputs);

    return NextResponse.json({
      success: true,
      message: 'Test document ingested successfully!',
      document: {
        id: document.id,
        title: document.title,
        sourceId: document.sourceId,
      },
      stats: {
        totalChunks: chunks.length,
        documentLength: testContent.length,
        averageChunkSize: Math.round(
          textChunks.reduce((sum, chunk) => sum + chunk.length, 0) / textChunks.length
        ),
      },
      chunks: chunks.map(c => ({
        id: c.id,
        index: c.chunkIndex,
        preview: c.chunkText.substring(0, 100) + '...',
      })),
    });
  } catch (error: any) {
    console.error('RAG ingest test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
