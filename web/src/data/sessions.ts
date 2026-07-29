/**
 * Sessions Data Layer
 *
 * Clean data access functions for sessions
 */

import { createServerSupabase } from '@/lib/supabase/server';
import { getTrackDayWithSessions } from '@/data/track-days';

export interface SessionWithDetails {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  source?: string | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
  /** Lap times in ms, present when the query fetches lap details (getAllSessions) */
  lapTimesMs?: number[];
  /**
   * The session's track day, present when the query embeds it (getAllSessions).
   *
   * The `date` here is track_days.date — a PLAIN track-local calendar date, and
   * the only honest label for a day. Carried rather than re-derived from
   * `date` above (a timestamptz) so that a client rendering a day list and the
   * day page it links to cannot disagree about which day it is: a session at
   * 2026-07-12T03:30Z belongs to track day 2026-07-12, but formatting that
   * instant in a Chicago browser prints "Jul 11". Render with formatTrackDate.
   *
   * Null for a session that predates the day model (backfilled since) or whose
   * import failed to resolve one.
   */
  track_day?: { id: string; date: string } | null;
}

/**
 * A session from getAllSessions specifically: lap times and the track day are
 * fetched, so they are PRESENT, not merely optional.
 *
 * The two optional fields above fail in different directions, which is why this
 * exists. A missing lapTimesMs under-claims — no σ, no trend, nothing false on
 * screen. A missing track_day MIS-RENDERS: every row of a day list becomes an
 * orphan pointing at /sessions instead of /days, silently. getRecentSessions
 * shares SessionWithDetails and embeds neither, so any consumer that needs the
 * day (TrackDayList) takes THIS type and a getRecentSessions result fails to
 * compile rather than rendering a wrong page.
 */
export type SessionWithTrackDay = SessionWithDetails & {
  lapTimesMs: number[];
  track_day: { id: string; date: string } | null;
};

/**
 * Where this session sits in its track day: "Session 2 of 4", plus the two
 * sessions either side of it.
 *
 * `index` is 0-BASED — the position in the day's ordered session list. The UI
 * renders `index + 1`. That ordering is bySessionStart's, and it is not
 * recomputed here: getSessionWithLaps derives this from getTrackDayWithSessions,
 * the same call the day page renders its "Session N" cards from, so the two
 * pages cannot number the same day differently.
 *
 * `date` is the DAY's date — a plain track-local calendar date (YYYY-MM-DD),
 * not the session's timestamptz. Render it with formatTrackDate, or the
 * back-link label prints a different day than the page it links to.
 *
 * Null when the session has no track day (a pre-day-model import that escaped
 * the backfill), when the day is missing/RLS-invisible, or when the session is
 * somehow not among the day's sessions. Every one of those means "no honest
 * position to claim" — the page drops the day chrome rather than guessing.
 */
export interface SessionDayContext {
  trackDayId: string;
  /** Plain track-local calendar date, YYYY-MM-DD. formatTrackDate, never formatDate. */
  date: string;
  trackName: string;
  /** 0-based position in the day. Displayed as index + 1. */
  index: number;
  count: number;
  /** Null at the first session of the day. */
  prevSessionId: string | null;
  /** Null at the last session of the day. */
  nextSessionId: string | null;
}

export interface SessionFull {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  coach_notes: string | null;
  ai_coaching_summary: string | null;
  source?: string | null;
  track_day_id: string | null;
  /** This session's place in its day. Null means no day context to show. */
  dayContext: SessionDayContext | null;
  driver: { id: string; name: string; email: string } | null;
  track: {
    id: string;
    name: string;
    location: string | null;
    length_meters: number | null;
    config: string | null;
  } | null;
  laps: Array<{
    id: string;
    lap_number: number;
    lap_time_ms: number;
  }>;
}

export interface SessionFilters {
  trackId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get recent sessions with basic info - OPTIMIZED with aggregated lap counts
 */
export async function getRecentSessions(
  limit: number = 10
): Promise<{ data: SessionWithDetails[] | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    // Optimized approach: Use Supabase's aggregation count feature
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(
        `
        id,
        date,
        total_time_ms,
        best_lap_ms,
        source,
        driver:drivers(id, name, email),
        track:tracks(id, name, location),
        laps!left(count)
      `
      )
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Transform the response to include lapCount from aggregated data
    const sessionsWithCounts = (sessions || []).map((session) => ({
      ...session,
      lapCount: session.laps?.[0]?.count || 0,
      laps: undefined, // Remove the nested laps object
    }));

    return { data: sessionsWithCounts, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all sessions with optional filters - OPTIMIZED with aggregated lap counts
 */
export async function getAllSessions(
  filters?: SessionFilters
): Promise<{ data: SessionWithTrackDay[] | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    // Fetch lap times so per-session scores can be computed from real data
    let query = supabase.from('sessions').select(
      `
        id,
        date,
        total_time_ms,
        best_lap_ms,
        source,
        driver:drivers(id, name, email),
        track:tracks(id, name, location),
        track_day:track_days(id, date),
        laps!left(lap_time_ms)
      `
    );

    // Apply filters if provided
    if (filters?.trackId) {
      query = query.eq('track_id', filters.trackId);
    }
    if (filters?.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data: sessions, error } = await query.order('date', {
      ascending: false,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Transform the response to include lapCount and lap times
    const sessionsWithCounts = (sessions || []).map((session) => ({
      ...session,
      lapCount: session.laps?.length || 0,
      lapTimesMs: (session.laps || [])
        .map((lap) => lap.lap_time_ms)
        .filter((time): time is number => time !== null && time > 0),
      laps: undefined, // Remove the nested laps object
    }));

    return { data: sessionsWithCounts, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Resolve a session's position in its track day.
 *
 * Deliberately built on getTrackDayWithSessions rather than its own
 * `sessions.select('id, date').eq('track_day_id', ...)`:
 *
 *  - The day page renders "Session 1..N" off exactly this call's `data.sessions`
 *    array. Reading the index out of that same array makes the two pages agree
 *    STRUCTURALLY. A second query agrees only as long as both call sites
 *    remember to sort by bySessionStart, and a plain SQL `order('date')` has no
 *    tiebreak at all — two sessions sharing a start time would be numbered one
 *    way on the day page and another here.
 *  - It is also FEWER round trips, not more: the header needs the day's track
 *    name and plain calendar date for the back-link, which a siblings-only query
 *    would have to fetch separately.
 *
 * The cost is the day's laps riding along unused. That is one day's worth of
 * rows (~4 sessions) — the same payload the day page already fetches per view.
 *
 * Any failure returns null. A day that will not load is missing NAVIGATION, and
 * failing the whole session page over its chrome would hide the lap evidence
 * that is the point of the page.
 */
async function getSessionDayContext(
  trackDayId: string,
  sessionId: string
): Promise<SessionDayContext | null> {
  const { data: day } = await getTrackDayWithSessions(trackDayId);
  if (!day) return null;

  const index = day.sessions.findIndex((s) => s.id === sessionId);
  // -1 means the day is visible but this session is not among its sessions,
  // which should be impossible. "Session 0 of 4" is worse than no header.
  if (index === -1) return null;

  return {
    trackDayId: day.id,
    date: day.date,
    trackName: day.track.name,
    index,
    count: day.sessions.length,
    prevSessionId: index > 0 ? day.sessions[index - 1].id : null,
    nextSessionId: index < day.sessions.length - 1 ? day.sessions[index + 1].id : null,
  };
}

/**
 * Get a single session with full details including laps
 */
export async function getSessionWithLaps(
  id: string
): Promise<{ data: SessionFull | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(
        `
        id,
        date,
        total_time_ms,
        best_lap_ms,
        coach_notes,
        ai_coaching_summary,
        source,
        track_day_id,
        driver:drivers(id, name, email),
        track:tracks(id, name, location, length_meters, config)
      `
      )
      .eq('id', id)
      .single();

    if (sessionError) {
      return { data: null, error: new Error(sessionError.message) };
    }

    // Fetch laps separately
    const { data: laps, error: lapsError } = await supabase
      .from('laps')
      .select('id, lap_number, lap_time_ms')
      .eq('session_id', id)
      .order('lap_number', { ascending: true });

    if (lapsError) {
      return { data: null, error: new Error(lapsError.message) };
    }

    const dayContext = session.track_day_id
      ? await getSessionDayContext(session.track_day_id, session.id)
      : null;

    return {
      data: {
        ...session,
        laps: laps || [],
        dayContext,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
