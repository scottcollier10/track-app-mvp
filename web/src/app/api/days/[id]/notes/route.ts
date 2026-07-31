/**
 * Track Day Notes API Route
 *
 * PATCH /api/days/[id]/notes
 * Updates the free-form notes on a track day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import type { TablesUpdate } from '@/lib/types/database';

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

    const { notes } = await request.json();

    // notes must be a string or explicit null (null clears the notes)
    if (notes !== null && typeof notes !== 'string') {
      return NextResponse.json(
        { error: 'Notes must be a string or null' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Verify track day exists (RLS scopes this to the current coach)
    const { data: trackDay } = await supabase
      .from('track_days')
      .select('id')
      .eq('id', params.id)
      .single();

    if (!trackDay) {
      return NextResponse.json(
        { error: 'Track day not found' },
        { status: 404 }
      );
    }

    // One stored encoding of "no notes": empty/whitespace-only becomes null
    // (same rule as the context route's null normalization). Non-empty notes
    // are stored as sent -- coaches own their formatting.
    const updateData: TablesUpdate<'track_days'> = {
      notes: notes === null || notes.trim() === '' ? null : notes,
    };

    const { data: updated, error } = await supabase
      .from('track_days')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error updating track day notes:', error);
      return NextResponse.json(
        { error: 'Failed to update track day notes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      trackDay: updated,
      message: 'Track day notes updated successfully',
    });
  } catch (error) {
    console.error('Update track day notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
