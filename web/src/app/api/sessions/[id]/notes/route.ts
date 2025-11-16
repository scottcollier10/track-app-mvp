/**
 * Update inline coach notes on a session
 *
 * PATCH /api/sessions/[id]/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import type { TablesUpdate } from '@/lib/types/database';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Accept either coach_notes or notes in the body
    const body = await request.json();
    const rawNotes =
      (body.coach_notes ?? body.notes ?? '').toString();
    const coach_notes = rawNotes.trim();

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
        { error: 'Failed to update notes' },
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