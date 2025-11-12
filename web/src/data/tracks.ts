/**
 * Tracks Data Layer
 *
 * Clean data access functions for tracks
 */

import { createServerClient } from '@/lib/supabase/client';

export interface Track {
  id: string;
  name: string;
  location: string | null;
  length_meters: number | null;
  config: string | null;
}

export interface TrackWithSessions extends Track {
  recentSessions: Array<{
    id: string;
    date: string;
    best_lap_ms: number | null;
    driver: { name: string } | null;
  }>;
}

/**
 * Get all tracks
 */
export async function getTracks(): Promise<{
  data: Track[] | null;
  error: Error | null;
}> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('tracks')
      .select('id, name, location, length_meters, config')
      .order('name', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get a single track with recent sessions
 */
export async function getTrack(
  id: string
): Promise<{ data: TrackWithSessions | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    // Fetch track details
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, name, location, length_meters, config')
      .eq('id', id)
      .single();

    if (trackError) {
      return { data: null, error: new Error(trackError.message) };
    }

    // Fetch recent sessions for this track
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(
        `
        id,
        date,
        best_lap_ms,
        driver:drivers(name)
      `
      )
      .eq('track_id', id)
      .order('date', { ascending: false })
      .limit(10);

    if (sessionsError) {
      return { data: null, error: new Error(sessionsError.message) };
    }

    return {
      data: {
        ...track,
        recentSessions: sessions || [],
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
