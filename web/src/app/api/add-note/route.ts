/**
 * Add Note API Route
 *
 * POST /api/add-note
 * Adds a coaching note to a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const { sessionId, author, body } = await request.json();

    // Validate payload
    if (!sessionId || !author || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify session exists and belongs to user
    const { data: session } = await (supabase
      .from('sessions') as any)
      .select('id, driver_id')
      .eq('id', sessionId)
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
        { error: 'Forbidden - you can only add notes to your own sessions' },
        { status: 403 }
      );
    }

    // Create note
    const { data: note, error } = await (supabase
      .from('coaching_notes') as any)
      .insert({
        session_id: sessionId,
        author,
        body,
      })
      .select()
      .single();

    if (error || !note) {
      console.error('Error creating note:', error);
      return NextResponse.json(
        { error: 'Failed to create note' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        noteId: note.id,
        message: 'Note added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add note error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
