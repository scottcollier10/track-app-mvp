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

    const updateData: TablesUpdate<'sessions'> = {
      coach_notes,
    };

    const supabase = createServerClient();
    // TS escape hatch: stop the query builder from becoming `never`
    const db = supabase as any;

    const { data, error } = await db
      .from('sessions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating coach notes:', error);
      return NextResponse.json(
        { error: 'Failed to update notes' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        session: data,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Unhandled error in coach notes route:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}