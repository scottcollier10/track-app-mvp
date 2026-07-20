/**
 * Sessions Data Layer
 *
 * Clean data access functions for sessions
 */

import { createServerSupabase } from '@/lib/supabase/server';

export interface SessionWithDetails {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  source?: string | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

export interface SessionFull {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  coach_notes: string | null;
  ai_coaching_summary: string | null;
  source?: string | null;
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
): Promise<{ data: SessionWithDetails[] | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    // Optimized approach: Use Supabase's aggregation count feature
    let query = supabase.from('sessions').select(
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

    return {
      data: {
        ...session,
        laps: laps || [],
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
