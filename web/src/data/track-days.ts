/**
 * Track Days Data Layer
 *
 * Clean data access functions for track days.
 *
 * A track day is one driver's day at one track. It is implicit — never created
 * by hand, only resolved on import (see resolveTrackDay below).
 */

import { createServerSupabase } from '@/lib/supabase/server';
import { bySessionStart } from '@/lib/track-days';
import type { Session, TrackDay, TrackDayDebrief, TrackDayDetail } from '@/lib/types';
import type { TablesInsert } from '@/lib/types/database';

/**
 * Get a single track day with its driver, track, ordered sessions and lap times.
 *
 * Sessions come back ordered by timestamp — that ordering IS the "Session 1..N"
 * numbering shown in the UI, so it must not be left to the database's whim.
 *
 * A day with zero sessions is returned, not treated as missing. It can only come
 * from a partially-failed import, and a direct link to a row that genuinely
 * exists must render honestly — 404-ing it would lie about a row the coach can
 * actually see. Callers should render an empty state for `sessions.length === 0`,
 * not an error. (The driver page's day list never shows one: it groups sessions
 * client-side, so a childless day has nothing to appear as.)
 *
 * A missing (or RLS-invisible) id returns `{ data: null, error: null }`, so
 * callers can call notFound() without mistaking absence for a query failure.
 */
export async function getTrackDayWithSessions(
  id: string
): Promise<{ data: TrackDayDetail | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('track_days')
      .select(
        `
        *,
        driver:drivers(*),
        track:tracks(*),
        sessions(*, laps(lap_number, lap_time_ms, sector_data))
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Not found is not an error — maybeSingle gives null rows without a PGRST116.
    if (!data) {
      return { data: null, error: null };
    }

    data.sessions.sort(bySessionStart);
    data.sessions.forEach((s) =>
      s.laps.sort((a, b) => a.lap_number - b.lap_number)
    );

    // No cast: the generated Relationships make this embed infer as TrackDayDetail
    // exactly, so select/schema drift fails the build instead of being papered over.
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * The day page's fetch: the day (via getTrackDayWithSessions, so ordering and
 * the null-vs-error contract are the same function, not a copy) plus the
 * driver's focus items with their assessments and the items' ORIGIN sessions.
 *
 * The focus data is fetched alongside rather than embedded in the day select
 * because it hangs off the DRIVER, not the day: focus items follow the driver
 * across track days, and an embed through `driver:drivers(...)` would also tax
 * getSessionWithLaps, which reuses the day query purely for prev/next nav.
 *
 * Origin sessions are fetched by id (`.in()`), never assumed to be among this
 * day's sessions — an item created after a session at a PREVIOUS track day is
 * exactly the item a coach wants in play today. Only id and date come back:
 * that is all bySessionStart needs to order an origin against a session.
 */
export async function getTrackDayDebrief(
  id: string
): Promise<{ data: TrackDayDebrief | null; error: Error | null }> {
  const { data: day, error } = await getTrackDayWithSessions(id);
  // Covers both the failure and the honest-404 branch: error is null there.
  if (!day) return { data: null, error };

  try {
    const supabase = createServerSupabase();

    const { data: focusItems, error: focusError } = await supabase
      .from('focus_items')
      .select('*, focus_item_assessments(*)')
      .eq('driver_id', day.driver_id)
      .order('created_at', { ascending: true });

    if (focusError) {
      return { data: null, error: new Error(focusError.message) };
    }

    const items = focusItems ?? [];

    const originIds = Array.from(
      new Set(
        items
          .map((item) => item.created_after_session_id)
          .filter((sessionId): sessionId is string => sessionId !== null)
      )
    );

    let originSessions: Pick<Session, 'id' | 'date'>[] = [];
    if (originIds.length > 0) {
      const { data: origins, error: originError } = await supabase
        .from('sessions')
        .select('id, date')
        .in('id', originIds);

      if (originError) {
        return { data: null, error: new Error(originError.message) };
      }
      originSessions = origins ?? [];
    }

    return { data: { ...day, focusItems: items, originSessions }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Find or create the track day for a driver/track/local-date. Called on import;
 * this is the ONLY place track days are written.
 *
 * Uses the same request-scoped, cookie-authenticated client as every other
 * function here, so the write runs under the coach's RLS session.
 */
export async function resolveTrackDay(
  driverId: string,
  trackId: string,
  localDate: string
): Promise<{ data: TrackDay | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    // Key columns ONLY. Any field added here is overwritten on every re-import
    // (upsert -> ON CONFLICT DO UPDATE). Coach-authored day fields must never be listed.
    const trackDayInsert: TablesInsert<'track_days'> = {
      driver_id: driverId,
      track_id: trackId,
      date: localDate,
    };

    // ignoreDuplicates stays false (the default): with it on, the conflict
    // branch returns zero rows and .single() turns every re-import into a 500.
    const { data: trackDay, error: trackDayError } = await supabase
      .from('track_days')
      .upsert(trackDayInsert, { onConflict: 'driver_id,track_id,date' })
      .select()
      .single();

    if (trackDayError || !trackDay) {
      // Logged here rather than at the call site: the Postgres `code` is the
      // useful part of an upsert failure and it does not survive the Error wrap.
      console.error('[Track Days] Track day upsert failed', {
        driverId,
        trackId,
        date: localDate,
        error: trackDayError?.message || 'Track day data missing',
        code: trackDayError?.code,
      });
      return {
        data: null,
        error: new Error(trackDayError?.message || 'Track day data missing'),
      };
    }

    return { data: trackDay, error: null };
  } catch (err) {
    // Logged here, not at the call site: the route turns this into a bare 500,
    // and this is the app's only ingestion path — it must never fail silently.
    // (The upsert-failure branch above logs itself, so logging there too would
    // double up.)
    console.error('[Track Days] Track day resolve threw', {
      driverId,
      trackId,
      date: localDate,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
