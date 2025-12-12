/**
 * Coach Dashboard Data Layer
 *
 * Aggregated queries for coach dashboard showing all drivers with their metrics
 */

import { createServerClient } from '@/lib/supabase/client';
import {
  calculateConsistencyScore,
  calculateBehaviorScore,
} from '@/lib/analytics';

/**
 * Driver data for coach dashboard table
 * ONE ROW PER DRIVER (not per driver-track)
 */
export interface CoachDashboardDriver {
  driverId: string;
  driverName: string;
  driverEmail: string;
  lastTrackName: string; // Last track they drove at
  bestLapMs: number | null; // Best lap ever across ALL tracks
  avgBestLapMs: number | null; // Average of best laps across ALL sessions
  consistencyScore: number | null; // From most recent session
  behaviorScore: number | null; // From most recent session
  sessionCount: number; // Total sessions across all tracks
  totalLaps: number; // Total laps across all sessions
  lastSessionDate: string | null; // Date of last session
}

/**
 * Get coach dashboard data with aggregated driver metrics
 *
 * Returns ONE ROW PER DRIVER with aggregated metrics
 */
export async function getCoachDashboardData(): Promise<{
  data: CoachDashboardDriver[] | null;
  error: Error | null;
}> {
  console.log('[getCoachDashboardData] Fetching drivers with sessions...');

  try {
    const supabase = createServerClient();

    // Fetch all sessions with driver, track, and laps
    const { data: sessions, error } = await (supabase
      .from('sessions') as any)
      .select(
        `
        id,
        date,
        best_lap_ms,
        source,
        driver:drivers(id, name, email),
        track:tracks(id, name, location),
        laps!left(lap_time_ms)
      `
      )
      .order('date', { ascending: false });

    if (error) {
      console.error('[getCoachDashboardData] Error fetching sessions:', error);
      return { data: null, error: new Error(error.message) };
    }

    if (!sessions || sessions.length === 0) {
      console.log('[getCoachDashboardData] No sessions found');
      return { data: [], error: null };
    }

    console.log(`[getCoachDashboardData] Fetched ${sessions.length} sessions`);

    // Aggregate by DRIVER (not driver-track)
    const driverMap = new Map<string, CoachDashboardDriver>();

    sessions.forEach((session: any) => {
      const driverId = session.driver?.id;
      const driverName = session.driver?.name;
      const driverEmail = session.driver?.email;
      const trackName = session.track?.name;

      // Skip if missing critical data
      if (!driverId) {
        return;
      }

      const lapTimes = (session.laps || [])
        .map((lap: any) => lap.lap_time_ms)
        .filter((time: number | null) => time !== null && time > 0);

      const existing = driverMap.get(driverId);

      if (existing) {
        // Update existing driver aggregation
        existing.sessionCount += 1;
        existing.totalLaps += lapTimes.length;

        // Update best lap if this session is faster (across ALL tracks)
        if (
          session.best_lap_ms &&
          (!existing.bestLapMs || session.best_lap_ms < existing.bestLapMs)
        ) {
          existing.bestLapMs = session.best_lap_ms;
        }

        // Update last session date and track if newer
        const sessionDate = new Date(session.date);
        const existingDate = new Date(existing.lastSessionDate || '1970-01-01');
        if (sessionDate > existingDate) {
          existing.lastSessionDate = session.date;
          existing.lastTrackName = trackName || 'Unknown';
        }
      } else {
        // Create new driver entry
        driverMap.set(driverId, {
          driverId,
          driverName: driverName || 'Unknown',
          driverEmail: driverEmail || '',
          lastTrackName: trackName || 'Unknown',
          bestLapMs: session.best_lap_ms,
          avgBestLapMs: null, // Will calculate after collecting all sessions
          consistencyScore: null, // Will calculate from most recent session
          behaviorScore: null, // Will calculate from most recent session
          sessionCount: 1,
          totalLaps: lapTimes.length,
          lastSessionDate: session.date,
        });
      }
    });

    console.log(
      `[getCoachDashboardData] Aggregated into ${driverMap.size} drivers`
    );

    // Second pass: calculate metrics that require all sessions
    driverMap.forEach((driver) => {
      // Get all sessions for this driver (across all tracks)
      const driverSessions = sessions.filter(
        (s: any) => s.driver?.id === driver.driverId
      );

      // Calculate average best lap (across all sessions)
      const bestLaps = driverSessions
        .map((s: any) => s.best_lap_ms)
        .filter((lap: number | null) => lap !== null && lap > 0);

      if (bestLaps.length > 0) {
        driver.avgBestLapMs = Math.round(
          bestLaps.reduce((sum: number, lap: number) => sum + lap, 0) /
            bestLaps.length
        );
      }

      // Get most recent session for consistency/behavior scores
      const mostRecentSession = driverSessions[0]; // Already sorted by date desc
      if (mostRecentSession && mostRecentSession.laps) {
        const recentLapTimes = mostRecentSession.laps
          .map((lap: any) => lap.lap_time_ms)
          .filter((time: number | null) => time !== null && time > 0);

        if (recentLapTimes.length >= 2) {
          driver.consistencyScore = calculateConsistencyScore(recentLapTimes);
          driver.behaviorScore = calculateBehaviorScore(recentLapTimes);
        }
      }
    });

    const result = Array.from(driverMap.values());

    console.log(
      `[getCoachDashboardData] Successfully aggregated ${result.length} drivers`
    );

    return { data: result, error: null };
  } catch (err) {
    console.error('[getCoachDashboardData] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
