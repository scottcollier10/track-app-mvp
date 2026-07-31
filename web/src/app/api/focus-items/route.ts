/**
 * Focus Items API Route
 *
 * POST /api/focus-items
 * Creates a focus item for a driver, optionally anchored to the session
 * it emerged from.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';

export async function POST(request: NextRequest) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { driverId, text, createdAfterSessionId } = await request.json();

    // Validate payload
    if (!driverId) {
      return NextResponse.json(
        { error: 'Missing required field: driverId' },
        { status: 400 }
      );
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Focus item text must be a non-empty string' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Verify driver exists (RLS scopes this to the current coach)
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', driverId)
      .single();

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // createdAfterSessionId passes through as given -- absent means honestly
    // null; this route never infers an origin session. But when it IS
    // provided, the session must belong to the same driver: a focus item
    // anchored to another driver's session corrupts the origin story.
    if (createdAfterSessionId !== undefined && createdAfterSessionId !== null) {
      const { data: session } = await supabase
        .from('sessions')
        .select('id, driver_id')
        .eq('id', createdAfterSessionId)
        .single();

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      if (session.driver_id !== driverId) {
        return NextResponse.json(
          { error: 'Session does not belong to this driver' },
          { status: 400 }
        );
      }
    }

    // Create focus item
    const { data: focusItem, error } = await supabase
      .from('focus_items')
      .insert({
        driver_id: driverId,
        text: text.trim(),
        created_after_session_id: createdAfterSessionId ?? null,
      })
      .select()
      .single();

    if (error || !focusItem) {
      console.error('Error creating focus item:', error);
      return NextResponse.json(
        { error: 'Failed to create focus item' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        focusItem,
        message: 'Focus item created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create focus item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
