/**
 * Track Days Data Layer
 *
 * Clean data access functions for track days.
 *
 * A track day is one driver's day at one track. It is implicit — never created
 * by hand, only resolved on import (see resolveTrackDay below).
 */

import { createServerSupabase } from '@/lib/supabase/server';
import type { TrackDay, TrackDayDetail, TrackDayWithSessions } from '@/lib/types';
import type { TablesInsert } from '@/lib/types/database';

/**
 * Get a single track day with its driver, track, ordered sessions and lap times.
 *
 * Sessions come back ordered by timestamp — that ordering IS the "Session 1..N"
 * numbering shown in the UI, so it must not be left to the database's whim.
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
        sessions(*, laps(lap_number, lap_time_ms))
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // sessions.date is TIMESTAMPTZ (the session's start time), unlike
    // track_days.date which is a plain calendar date.
    data.sessions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
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
 * Get a driver's track days, newest day first, each with its ordered sessions.
 *
 * Driver is omitted from the embed — the caller already has one in context.
 */
export async function getTrackDaysForDriver(
  driverId: string
): Promise<{ data: TrackDayWithSessions[] | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('track_days')
      .select(
        `
        *,
        track:tracks(*),
        sessions(*, laps(lap_number, lap_time_ms))
      `
      )
      .eq('driver_id', driverId)
      .order('date', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Same timestamp ordering as above — this is the Session 1..N numbering.
    data.forEach((d) =>
      d.sessions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );

    // Drop days with no sessions. An import can upsert the day and then fail to
    // insert the session, leaving a childless track_days row that would render
    // as a blank entry in the day list.
    const daysWithSessions = data.filter((d) => d.sessions.length > 0);

    return { data: daysWithSessions, error: null };
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
      console.error('[Import Session] Track day upsert failed', {
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
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
