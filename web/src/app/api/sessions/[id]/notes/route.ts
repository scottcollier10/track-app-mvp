/**
 * API Route: PATCH /api/sessions/[id]/notes
 *
 * Updates coach_notes for a session
 */

import { createServerClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';
import type { TablesUpdate } from '@/lib/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { coach_notes } = await request.json();

    console.log('[Coach Notes] Update started', {
      sessionId: params.id,
      notesLength: coach_notes?.length || 0,
    });

    const updateData: TablesUpdate<'sessions'> = {
      coach_notes,
    };

    // Update the session's coach_notes
    const { data, error } = await (supabase
      .from('sessions') as any)
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[Coach Notes] Update failed', {
        sessionId: params.id,
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Failed to update coach notes' },
        { status: 500 }
      );
    }

    console.log('[Coach Notes] Success', {
      sessionId: params.id,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Coach Notes] Error', {
      sessionId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
