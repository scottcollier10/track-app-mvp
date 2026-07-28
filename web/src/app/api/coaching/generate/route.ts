/**
 * AI Coaching Generation API Route
 *
 * POST /api/coaching/generate
 * Generates AI coaching feedback using Anthropic Claude API
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { getSessionInsightsFromMs, MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { wrapLLMCall } from '@/lib/llm-telemetry';

const COACHING_MODEL = 'claude-sonnet-4-6';

/**
 * Format milliseconds to readable lap time (MM:SS.mmm)
 */
function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * Generate coaching feedback for a session
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      console.error('[AI Coaching] Missing or invalid API key');
      return NextResponse.json(
        {
          success: false,
          error: 'ANTHROPIC_API_KEY not configured. Please add your API key to .env.local',
        },
        { status: 500 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    console.log('[AI Coaching] Started', {
      timestamp: new Date().toISOString(),
      sessionId,
    });

    const supabase = createServerSupabase();

    // 3. Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, tracks(name), drivers(name, email)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[AI Coaching] Session not found', {
        sessionId,
        error: sessionError?.message,
      });
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // 4. Fetch laps
    const { data: laps, error: lapsError } = await supabase
      .from('laps')
      .select('*')
      .eq('session_id', sessionId)
      .order('lap_number', { ascending: true });

    if (lapsError || !laps || laps.length === 0) {
      console.error('[AI Coaching] Laps not found', {
        sessionId,
        error: lapsError?.message,
      });
      return NextResponse.json(
        { success: false, error: 'No laps found for this session' },
        { status: 404 }
      );
    }

    if (laps.length < MIN_LAPS_FOR_INSIGHTS) {
      return NextResponse.json(
        {
          success: false,
          error: `AI coaching requires at least ${MIN_LAPS_FOR_INSIGHTS} laps`,
        },
        { status: 400 }
      );
    }

    // 5. Fetch driver profile
    const { data: profile } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('driver_id', session.driver_id)
      .single();

    // 6. Calculate insights
    const lapTimesMs = laps.map((lap) => lap.lap_time_ms);
    const insights = getSessionInsightsFromMs(lapTimesMs);

    // 7. Format data for prompt
    const driverName = session.drivers?.name || 'Driver';
    const trackName = session.tracks?.name || 'Unknown Track';
    const experienceLevel = profile?.experience_level || 'intermediate';
    const totalSessions = profile?.total_sessions || 0;
    const sessionDate = new Date(session.date).toLocaleDateString();
    const lapCount = laps.length;
    const bestLapTime = session.best_lap_ms ? formatLapTime(session.best_lap_ms) : 'N/A';
    const consistencyText =
      insights.consistencySeconds !== null
        ? `±${insights.consistencySeconds.toFixed(1)}s lap-time spread (std-dev of clean laps; lower is tighter)`
        : 'not enough clean laps to measure';
    const paceTrend = insights.paceTrendLabel;

    // Build lap times table
    const lapTimesTable = laps
      .map((lap) => {
        const lapNum = lap.lap_number;
        const lapTime = formatLapTime(lap.lap_time_ms);
        const isBest = lap.lap_time_ms === session.best_lap_ms;
        return `Lap ${lapNum}: ${lapTime}${isBest ? ' ⭐ (Best)' : ''}`;
      })
      .join('\n');

    // 8. Build prompt
    const prompt = `You are an expert motorsport coach analyzing a track session. Provide balanced feedback that combines data insights with encouraging guidance.

DRIVER PROFILE
Name: ${driverName}
Experience Level: ${experienceLevel}
Total Sessions Completed: ${totalSessions}

SESSION DATA
Track: ${trackName}
Date: ${sessionDate}
Total Laps: ${lapCount}
Best Lap Time: ${bestLapTime}

PERFORMANCE METRICS
- Consistency: ${consistencyText}
- Pace Trend: ${paceTrend}

LAP TIMES
${lapTimesTable}

Provide coaching feedback in exactly 3 sections:

## Strengths
Identify 2-3 specific things the driver did well based on the data. Reference actual numbers and trends.

## Areas for Improvement
Suggest 2-3 specific, actionable improvements. Be constructive and data-backed. Consider their experience level.

## Next Session Goals
Provide 1-2 concrete, measurable targets for their next track day.

Keep tone encouraging but honest. Focus on what the data reveals. Be specific with numbers and lap references.`;

    // 9. Call Anthropic API with telemetry
    const anthropic = new Anthropic({ apiKey });

    console.log('[AI Coaching] Calling Anthropic API', {
      sessionId,
      model: COACHING_MODEL,
    });

    const result = await wrapLLMCall(
      {
        provider: 'anthropic',
        model: COACHING_MODEL,
        prompt: prompt,
        metadata: {
          project: 'track-app',
          feature: 'ai-coaching',
          userId: session.driver_id,
          coachId: coach.id,
          sessionId: sessionId,
        },
      },
      async () => {
        const message = await anthropic.messages.create({
          model: COACHING_MODEL,
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // Extract text from response
        const output = message.content
          .filter((block) => block.type === 'text')
          .map((block) => (block as any).text)
          .join('\n');

        return {
          output: output,
          usage: message.usage,
        };
      }
    );

    const coachingText = result.output;

    if (!coachingText) {
      console.error('[AI Coaching] Empty response from API', { sessionId });
      return NextResponse.json(
        { success: false, error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    // Log telemetry metrics
    console.log('[AI Coaching] LLM Telemetry', {
      sessionId,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cost: `$${result.cost.toFixed(4)}`,
      latencyMs: result.latencyMs,
    });

    // 10. Store in database
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ ai_coaching_summary: coachingText })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[AI Coaching] Failed to save coaching summary', {
        sessionId,
        error: updateError.message,
      });
      // Still return the coaching even if DB update failed
    }

    // Success!
    const duration = Date.now() - startTime;
    console.log('[AI Coaching] Success', {
      sessionId,
      durationMs: duration,
      responseLength: coachingText.length,
    });

    return NextResponse.json(
      {
        success: true,
        coaching: coachingText,
        metrics: {
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          cost: result.cost,
          latencyMs: result.latencyMs,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[AI Coaching] Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });

    // Check if it's an Anthropic API error
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          success: false,
          error: `Anthropic API error: ${error.message}`,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
