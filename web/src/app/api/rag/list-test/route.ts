import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: documents, error } = await (supabase as any)
      .from('rag_documents')
      .select('*')
      .eq('tenant_id', 'track-app')
      .eq('app_id', 'track-app-mvp')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: documents.length,
      documents: documents.map((d: any) => ({
        id: d.id,
        title: d.title,
        sourceId: d.source_id,
        createdAt: d.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
