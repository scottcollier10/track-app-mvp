/**
 * API Route: PATCH /api/sessions/[id]/notes
 *
 * Updates coach_notes for a session
 */

import { createServerClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { coach_notes } = await request.json();

    // Update the session's coach_notes
    const { data, error } = await supabase
      .from('sessions')
      .update({ coach_notes })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating coach notes:', error);
      return NextResponse.json(
        { error: 'Failed to update coach notes' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PATCH /api/sessions/[id]/notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
