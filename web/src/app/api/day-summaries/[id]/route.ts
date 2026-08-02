/**
 * Day Summary Edit API Route
 *
 * PATCH /api/day-summaries/[id]
 * Updates the coach-authored text of one summary generation.
 *
 * final_text is the ONLY writable column here. draft_text and the provenance
 * columns are immutable, and the DB enforces that — this route simply never
 * offers them.
 *
 * Tests: src/app/api/days/[id]/summary/__tests__/route.test.ts (all three
 * write-path routes share one file; see its docblock for why).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { SUMMARY_REPLACED, isReplacedWriteError } from '@/lib/day-summaries';
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

    const { finalText } = await request.json();

    // final_text is NOT NULL and a summary of nothing is not a summary. There
    // is no "clear the text" action: regenerating replaces it.
    if (typeof finalText !== 'string' || finalText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Summary text must be a non-empty string' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // NEVER write updated_at: the DB set_updated_at trigger owns it, and the
    // "edited after approval" chip compares it against approved_at — two
    // writers of that column is a chip that lies.
    //
    // Stored UNTRIMMED, unlike the focus-item PATCH: this is multi-line markdown
    // from a debounced autosave textarea, not a one-line focus item, and
    // trimming on every keystroke-triggered save would eat the coach's trailing
    // paragraph break mid-sentence. The guard above only requires that the text
    // is not blank.
    const updateData: TablesUpdate<'day_summaries'> = { final_text: finalText };

    // maybeSingle, not single: a row that RLS hides is a 404, not a query
    // failure. The update itself carries the coach scope (RLS), so no
    // pre-flight existence check is needed.
    const { data: updated, error } = await supabase
      .from('day_summaries')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) {
      // The coach's tab is holding a row that has since been superseded. Their
      // edit is stale, not wrong.
      if (isReplacedWriteError(error)) {
        return NextResponse.json(SUMMARY_REPLACED, { status: 409 });
      }
      console.error('[Day Summary] Failed to update summary text', {
        summaryId: params.id,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json({ error: 'Failed to update day summary' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Day summary not found' }, { status: 404 });
    }

    return NextResponse.json({ summary: updated });
  } catch (error) {
    console.error('[Day Summary] Update error', {
      summaryId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
