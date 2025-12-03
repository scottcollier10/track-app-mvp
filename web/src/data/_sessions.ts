/**
 * Sessions Data Layer
 *
 * Clean data access functions for sessions
 */

import { createServerClient } from '@/lib/supabase/client';

export interface SessionWithDetails {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  source?: string;
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
  source?: string;
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
 * Get recent sessions with basic info
 */
export async function getRecentSessions(
  limit: number = 10
): Promise<{ data: SessionWithDetails[] | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    // TypeScript escape hatch for build compatibility
    const db = supabase as any;

    const { data: sessions, error } = await (supabase
      .from('sessions') as any)
      .select(
        `
        id,
        date,
        total_time_ms,
        best_lap_ms,
        source,
        driver:drivers(id, name, email),
        track:tracks(id, name, location)
      `
      )
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Get lap counts separately
    const sessionsWithCounts = await Promise.all(
      (sessions || []).map(async (session: any) => {
        const { count } = await (supabase
          .from('laps') as any)
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        return {
          ...session,
          lapCount: count || 0,
        };
      })
    );

    return { data: sessionsWithCounts as any, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all sessions with optional filters
 */
export async function getAllSessions(
  filters?: SessionFilters
): Promise<{ data: SessionWithDetails[] | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    // TypeScript escape hatch for build compatibility
    const db = supabase as any;

    let query = (supabase.from('sessions') as any).select(
      `
        id,
        date,
        total_time_ms,
        best_lap_ms,
        source,
        driver:drivers(id, name, email),
        track:tracks(id, name, location)
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

    // Get lap counts separately
    const sessionsWithCounts = await Promise.all(
      (sessions || []).map(async (session: any) => {
        const { count } = await (supabase
          .from('laps') as any)
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        return {
          ...session,
          lapCount: count || 0,
        };
      })
    );

    return { data: sessionsWithCounts as any, error: null };
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
    const supabase = createServerClient();
    // TypeScript escape hatch for build compatibility
    const db = supabase as any;

    const { data: session, error: sessionError } = await (supabase
      .from('sessions') as any)
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
    const { data: laps, error: lapsError } = await (supabase
      .from('laps') as any)
      .select('id, lap_number, lap_time_ms')
      .eq('session_id', id)
      .order('lap_number', { ascending: true });

    if (lapsError) {
      return { data: null, error: new Error(lapsError.message) };
    }

    return {
      data: {
        ...(session as any),  // Cast to bypass TypeScript never type
        laps: laps || [],
      } as any,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
