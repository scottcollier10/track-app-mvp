/**
 * Update inline coach notes on a session
 *
 * PATCH /api/sessions/[id]/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase/server';
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
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    // Verify session exists and belongs to user
    const { data: session } = await (supabase
      .from('sessions') as any)
      .select('id, driver_id')
      .eq('id', params.id)
      .single();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify user owns the session
    if (session.driver_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - you can only update notes on your own sessions' },
        { status: 403 }
      );
    }

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