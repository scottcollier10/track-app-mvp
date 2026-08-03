/**
 * AI Session Coaching API Route
 *
 * POST /api/coaching/generate
 * Generates coach-facing OBSERVATIONS about one session and overwrites
 * `sessions.ai_coaching_summary` with them.
 *
 * The output contract is observation-only (design decision 7): the model may
 * summarize coach-directed work and may never author a driving instruction.
 * This route used to ask for prescriptive sections — improvements to make, goals
 * for next time — and that capability is removed here, not relocated. The three
 * sections it asks for now are the prompt builder's, defined once.
 *
 * LOAD-BEARING PAIRING, spelled out in
 * docs/plans/2026-08-01-ai-day-summary-design.md decision 7: session coaching
 * may stay EPHEMERAL — one overwritten column, no approval, no provenance row —
 * only because its output contract now forbids instructions. A future PR that
 * relaxes the contract inherits the storage question with it.
 *
 * Context comes from the SAME builder the day summary uses, with this session
 * marked focal. One definition of the day, two prompts; the no-AI-text input
 * property (an old generation can never be laundered into a new one) holds for
 * both features by construction rather than by care.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { canClaimConsistency, MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { assessedAtSession, focusItemsForSession, validLapTimesMs } from '@/lib/track-days';
import { wrapLLMCall } from '@/lib/llm-telemetry';
import { ANTHROPIC_KEY_MISSING, anthropicApiKey } from '@/lib/anthropic-key';
import { COACHING_ERROR } from '@/lib/coaching-errors';
import { getDaySummaryInputs } from '@/data/day-summaries';
import { AI_MODEL, buildSessionCoachingPrompt } from '@/lib/coaching-prompts';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Check for API key
    const apiKey = anthropicApiKey();
    if (!apiKey) {
      console.error('[AI Coaching] Missing or invalid API key');
      return NextResponse.json(
        { success: false, error: ANTHROPIC_KEY_MISSING, code: COACHING_ERROR.apiKeyMissing },
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

    // 3. Fetch the session. Named columns, not `*`: the track and driver names
    // now come off the day context, and the one column this route must never
    // read back into a prompt is `ai_coaching_summary` — its own last output.
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, date, driver_id, track_day_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[AI Coaching] Session not found', {
        sessionId,
        error: sessionError?.message,
      });
      return NextResponse.json(
        { success: false, error: 'Session not found', code: COACHING_ERROR.notFound },
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
        { success: false, error: 'No laps found for this session', code: COACHING_ERROR.notFound },
        { status: 404 }
      );
    }

    // Countable laps (validLapTimesMs), not raw rows: this route used to gate
    // on laps.length while the σ it reports ran over the positive lap times
    // only — a six-row session with one 0 cleared the gate here and was refused
    // by the session page. The prompt's lap table is filtered by the same
    // definition, inside buildSessionCoachingPrompt.
    if (!canClaimConsistency(validLapTimesMs(laps))) {
      return NextResponse.json(
        {
          success: false,
          error: `AI coaching requires at least ${MIN_LAPS_FOR_INSIGHTS} laps`,
        },
        { status: 400 }
      );
    }

    // 5. The day this session belongs to. Post-P1 every session has one — the
    // column is an FK and the backfill filled it — so a null here is corrupt
    // data, not a supported state, and there is deliberately NO session-only
    // fallback prompt: a second prompt definition that almost never runs is a
    // shadow path that drifts from the output contract precisely because
    // nothing exercises it.
    if (!session.track_day_id) {
      console.error('[AI Coaching] Session has no track day', { sessionId });
      return NextResponse.json(
        { success: false, error: 'Session has no track day — data integrity issue' },
        { status: 500 }
      );
    }

    const inputs = await getDaySummaryInputs(session.track_day_id);
    // A 500, NOT the day-summary route's 404. That route's day id comes from
    // the URL and can be anything, so an empty read there means "no such day,
    // or not yours" and 404 is the honest answer. Here the session row was
    // already read under this coach's RLS, `track_days` chains to the same
    // coach, and `track_day_id` is an FK that cannot dangle — so an empty read
    // is the same class of corruption as the null above. Different condition,
    // different code.
    if (!inputs) {
      console.error('[AI Coaching] Track day missing for session', {
        sessionId,
        trackDayId: session.track_day_id,
      });
      // No `code`, deliberately. The two 404s above carry COACHING_ERROR
      // .notFound and this does not, so the card's "Session or laps not found"
      // branch cannot claim a corruption 500 no matter how its prose reads —
      // the wording is for the coach, not for a caller to match on.
      //
      // "missing", not "not found", for that coach: the 404s are this route's
      // not-found vocabulary, and a state nobody can act on told in the words of
      // one they can retry reads as recoverable. The wording also matches the
      // log line it will be read next to.
      return NextResponse.json(
        { success: false, error: 'Track day missing for this session — data integrity issue' },
        { status: 500 }
      );
    }
    const { ctx, debrief } = inputs;

    // 6. Fetch driver profile. Auxiliary context, not a precondition: a driver
    // with no profile row is an ordinary state and a failed read is survivable,
    // so both prompt WITHOUT it rather than 500ing a generation over it.
    //
    // What neither may do is DEFAULT. The prompt header promises the model that
    // everything below it is recorded session data or something the coach
    // wrote, so "intermediate, 0 sessions completed" for a driver nobody has
    // profiled is a fabricated fact under a promise that there are none — and
    // one the model will reason from, framing a 40-session driver's day as a
    // beginner's. The route hands over what it has, including nothing.
    //
    // maybeSingle, NOT single. `driver_profiles` is an optional extension table
    // (migration 004: UNIQUE(driver_id), nullable columns, no backfill), so a
    // driver with no row is the common case — and `.single()` reports that
    // ordinary state as a PGRST116 error, which would fire the log below on
    // nearly every generation and bury the one case an operator needs to see.
    // With maybeSingle an absent row is just a null row, so `profileError`
    // means the read genuinely failed. Kept inline rather than routed through
    // `@/data/driverProfiles`.getDriverProfile: that helper is correct, but it
    // selects `*`, and this route reads named columns everywhere on purpose so
    // that a column added to a table later cannot arrive in its scope unasked.
    const { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('experience_level, total_sessions')
      .eq('driver_id', session.driver_id)
      .maybeSingle();

    if (profileError) {
      console.error('[AI Coaching] Driver profile unavailable', {
        sessionId,
        driverId: session.driver_id,
        error: profileError.message,
      });
    }

    // 7. Which focus items are evidence for THIS session — through the same
    // function the session page's evidence banner calls, with the focal session
    // as anchor. The rule that an item never evidences against its own origin
    // session (it was the coach's response to that session, not something the
    // session tested) therefore arrives by reuse, never by a copy living here.
    // Both groups count: `reviewed` is what was assessed AT this session,
    // `inPlay` what was carried into it, and an item can be in both.
    const { reviewed, inPlay } = focusItemsForSession({
      items: debrief.focusItems,
      assessedItemIds: assessedAtSession(debrief.focusItems, session.id),
      session: { id: session.id, date: session.date },
      originSessions: new Map(debrief.originSessions.map((origin) => [origin.id, origin])),
      dayDate: debrief.date,
      trackTimezone: debrief.track.timezone,
    });
    const eligibleItemIds = new Set([...reviewed, ...inPlay].map((item) => item.id));

    // 8. Build the prompt. Every number in it is already derived on the context
    // object; the lap ROWS ride along raw because the table needs lap_number
    // labels, and the builder filters them with the app's one lap predicate.
    const prompt = buildSessionCoachingPrompt({
      ctx,
      focalSessionId: session.id,
      eligibleItemIds,
      focalLaps: laps,
      driverProfile: profile
        ? {
            experienceLevel: profile.experience_level,
            totalSessions: profile.total_sessions,
          }
        : null,
    });

    // 9. Call Anthropic API with telemetry
    const anthropic = new Anthropic({ apiKey });

    console.log('[AI Coaching] Calling Anthropic API', {
      sessionId,
      model: AI_MODEL,
    });

    const result = await wrapLLMCall(
      {
        provider: 'anthropic',
        model: AI_MODEL,
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
          model: AI_MODEL,
          // Raised from 1500 with the day-scoped rewrite: the prompt now
          // carries every session of the day, the full assessment history of
          // every eligible item, and the coach notes, so the reply it asks for
          // grew with it. An overflow is not a degraded answer here — the guard
          // below throws on it, so the coach gets a 500 and no row — and
          // retrying a near-deterministic generation overflows again, which
          // makes headroom the only thing that clears it. Matches the sibling
          // day summary route, whose prompt is the same size.
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // A generation that hit the cap ends mid-sentence, and the write below
        // is a DESTRUCTIVE OVERWRITE of the column — storing a truncated
        // generation costs the coach the previous good text, while refusing to
        // write leaves it intact with a retry available. Thrown, not returned:
        // wrapLLMCall records the failure in telemetry and rethrows, so this
        // takes the same no-write path as an API failure. Same cost caveat as
        // the day summary route: throwing skips `usage`, so the llm_logs row
        // lands at zero tokens/cost — read truncation counts, not spend, out of
        // that row.
        if (message.stop_reason === 'max_tokens') {
          throw new Error('session coaching truncated at max_tokens');
        }

        // Extract text from response
        const output = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
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

    // A failed write is a failed request. This used to log and answer 200 with
    // the text, which tells the coach their summary is saved when the column
    // still holds the previous one — they close the page and it is gone, or
    // worse, they act on text the session page will never show again. The
    // sibling day-summary route takes the same posture: no partial success.
    if (updateError) {
      console.error('[AI Coaching] Failed to save coaching summary', {
        sessionId,
        error: updateError.message,
      });
      return NextResponse.json(
        { success: false, error: 'Failed to store coaching summary' },
        { status: 500 }
      );
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
