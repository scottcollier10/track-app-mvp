/**
 * Coach Drivers API Route
 *
 * GET /api/coaches/[coachId]/drivers
 * Returns all drivers for a coach with stats including:
 * - Total sessions count
 * - Total laps count
 * - Best lap time (across all sessions)
 * - Improvement metric (first vs last session best lap)
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface DriverWithStats {
  id: string;
  name: string;
  email: string;
  totalSessions: number;
  totalLaps: number;
  bestLapMs: number | null;
  bestLapTrack: string | null;
  improvementMs: number | null;
  lastSessionDate: string | null;
}

interface CoachDriversResponse {
  drivers: DriverWithStats[];
  coachName: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { coachId: string } }
) {
  try {
    const coachId = params.coachId;
    const supabase = await createServerClient();

    // Get coach info
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
      .select('id, name, email')
      .eq('coach_id', coachId)
      .order('name', { ascending: true });

    if (driversError) {
      console.error('Error fetching drivers:', driversError);
      return NextResponse.json(
        { error: 'Failed to fetch drivers' },
        { status: 500 }
      );
    }

    const driversWithStats: DriverWithStats[] = [];

    // Calculate stats for each driver
    for (const driver of drivers || []) {
      // Get all sessions for this driver
      const { data: sessions, error: sessionsError } = await (supabase
        .from('sessions') as any)
        .select(`
          id,
          date,
          best_lap_ms,
          track:tracks(id, name)
        `)
        .eq('driver_id', driver.id)
        .order('date', { ascending: true });

      if (sessionsError) {
        console.error('Error fetching sessions for driver:', sessionsError);
        continue;
      }

      const allSessions = sessions || [];
      const totalSessions = allSessions.length;

      // Calculate best lap and track
      let bestLapMs: number | null = null;
      let bestLapTrack: string | null = null;

      for (const session of allSessions) {
        if (session.best_lap_ms && (bestLapMs === null || session.best_lap_ms < bestLapMs)) {
          bestLapMs = session.best_lap_ms;
          bestLapTrack = session.track?.name || null;
        }
      }

      // Calculate improvement (first session vs last session best lap)
      let improvementMs: number | null = null;
      if (allSessions.length >= 2) {
        const firstSession = allSessions[0];
        const lastSession = allSessions[allSessions.length - 1];

        if (firstSession.best_lap_ms && lastSession.best_lap_ms) {
          // Negative means improved (faster), positive means slower
          improvementMs = lastSession.best_lap_ms - firstSession.best_lap_ms;
        }
      }

      // Get total laps count
      let totalLaps = 0;
      for (const session of allSessions) {
        const { count } = await (supabase
          .from('laps') as any)
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        totalLaps += count || 0;
      }

      // Get last session date
      const lastSessionDate = allSessions.length > 0
        ? allSessions[allSessions.length - 1].date
        : null;

      driversWithStats.push({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        totalSessions,
        totalLaps,
        bestLapMs,
        bestLapTrack,
        improvementMs,
        lastSessionDate,
      });
    }

    const response: CoachDriversResponse = {
      drivers: driversWithStats,
      coachName: coach.name,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Coach drivers API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
