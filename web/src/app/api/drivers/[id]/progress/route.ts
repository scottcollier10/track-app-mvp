import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

interface SessionData {
  sessionId: string;
  date: string;
  bestLap: number;
  lapCount: number;
}

interface TrackProgress {
  trackId: string;
  trackName: string;
  trackLocation: string;
  visitCount: number;
  personalBest: number;
  firstSessionBest: number;
  mostRecentBest: number;
  improvementPercent: number;
  allSessions: SessionData[];
}

interface OverallStats {
  totalSessions: number;
  totalLaps: number;
  tracksVisited: number;
  avgImprovementPercent: number;
}

interface ProgressResponse {
  trackProgress: TrackProgress[];
  overallStats: OverallStats;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: driverId } = await params;
    const supabase = createServerClient();

    // Fetch all sessions for this driver with track info
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        track_id,
        date,
        best_lap_ms,
        tracks (
          id,
          name,
          location
        )
      `)
      .eq('driver_id', driverId)
      .order('date', { ascending: true });

    if (sessionsError) {
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        trackProgress: [],
        overallStats: {
          totalSessions: 0,
          totalLaps: 0,
          tracksVisited: 0,
          avgImprovementPercent: 0,
        },
      });
    }

    // Get lap counts for all sessions
    // Get lap counts for all sessions
    const sessionIds = sessions.map((s) => s.id);
    const lapQuery = await supabase
      .from('laps')
      .select('session_id')
      .in('session_id', sessionIds);
    
    const lapCounts = lapQuery.data as { session_id: string }[] | null;
    const lapError = lapQuery.error;

    if (lapError) {
      return NextResponse.json({ error: lapError.message }, { status: 500 });
    }

    // Count laps per session
    const lapCountMap: Record<string, number> = {};
    lapCounts?.forEach((lap) => {
      lapCountMap[lap.session_id] = (lapCountMap[lap.session_id] || 0) + 1;
    });

    // Group sessions by track
    const trackSessionsMap: Record<
      string,
      {
        track: { id: string; name: string; location: string | null };
        sessions: Array<{
          id: string;
          date: string;
          bestLap: number | null;
          lapCount: number;
        }>;
      }
    > = {};

    sessions.forEach((session) => {
      const trackId = session.track_id;
      const track = session.tracks as unknown as {
        id: string;
        name: string;
        location: string | null;
      };

      if (!trackSessionsMap[trackId]) {
        trackSessionsMap[trackId] = {
          track: {
            id: track.id,
            name: track.name,
            location: track.location,
          },
          sessions: [],
        };
      }

      trackSessionsMap[trackId].sessions.push({
        id: session.id,
        date: session.date,
        bestLap: session.best_lap_ms,
        lapCount: lapCountMap[session.id] || 0,
      });
    });

    // Calculate progress for each track
    const trackProgress: TrackProgress[] = [];
    let totalImprovement = 0;
    let tracksWithImprovement = 0;

    Object.values(trackSessionsMap).forEach(({ track, sessions }) => {
      // Sort sessions by date (already sorted, but ensure)
      const sortedSessions = [...sessions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Find personal best (minimum lap time)
      const validLaps = sortedSessions.filter((s) => s.bestLap !== null);
      const personalBest =
        validLaps.length > 0
          ? Math.min(...validLaps.map((s) => s.bestLap!))
          : 0;

      // First session best
      const firstSession = sortedSessions[0];
      const firstSessionBest = firstSession.bestLap || 0;

      // Most recent session best
      const mostRecentSession = sortedSessions[sortedSessions.length - 1];
      const mostRecentBest = mostRecentSession.bestLap || 0;

      // Calculate improvement percentage
      let improvementPercent = 0;
      if (
        sortedSessions.length > 1 &&
        firstSessionBest > 0 &&
        mostRecentBest > 0
      ) {
        improvementPercent =
          ((firstSessionBest - mostRecentBest) / firstSessionBest) * 100;
        totalImprovement += improvementPercent;
        tracksWithImprovement++;
      }

      // Build all sessions data
      const allSessions: SessionData[] = sortedSessions.map((s) => ({
        sessionId: s.id,
        date: s.date,
        bestLap: s.bestLap || 0,
        lapCount: s.lapCount,
      }));

      trackProgress.push({
        trackId: track.id,
        trackName: track.name,
        trackLocation: track.location || '',
        visitCount: sessions.length,
        personalBest,
        firstSessionBest,
        mostRecentBest,
        improvementPercent,
        allSessions,
      });
    });

    // Sort by most recent visit date
    trackProgress.sort((a, b) => {
      const aLatest = a.allSessions[a.allSessions.length - 1]?.date || '';
      const bLatest = b.allSessions[b.allSessions.length - 1]?.date || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });

    // Calculate overall stats
    const totalLaps = Object.values(lapCountMap).reduce(
      (sum, count) => sum + count,
      0
    );
    const avgImprovementPercent =
      tracksWithImprovement > 0 ? totalImprovement / tracksWithImprovement : 0;

    const response: ProgressResponse = {
      trackProgress,
      overallStats: {
        totalSessions: sessions.length,
        totalLaps,
        tracksVisited: trackProgress.length,
        avgImprovementPercent,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching driver progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch driver progress' },
      { status: 500 }
    );
  }
}
