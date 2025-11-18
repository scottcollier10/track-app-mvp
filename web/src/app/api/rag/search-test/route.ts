import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter required' },
        { status: 400 }
      );
    }

    // Simple text search (not vector search yet - that requires embeddings)
    // This proves the data is there and searchable
    const { data: chunks, error } = await (supabase as any)
      .from('rag_chunks')
      .select(`
        id,
        chunk_text,
        chunk_index,
        metadata,
        created_at,
        document:rag_documents(
          id,
          title,
          source_id
        )
      `)
      .eq('tenant_id', 'track-app')
      .eq('app_id', 'track-app-mvp')
      .ilike('chunk_text', `%${query}%`)
      .order('chunk_index')
      .limit(10);

    if (error) {
      throw new Error(`Search error: ${error.message}`);
    }

    const results = chunks.map((chunk: any) => ({
      chunkId: chunk.id,
      documentId: chunk.document?.id,
      documentTitle: chunk.document?.title,
      sourceId: chunk.document?.source_id,
      chunkIndex: chunk.chunk_index,
      matchedText: chunk.chunk_text,
      preview: chunk.chunk_text.substring(0, 200) + '...',
      createdAt: chunk.created_at,
    }));

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} matching chunk(s)`,
      query,
      count: results.length,
      results,
      note: 'This is simple text search. Vector similarity search requires embeddings.',
    });
  } catch (error: any) {
    console.error('RAG search test error:', error);
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
