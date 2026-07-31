/**
 * Focus Item Update API Route
 *
 * PATCH /api/focus-items/[id]
 * Updates a focus item's status and/or text. Status transitions carry no
 * session anchor and create no assessment row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import type { TablesUpdate } from '@/lib/types/database';
import type { FocusItemStatus } from '@/lib/types';

const VALID_STATUSES: FocusItemStatus[] = [
  'active',
  'achieved',
  'paused',
  'dropped',
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

    const { status, text } = await request.json();

    // At least one field must be present
    if (status === undefined && text === undefined) {
      return NextResponse.json(
        { error: 'Provide at least one of: status, text' },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      !VALID_STATUSES.includes(status as FocusItemStatus)
    ) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (
      text !== undefined &&
      (typeof text !== 'string' || text.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: 'Focus item text must be a non-empty string' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Verify focus item exists (RLS scopes this to the current coach)
    const { data: focusItem } = await supabase
      .from('focus_items')
      .select('id')
      .eq('id', params.id)
      .single();

    if (!focusItem) {
      return NextResponse.json(
        { error: 'Focus item not found' },
        { status: 404 }
      );
    }

    // NEVER write updated_at here: the DB set_updated_at trigger owns that
    // column. A route writing it too means two writers of one field, and a
    // skewed client clock could make updated_at < created_at, breaking the
    // corrected-cell claim the DB guarantees.
    const updateData: TablesUpdate<'focus_items'> = {};
    if (status !== undefined) {
      updateData.status = status;
    }
    if (text !== undefined) {
      updateData.text = text.trim();
    }

    const { data: updated, error } = await supabase
      .from('focus_items')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error updating focus item:', error);
      return NextResponse.json(
        { error: 'Failed to update focus item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      focusItem: updated,
      message: 'Focus item updated successfully',
    });
  } catch (error) {
    console.error('Update focus item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
