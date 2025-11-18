import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST() {
  try {
    const testContent = 'Track App MVP - AI Coaching System. The Track App helps drivers improve through AI-powered insights.';

    // Create document directly
    const { data: doc, error: docError } = await (supabase as any)
      .from('rag_documents')
      .insert({
        tenant_id: 'track-app',
        app_id: 'track-app-mvp',
        source_id: 'test-doc-' + Date.now(),
        title: 'Track App Test Document',
        content_type: 'text',
        storage_location: 'inline',
        metadata: { test: true },
      })
      .select()
      .single();

    if (docError) throw docError;

    // Create chunk directly
    const { data: chunk, error: chunkError } = await (supabase as any)
      .from('rag_chunks')
      .insert({
        document_id: doc.id,
        tenant_id: 'track-app',
        app_id: 'track-app-mvp',
        chunk_text: testContent,
        chunk_index: 0,
        metadata: { test: true },
      })
      .select()
      .single();

    if (chunkError) throw chunkError;

    return NextResponse.json({
      success: true,
      message: 'Test document created!',
      document: {
        id: doc.id,
        title: doc.title,
      },
      chunk: {
        id: chunk.id,
        text: chunk.chunk_text,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
