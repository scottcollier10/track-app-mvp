/**
 * Day Summary Generation API Route
 *
 * POST /api/days/[id]/summary
 * Generates an AI day summary draft and records the generation.
 *
 * The row this writes is a PROVENANCE record: the context object it prompted
 * with is the object it stores, and the informing ids are derived from that
 * same object. Nothing here re-queries or re-shapes what the model saw, so the
 * draft is reproducible from the row that claims to record it.
 *
 * Regeneration needs no coordination: the BEFORE INSERT trigger supersedes any
 * live draft for the day in the same statement.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { wrapLLMCall } from '@/lib/llm-telemetry';
import { buildDaySummaryContext } from '@/data/day-summaries';
import { AI_MODEL, buildDaySummaryPrompt } from '@/lib/coaching-prompts';
import {
  SUMMARY_REPLACED,
  informingIdsFrom,
  isReplacedWriteError,
} from '@/lib/day-summaries';
import type { Json, TablesInsert } from '@/lib/types/database';

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      console.error('[Day Summary] Missing or invalid API key');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Please add your API key to .env.local' },
        { status: 500 }
      );
    }

    // Null covers both "no such day" and "not this coach's day" — RLS makes
    // them the same read, and telling them apart would leak the difference.
    const ctx = await buildDaySummaryContext(params.id);
    if (!ctx) {
      return NextResponse.json({ error: 'Track day not found' }, { status: 404 });
    }

    const prompt = buildDaySummaryPrompt(ctx);
    const anthropic = new Anthropic({ apiKey });

    const result = await wrapLLMCall(
      {
        provider: 'anthropic',
        model: AI_MODEL,
        prompt,
        metadata: {
          project: 'track-app',
          feature: 'day-summary',
          coachId: coach.id,
          dayId: params.id,
        },
      },
      async () => {
        const message = await anthropic.messages.create({
          model: AI_MODEL,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        // A generation that hit the cap ends mid-sentence, and draft_text is
        // immutable with no DELETE policy — storing it would make a truncated
        // summary permanent. Thrown, not returned: wrapLLMCall records the
        // failure in telemetry and rethrows, so this takes the same no-row path
        // as an API failure.
        if (message.stop_reason === 'max_tokens') {
          throw new Error('day summary truncated at max_tokens');
        }

        const output = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        return { output, usage: message.usage };
      }
    );

    // A generation that produced nothing is not a summary. No row: the day page
    // shows the failure and offers a retry, and the table never holds a draft
    // that says nothing about a day it claims to describe. (wrapLLMCall rethrows
    // an API failure, which the catch below turns into the same 500 — also
    // before any write.)
    if (!result.output) {
      console.error('[Day Summary] Empty response from API', { dayId: params.id });
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    const { sessionIds, assessmentIds } = informingIdsFrom(ctx);

    const supabase = createServerSupabase();

    const insertData: TablesInsert<'day_summaries'> = {
      track_day_id: params.id,
      draft_text: result.output,
      // Seeded with draft_text so "current text" is always final_text with no
      // COALESCE, and the draft/final diff starts at zero.
      final_text: result.output,
      // The cast is the interface-to-Json gap only: DaySummaryContext is a
      // declared interface, and interfaces carry no implicit index signature.
      // The object is plain JSON by construction (see @/lib/day-summaries), and
      // it is stored BY REFERENCE — no clone, no reshape, or it would stop
      // being the object the prompt above was built from.
      prompt_context: ctx as unknown as Json,
      model: AI_MODEL,
      informing_session_ids: sessionIds,
      informing_assessment_ids: assessmentIds,
    };

    const { data: summary, error } = await supabase
      .from('day_summaries')
      .insert(insertData)
      .select()
      .single();

    if (error || !summary) {
      // Another generate for this day landed first and holds the live draft.
      if (isReplacedWriteError(error)) {
        return NextResponse.json(SUMMARY_REPLACED, { status: 409 });
      }
      console.error('[Day Summary] Failed to store draft', {
        dayId: params.id,
        error: error?.message,
        code: error?.code,
      });
      return NextResponse.json({ error: 'Failed to store day summary' }, { status: 500 });
    }

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error) {
    console.error('[Day Summary] Error', {
      dayId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate day summary' }, { status: 500 });
  }
}
