/**
 * Day Summaries Data Layer
 *
 * Two fetches — the day's context and the day's summary rows. The 409 contract
 * the write routes share (`SUMMARY_REPLACED`, `isReplacedWriteError`) is pure
 * and lives in `@/lib/day-summaries`.
 *
 * `getDaySummaryInputs` is an ADAPTER and nothing more: it reads rows and hands
 * them to `assembleDaySummaryContext`, which owns every derivation. No metric
 * is computed here — see the docblock on `@/lib/day-summaries`.
 * `buildDaySummaryContext` is the same fetch with the debrief dropped.
 */

import { createServerSupabase } from '@/lib/supabase/server';
import { getTrackDayDebrief } from '@/data/track-days';
import { assembleDaySummaryContext, type DaySummaryContext } from '@/lib/day-summaries';
import type { DaySummary, TrackDayDebrief } from '@/lib/types';

/**
 * The context object for one track day — the thing that is prompted with AND
 * stored as `prompt_context`, so callers must pass the SAME reference to both.
 *
 * Null means the day does not exist or is not this coach's (RLS returns an
 * empty read for both, and the two are indistinguishable by design). A genuine
 * query failure THROWS instead: returning null for it would tell the coach
 * their day is missing when the database is merely unreachable.
 *
 * A thin wrapper over getDaySummaryInputs — the day summary route needs the
 * context and nothing else, and this is the signature it already reads.
 */
export async function buildDaySummaryContext(
  dayId: string
): Promise<DaySummaryContext | null> {
  const inputs = await getDaySummaryInputs(dayId);
  return inputs?.ctx ?? null;
}

/**
 * The context object AND the debrief rows it was assembled from, in ONE fetch.
 *
 * The session-coaching route needs both: the context for the prompt, and the
 * raw focus rows (`status`, `created_at`, `created_after_session_id`), the
 * origin sessions, the day date and the track timezone that
 * `focusItemsForSession` takes — none of which survive into the context, whose
 * focus items are snapshotted down to what the prompt renders.
 *
 * Returning them together rather than letting the route call
 * `getTrackDayDebrief` again is not tidiness: two reads of the same day can
 * disagree (a session imported between them), and the eligibility set would
 * then be computed over a day the prompt does not describe. One read, one day.
 *
 * Null and throw mean exactly what they mean above.
 */
export async function getDaySummaryInputs(
  dayId: string
): Promise<{ ctx: DaySummaryContext; debrief: TrackDayDebrief } | null> {
  const { data: debrief, error } = await getTrackDayDebrief(dayId);
  if (error) throw error;
  if (!debrief) return null;

  const sessionIds = debrief.sessions.map((session) => session.id);

  // The one query the debrief does not already make. Skipped entirely for a
  // day with no sessions: `.in()` on an empty array is a query that can only
  // return nothing.
  let coachingNotes: Array<{
    id: string;
    session_id: string;
    author: string;
    body: string;
    created_at: string | null;
  }> = [];
  if (sessionIds.length > 0) {
    const supabase = createServerSupabase();
    const { data, error: notesError } = await supabase
      .from('coaching_notes')
      .select('id, session_id, author, body, created_at')
      .in('session_id', sessionIds);

    if (notesError) {
      // Logged here rather than at the call site: the Postgres `code` is the
      // useful part of a query failure and it does not survive the Error wrap.
      console.error('[Day Summaries] Coaching notes query failed', {
        dayId,
        error: notesError.message,
        code: notesError.code,
      });
      throw new Error(notesError.message);
    }
    coachingNotes = data ?? [];
  }

  const ctx = assembleDaySummaryContext({
    date: debrief.date,
    notes: debrief.notes,
    track: { name: debrief.track.name },
    driver: { name: debrief.driver.name },
    // Projected field by field, NOT spread. `sessions` rows carry
    // `ai_coaching_summary`, and this is the one boundary in the app where that
    // text and the prompt inputs are in the same scope. The input type's
    // `ai_coaching_summary?: never` makes `{ ...session }` a build error here on
    // purpose (see DaySummarySessionInput): the exclusion is structural, not
    // vigilance. Same rule for the notes below.
    sessions: debrief.sessions.map((session) => ({
      id: session.id,
      date: session.date,
      best_lap_ms: session.best_lap_ms,
      representativeness: session.representativeness,
      representativeness_note: session.representativeness_note,
      laps: session.laps,
    })),
    focusItems: debrief.focusItems,
    originSessions: debrief.originSessions,
    assessmentSessions: debrief.assessmentSessions,
    coachingNotes: coachingNotes.map((note) => ({
      id: note.id,
      session_id: note.session_id,
      author: note.author,
      body: note.body,
      created_at: note.created_at,
    })),
  });

  return { ctx, debrief };
}

/**
 * Every generation recorded for a day, newest first — drafts, the approved one,
 * and the superseded history alike.
 *
 * Unfiltered on purpose: `daySummaryView` decides which row is current, and it
 * is the only thing that decides. Throws on a query failure for the same reason
 * as above — an empty array would render as "no summary yet".
 */
export async function getDaySummaries(dayId: string): Promise<DaySummary[]> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('day_summaries')
    .select('*')
    .eq('track_day_id', dayId)
    .order('created_at', { ascending: false });

  if (error) {
    // Logged here rather than at the call site: the Postgres `code` is the
    // useful part of a query failure and it does not survive the Error wrap.
    console.error('[Day Summaries] Summary select failed', {
      dayId,
      error: error.message,
      code: error.code,
    });
    throw new Error(error.message);
  }
  return data ?? [];
}
