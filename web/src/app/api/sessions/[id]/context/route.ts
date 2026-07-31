/**
 * Session Context API Route
 *
 * PATCH /api/sessions/[id]/context
 * Sets a session's representativeness flag and its qualifying note.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import type { TablesUpdate } from '@/lib/types/database';
import type { Representativeness } from '@/lib/types';

const VALID_VALUES: Representativeness[] = [
  'representative',
  'partial',
  'not_representative',
];

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { representativeness, note } = await request.json();

    // null is valid (clears back to representative); otherwise it must be
    // one of the three known values
    if (
      representativeness !== null &&
      !VALID_VALUES.includes(representativeness as Representativeness)
    ) {
      return NextResponse.json(
        {
          error: `Invalid representativeness. Must be null or one of: ${VALID_VALUES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      return NextResponse.json(
        { error: 'Note must be a string or null' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Verify session exists (RLS scopes this to the current coach)
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', params.id)
      .single();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // A context note only qualifies a non-default flag: when the flag is
    // 'representative' or null (the default state), the note is nulled too.
    const isDefault =
      representativeness === null || representativeness === 'representative';

    const updateData: TablesUpdate<'sessions'> = {
      representativeness,
      representativeness_note: isDefault ? null : (note ?? null),
    };

    const { data: updated, error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error updating session context:', error);
      return NextResponse.json(
        { error: 'Failed to update session context' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: updated,
      message: 'Session context updated successfully',
    });
  } catch (error) {
    console.error('Update session context error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
