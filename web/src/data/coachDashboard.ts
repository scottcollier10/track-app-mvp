/**
 * Coach Dashboard Data Layer
 *
 * Aggregated queries for coach dashboard showing all drivers with their metrics
 */

import { createServerSupabase } from '@/lib/supabase/server';
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
  behaviorScore: number | null; // Average of per-session behavior scores
  sessionCount: number; // Total sessions across all tracks
  totalLaps: number; // Total laps across all sessions
  lastSessionDate: string | null; // Date of last session
  isImproving: boolean; // ✅ NEW: True if improving based on 3+ sessions trend
  improvementPct: number | null; // ✅ NEW: Percentage improvement (for debugging)
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
    const supabase = createServerSupabase();

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
          behaviorScore: null, // Will average per-session scores
          sessionCount: 1,
          totalLaps: lapTimes.length,
          lastSessionDate: session.date,
          isImproving: false, // ✅ NEW: Will calculate from session trend
          improvementPct: null, // ✅ NEW: For debugging
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

      // Calculate consistency from most recent session only
      const mostRecentSession = driverSessions[0]; // Already sorted by date desc
      if (mostRecentSession && mostRecentSession.laps) {
        const recentLapTimes = mostRecentSession.laps
          .map((lap: any) => lap.lap_time_ms)
          .filter((time: number | null) => time !== null && time > 0);

        if (recentLapTimes.length >= 2) {
          driver.consistencyScore = calculateConsistencyScore(recentLapTimes);
        }
      }

      // Calculate behavior score by averaging per-session scores
      // (Can't use all laps together because different tracks have different lap times)
      let behaviorScoreSum = 0;
      let behaviorScoreCount = 0;

      driverSessions.forEach((session: any) => {
        if (session.laps && session.laps.length >= 2) {
          const sessionLapTimes = session.laps
            .map((lap: any) => lap.lap_time_ms)
            .filter((time: number | null) => time !== null && time > 0);
          
          if (sessionLapTimes.length >= 2) {
            const sessionBehaviorScore = calculateBehaviorScore(sessionLapTimes);
            if (sessionBehaviorScore !== null) {
              behaviorScoreSum += sessionBehaviorScore;
              behaviorScoreCount++;
            }
          }
        }
      });

      if (behaviorScoreCount > 0) {
        driver.behaviorScore = Math.round(behaviorScoreSum / behaviorScoreCount);
        console.log(`[DEBUG] ${driver.driverName}: averaged ${behaviorScoreCount} sessions = ${driver.behaviorScore}%`);
      } else {
        console.log(`[DEBUG] ${driver.driverName}: no valid sessions for behavior score`);
      }

      // ✅ NEW: Calculate if driver is improving
      // Requires 3+ sessions, compares first 2 avg vs last 2 avg, needs 2%+ improvement
      if (driverSessions.length >= 3) {
        // Sort sessions by date ascending for trend analysis
        const sortedSessions = [...driverSessions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Get best laps from sessions (filter out nulls)
        const sessionBestLaps = sortedSessions
          .map((s: any) => s.best_lap_ms)
          .filter((lap: number | null) => lap !== null && lap > 0);

        if (sessionBestLaps.length >= 3) {
          // Calculate early average (first 2 sessions)
          const earlyAvg = (sessionBestLaps[0] + sessionBestLaps[1]) / 2;

          // Calculate recent average (last 2 sessions)
          const n = sessionBestLaps.length;
          const recentAvg = (sessionBestLaps[n - 1] + sessionBestLaps[n - 2]) / 2;

          // Calculate improvement percentage
          const improvementPct = ((earlyAvg - recentAvg) / earlyAvg) * 100;
          driver.improvementPct = Math.round(improvementPct * 10) / 10; // Round to 1 decimal

          // Driver is improving if they're 1%+ faster
          driver.isImproving = improvementPct >= 1;

          console.log(
            `[IMPROVING] ${driver.driverName}: ${sessionBestLaps.length} sessions, ` +
            `early=${Math.round(earlyAvg)}ms, recent=${Math.round(recentAvg)}ms, ` +
            `improvement=${driver.improvementPct}%, improving=${driver.isImproving}`
          );
        } else {
          console.log(`[IMPROVING] ${driver.driverName}: Not enough valid best laps (need 3+)`);
        }
      } else {
        console.log(`[IMPROVING] ${driver.driverName}: Not enough sessions (${driverSessions.length}/3)`);
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
