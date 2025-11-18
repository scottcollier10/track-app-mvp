import { NextResponse } from 'next/server';
import { listDocuments, getChunkCount } from '@/lib/rag/retrieval';

export async function GET() {
  try {
    // List all documents for Track App
    const documents = await listDocuments({
      tenantId: 'track-app',
      appId: 'track-app-mvp',
      limit: 50,
    });

    // Get chunk counts for each document
    const documentsWithStats = await Promise.all(
      documents.map(async (doc) => {
        const chunkCount = await getChunkCount(doc.id);
        return {
          id: doc.id,
          title: doc.title,
          sourceId: doc.sourceId,
          contentType: doc.contentType,
          chunkCount,
          metadata: doc.metadata,
          createdAt: doc.createdAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: `Found ${documents.length} document(s)`,
      count: documents.length,
      documents: documentsWithStats,
    });
  } catch (error: any) {
    console.error('RAG list test error:', error);
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
