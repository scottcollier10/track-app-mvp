/**
 * Update notes on a session
 *
 * POST /api/sessions/[id]/notes - Update session notes
 * PATCH /api/sessions/[id]/notes - Update coach notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import type { TablesUpdate } from '@/lib/types/database';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Update session notes (the notes column)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const { notes } = await request.json();

  const supabase = createServerClient();
  const { error } = await (supabase
    .from('sessions') as any)
    .update({ notes })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const supabase = createServerClient();

  try {
    // Accept either coach_notes or notes in the body
    const body = await request.json();
    const rawNotes =
      (body.coach_notes ?? body.notes ?? '').toString();
    const coach_notes = rawNotes.trim();

    console.log('[Coach Notes] Update started', {
      sessionId: id,
      notesLength: coach_notes?.length || 0,
    });

    const updateData: TablesUpdate<'sessions'> = {
      coach_notes,
    };

    // Update the session's coach_notes
    const { data, error } = await (supabase
      .from('sessions') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Coach Notes] Update failed', {
        sessionId: id,
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Failed to update notes' },
        { status: 500 }
      );
    }

    console.log('[Coach Notes] Success', {
      sessionId: id,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Coach Notes] Error', {
      sessionId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}