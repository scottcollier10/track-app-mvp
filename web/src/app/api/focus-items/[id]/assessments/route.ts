/**
 * Focus Item Assessment API Route
 *
 * PUT /api/focus-items/[id]/assessments
 * Upserts the assessment cell for (focus item, session). This is both the
 * creation path and the correction path: one write, the cell.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import type { TablesInsert } from '@/lib/types/database';
import type { AssessmentJudgment } from '@/lib/types';

const VALID_JUDGMENTS: AssessmentJudgment[] = [
  'improved',
  'keep_working',
  'no_change',
  'regressed',
];

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, judgment } = body;

    // Validate payload
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    if (!VALID_JUDGMENTS.includes(judgment as AssessmentJudgment)) {
      return NextResponse.json(
        {
          error: `Invalid judgment. Must be one of: ${VALID_JUDGMENTS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const noteProvided = Object.prototype.hasOwnProperty.call(body, 'note');
    if (noteProvided && body.note !== null && typeof body.note !== 'string') {
      return NextResponse.json(
        { error: 'Note must be a string or null' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Cross-driver integrity: RLS only proves both rows belong to this
    // coach -- it does NOT stop assessing driver A's focus item against
    // driver B's session, which would corrupt the coaching story
    // undetectably. So we select BOTH rows and assert they share a driver.
    const { data: focusItem } = await supabase
      .from('focus_items')
      .select('id, driver_id')
      .eq('id', params.id)
      .single();

    if (!focusItem) {
      return NextResponse.json(
        { error: 'Focus item not found' },
        { status: 404 }
      );
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, driver_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.driver_id !== focusItem.driver_id) {
      return NextResponse.json(
        { error: 'Session and focus item belong to different drivers' },
        { status: 400 }
      );
    }

    // The upsert payload's columns are exactly what ON CONFLICT DO UPDATE SET
    // overwrites. So the `note` key is OMITTED entirely when the request body
    // omits it (a judgment-only correction preserves the existing note) and
    // included as null only when the body explicitly sends null (clears it).
    // NEVER include updated_at: the DB set_updated_at trigger owns it, and
    // the upsert's DO UPDATE fires that trigger, so a corrected cell gets
    // updated_at > created_at without this route doing anything.
    const payload: TablesInsert<'focus_item_assessments'> = {
      focus_item_id: params.id,
      session_id: sessionId,
      judgment,
      ...(noteProvided ? { note: body.note } : {}),
    };

    const { data: assessment, error } = await supabase
      .from('focus_item_assessments')
      .upsert(payload, { onConflict: 'focus_item_id,session_id' })
      .select()
      .single();

    if (error || !assessment) {
      console.error('Error upserting assessment:', error);
      return NextResponse.json(
        { error: 'Failed to save assessment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assessment,
      message: 'Assessment saved successfully',
    });
  } catch (error) {
    console.error('Upsert assessment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
