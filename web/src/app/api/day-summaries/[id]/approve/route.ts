/**
 * Day Summary Approval API Route
 *
 * POST /api/day-summaries/[id]/approve
 * Marks one summary generation as the day's approved summary.
 *
 * No payload: approval publishes whatever text the row already holds. Carrying
 * text here would race the debounced edit PATCH and could approve wording the
 * coach had already replaced.
 *
 * Superseding the previously approved row is the DB's job (the draft->approved
 * branch of the write matrix does it in the same statement), which is what
 * makes "one approved summary per day" an index guarantee rather than route
 * discipline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { SUMMARY_REPLACED, isReplacedWriteError } from '@/data/day-summaries';
import type { TablesUpdate } from '@/lib/types/database';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabase();

    const updateData: TablesUpdate<'day_summaries'> = {
      status: 'approved',
      approved_by: coach.id,
      // Looks redundant and is not: the trigger reassigns this to now() (so the
      // "edited after approval" chip is not born lit by a route clock running a
      // round trip early), but the CHECK constraint
      // day_summaries_approved_has_approver is evaluated on the finished row and
      // the write matrix refuses a draft->approved transition with a null
      // approved_at. Sending null, or omitting the field, raises. It must be a
      // non-null timestamp; its VALUE is the database's to decide.
      approved_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('day_summaries')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) {
      // Approving a row that a regenerate already superseded, or one already
      // approved: the coach is looking at a stale page.
      if (isReplacedWriteError(error)) {
        return NextResponse.json(SUMMARY_REPLACED, { status: 409 });
      }
      console.error('[Day Summary] Failed to approve summary', {
        summaryId: params.id,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json({ error: 'Failed to approve day summary' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Day summary not found' }, { status: 404 });
    }

    return NextResponse.json({ summary: updated });
  } catch (error) {
    console.error('[Day Summary] Approve error', {
      summaryId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
