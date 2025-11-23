/**
 * Driver Stats API Route
 *
 * GET /api/drivers/[id]/stats
 * Returns statistics for a specific driver including:
 * - Total sessions count
 * - All-time best lap (across all tracks)
 * - Most frequent track (favorite venue)
 * - Average laps per session
 * - Recent sessions list (last 5)
 */

import { NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase/server';

interface SessionListItem {
  id: string;
  date: string;
  best_lap_ms: number | null;
  track: {
    id: string;
    name: string;
    location: string | null;
  } | null;
  lapCount: number;
}

interface DriverStatsResponse {
  totalSessions: number;
  bestLapMs: number | null;
  bestLapTrack: string | null;
  favoriteTrack: {
    id: string;
    name: string;
    sessionCount: number;
  } | null;
  recentSessions: SessionListItem[];
  averageLapsPerSession: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const driverId = params.id;

    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Verify user can only access their own stats
    // Note: drivers.id = auth.users.id
    if (user.id !== driverId) {
      return NextResponse.json(
        { error: 'Forbidden - you can only access your own stats' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // Get all sessions for this driver
    const { data: sessions, error: sessionsError } = await (supabase
      .from('sessions') as any)
      .select(
        `
        id,
        date,
        best_lap_ms,
        track_id,
        track:tracks(id, name, location)
      `
      )
      .eq('driver_id', driverId)
      .order('date', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    const allSessions = sessions || [];
    const totalSessions = allSessions.length;

    // Calculate best lap across all sessions
    let bestLapMs: number | null = null;
    let bestLapTrack: string | null = null;

    for (const session of allSessions) {
      if (
        session.best_lap_ms &&
        (bestLapMs === null || session.best_lap_ms < bestLapMs)
      ) {
        bestLapMs = session.best_lap_ms;
        bestLapTrack = session.track?.name || null;
      }
    }

    // Find favorite track (most frequent)
    const trackCounts: Record<
      string,
      { id: string; name: string; count: number }
    > = {};

    for (const session of allSessions) {
      if (session.track) {
        const trackId = session.track.id;
        if (!trackCounts[trackId]) {
          trackCounts[trackId] = {
            id: session.track.id,
            name: session.track.name,
            count: 0,
          };
        }
        trackCounts[trackId].count++;
      }
    }

    let favoriteTrack: {
      id: string;
      name: string;
      sessionCount: number;
    } | null = null;

    for (const track of Object.values(trackCounts)) {
      if (!favoriteTrack || track.count > favoriteTrack.sessionCount) {
        favoriteTrack = {
          id: track.id,
          name: track.name,
          sessionCount: track.count,
        };
      }
    }

    // Get lap counts for all sessions to calculate average
    let totalLaps = 0;
    const recentSessionsData: SessionListItem[] = [];

    // Process recent sessions (first 5)
    const recentSessionsList = allSessions.slice(0, 5);

    for (const session of allSessions) {
      const { count } = await (supabase
        .from('laps') as any)
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      const lapCount = count || 0;
      totalLaps += lapCount;

      // Add to recent sessions if it's in the first 5
      if (recentSessionsList.includes(session)) {
        recentSessionsData.push({
          id: session.id,
          date: session.date,
          best_lap_ms: session.best_lap_ms,
          track: session.track,
          lapCount,
        });
      }
    }

    const averageLapsPerSession =
      totalSessions > 0 ? totalLaps / totalSessions : 0;

    // Get first and last session dates
    const firstSessionDate =
      allSessions.length > 0
        ? allSessions[allSessions.length - 1].date
        : null;
    const lastSessionDate =
      allSessions.length > 0 ? allSessions[0].date : null;

    const stats: DriverStatsResponse = {
      totalSessions,
      bestLapMs,
      bestLapTrack,
      favoriteTrack,
      recentSessions: recentSessionsData,
      averageLapsPerSession: Math.round(averageLapsPerSession * 10) / 10,
      firstSessionDate,
      lastSessionDate,
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('Driver stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
