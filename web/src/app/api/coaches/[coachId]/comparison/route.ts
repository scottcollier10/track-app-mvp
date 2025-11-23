/**
 * Coach Driver Comparison API Route
 *
 * GET /api/coaches/[coachId]/comparison
 * Returns comparison data across all coach's drivers including:
 * - Per-track performance comparison
 * - Best lap times by driver and track
 * - Session counts per track
 *
 * Query params: trackId, startDate, endDate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface DriverTrackStats {
  driverId: string;
  driverName: string;
  trackId: string;
  trackName: string;
  sessionCount: number;
  bestLapMs: number | null;
  avgBestLapMs: number | null;
  totalLaps: number;
  lastSessionDate: string | null;
}

interface ComparisonResponse {
  comparison: DriverTrackStats[];
  tracks: Array<{ id: string; name: string }>;
  drivers: Array<{ id: string; name: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { coachId: string } }
) {
  try {
    const coachId = params.coachId;
    const { searchParams } = new URL(request.url);

    // Get filter params
    const trackId = searchParams.get('trackId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabase = await createServerClient();

    // Verify coach exists
    const { data: coach, error: coachError } = await (supabase
      .from('coaches') as any)
      .select('id, name')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Get all drivers for this coach
    const { data: drivers, error: driversError } = await (supabase
      .from('drivers') as any)
      .select('id, name')
      .eq('coach_id', coachId)
      .order('name', { ascending: true });

    if (driversError) {
      console.error('Error fetching drivers:', driversError);
      return NextResponse.json(
        { error: 'Failed to fetch drivers' },
        { status: 500 }
      );
    }

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        data: {
          comparison: [],
          tracks: [],
          drivers: [],
        } as ComparisonResponse,
      });
    }

    const driverIds = drivers.map((d: any) => d.id);

    // Get all tracks that these drivers have used
    const { data: tracks, error: tracksError } = await (supabase
      .from('tracks') as any)
      .select('id, name')
      .order('name', { ascending: true });

    if (tracksError) {
      console.error('Error fetching tracks:', tracksError);
      return NextResponse.json(
        { error: 'Failed to fetch tracks' },
        { status: 500 }
      );
    }

    const comparison: DriverTrackStats[] = [];

    // Build comparison data for each driver-track combination
    for (const driver of drivers) {
      // Build query for sessions
      let sessionsQuery = (supabase
        .from('sessions') as any)
        .select(`
          id,
          date,
          best_lap_ms,
          track_id,
          track:tracks(id, name)
        `)
        .eq('driver_id', driver.id);

      // Apply filters
      if (trackId) {
        sessionsQuery = sessionsQuery.eq('track_id', trackId);
      }
      if (startDate) {
        sessionsQuery = sessionsQuery.gte('date', startDate);
      }
      if (endDate) {
        sessionsQuery = sessionsQuery.lte('date', endDate);
      }

      const { data: sessions, error: sessionsError } = await sessionsQuery
        .order('date', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
        continue;
      }

      // Group sessions by track
      const trackGroups: Record<string, any[]> = {};

      for (const session of sessions || []) {
        const tId = session.track_id;
        if (!trackGroups[tId]) {
          trackGroups[tId] = [];
        }
        trackGroups[tId].push(session);
      }

      // Calculate stats for each track
      for (const [tId, trackSessions] of Object.entries(trackGroups)) {
        const trackInfo = (trackSessions[0] as any).track;

        // Best lap for this driver on this track
        let bestLapMs: number | null = null;
        let totalBestLaps = 0;
        let bestLapCount = 0;

        for (const session of trackSessions) {
          if (session.best_lap_ms) {
            if (bestLapMs === null || session.best_lap_ms < bestLapMs) {
              bestLapMs = session.best_lap_ms;
            }
            totalBestLaps += session.best_lap_ms;
            bestLapCount++;
          }
        }

        const avgBestLapMs = bestLapCount > 0
          ? Math.round(totalBestLaps / bestLapCount)
          : null;

        // Get total laps for these sessions
        let totalLaps = 0;
        for (const session of trackSessions) {
          const { count } = await (supabase
            .from('laps') as any)
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          totalLaps += count || 0;
        }

        // Last session date for this track
        const lastSessionDate = trackSessions[0]?.date || null;

        comparison.push({
          driverId: driver.id,
          driverName: driver.name,
          trackId: tId,
          trackName: trackInfo?.name || 'Unknown',
          sessionCount: trackSessions.length,
          bestLapMs,
          avgBestLapMs,
          totalLaps,
          lastSessionDate,
        });
      }
    }

    // Get unique tracks from comparison data
    const usedTrackIds = [...new Set(comparison.map(c => c.trackId))];
    const usedTracks = (tracks || [])
      .filter((t: any) => usedTrackIds.includes(t.id))
      .map((t: any) => ({ id: t.id, name: t.name }));

    const response: ComparisonResponse = {
      comparison,
      tracks: usedTracks,
      drivers: drivers.map((d: any) => ({ id: d.id, name: d.name })),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Coach comparison API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
