/**
 * Day Summaries Data Layer
 *
 * Two fetches and one error classifier, all for the `day_summaries` write path.
 *
 * `buildDaySummaryContext` is an ADAPTER and nothing more: it reads rows and
 * hands them to `assembleDaySummaryContext`, which owns every derivation. No
 * metric is computed here — see the docblock on `@/lib/day-summaries`.
 */

import { createServerSupabase } from '@/lib/supabase/server';
import { getTrackDayDebrief } from '@/data/track-days';
import { assembleDaySummaryContext, type DaySummaryContext } from '@/lib/day-summaries';
import type { DaySummary } from '@/lib/types';

/**
 * The context object for one track day — the thing that is prompted with AND
 * stored as `prompt_context`, so callers must pass the SAME reference to both.
 *
 * Null means the day does not exist or is not this coach's (RLS returns an
 * empty read for both, and the two are indistinguishable by design). A genuine
 * query failure THROWS instead: returning null for it would tell the coach
 * their day is missing when the database is merely unreachable.
 */
export async function buildDaySummaryContext(
  dayId: string
): Promise<DaySummaryContext | null> {
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

    if (notesError) throw new Error(notesError.message);
    coachingNotes = data ?? [];
  }

  return assembleDaySummaryContext({
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

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The 409 body every day_summaries write returns when it lost the race. */
export const SUMMARY_REPLACED = {
  error: 'replaced',
  message: 'This draft was replaced — refresh to see the current draft.',
} as const;

/**
 * Whether a failed `day_summaries` write means "the row you wrote against is no
 * longer the live one" — a 409 the coach can recover from by refreshing, never
 * a 500.
 *
 * TWO conditions, and they are genuinely different:
 *
 *  1. The trigger matrix rejected the write (frozen superseded row, illegal
 *     transition, immutable provenance). Every exception it raises is prefixed
 *     `day_summaries:`, which is what makes the prefix matchable.
 *  2. A partial unique index rejected the INSERT with a plain SQLSTATE 23505,
 *     whose message names the constraint and says nothing about day_summaries.
 *     Two overlapping generates for one day land here via
 *     day_summaries_one_live_draft — matching only the message prefix would
 *     500 on an ordinary double-click.
 */
export function isReplacedWriteError(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  if (error.message?.includes('day_summaries:')) return true;
  return error.code === '23505';
}
