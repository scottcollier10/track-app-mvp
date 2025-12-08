/**
 * Driver Progress Query Functions
 *
 * Provides flexible session data grouping and comparison for driver progress tracking
 */

import { createServerClient } from '@/lib/supabase/client';
import { calculateConsistencyScore, calculatePaceTrend } from '@/lib/analytics';

/**
 * Session summary interface for progress tracking
 */
export interface SessionSummary {
  sessionId: string;
  label: string;          // "Session 1", "May 2025 Event", "Nov 16, 2025"
  date: string;           // ISO date
  trackName: string;
  trackId: string;
  bestLap: number;        // in seconds
  consistencyScore: number; // 0-100
  paceTrend: "improving" | "stable" | "fading";
  lapsCount: number;
  delta?: {               // Calculated vs previous session/event
    bestLap: number;      // negative = improved
    consistency: number;  // positive = improved
  }
}

/**
 * Parameters for getDriverProgress function
 */
export interface DriverProgressParams {
  driverId: string;
  mode: "weekend" | "track" | "overall";
  trackId?: string;
  dateRange?: [string, string]; // ISO format dates: ["2025-11-16", "2025-11-16"]
}

/**
 * Internal type for session data from database
 */
interface SessionWithLaps {
  id: string;
  date: string;
  track_id: string;
  best_lap_ms: number | null;
  tracks: {
    id: string;
    name: string;
  };
  laps: Array<{
    lap_number: number;
    lap_time_ms: number;
  }>;
}

/**
 * Get driver progress with different grouping/filtering modes
 *
 * @param params - Query parameters including driverId, mode, and optional filters
 * @returns Array of session summaries with delta calculations
 */
export async function getDriverProgress(
  params: DriverProgressParams
): Promise<SessionSummary[]> {
  const { driverId, mode, trackId, dateRange } = params;

  const supabase = createServerClient();

  try {
    // Build base query
    let query = supabase
      .from('sessions')
      .select(`
        id,
        date,
        track_id,
        best_lap_ms,
        tracks (
          id,
          name
        ),
        laps (
          lap_number,
          lap_time_ms
        )
      `)
      .eq('driver_id', driverId);

    // Apply mode-specific filters
    if (mode === 'weekend' && dateRange) {
      // Filter by date range
      const [startDate, endDate] = dateRange;
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    } else if (mode === 'track' && trackId) {
      // Filter by track
      query = query.eq('track_id', trackId);
    }
    // For 'overall' mode, no additional filters needed

    // Order by date ascending
    query = query.order('date', { ascending: true });

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Process sessions based on mode
    let processedSessions: SessionSummary[] = [];

    if (mode === 'weekend') {
      // Weekend mode: all sessions from the date range
      processedSessions = sessions.map((session, index) =>
        createSessionSummary(session as SessionWithLaps, `Session ${index + 1}`)
      );
    } else if (mode === 'track') {
      // Track mode: best session per event date (group by date)
      const sessionsByDate = groupSessionsByDate(sessions as SessionWithLaps[]);
      processedSessions = sessionsByDate.map((group) => {
        const bestSession = getBestSessionFromGroup(group.sessions);
        const label = formatMonthYear(bestSession.date);
        const totalLaps = group.sessions.reduce((sum, s) => sum + s.laps.length, 0);
        const summary = createSessionSummary(bestSession, label);
        return {
          ...summary,
          lapsCount: totalLaps // Override with total laps from all sessions that day
        };
      });
    } else if (mode === 'overall') {
      // Overall mode: group by month
      const sessionsByMonth = groupSessionsByMonth(sessions as SessionWithLaps[]);
      processedSessions = sessionsByMonth.map((group) => {
        const bestSession = getBestSessionFromGroup(group.sessions);
        const label = formatMonthYear(bestSession.date);
        const totalLaps = group.sessions.reduce((sum, s) => sum + s.laps.length, 0);
        const summary = createSessionSummary(bestSession, label);
        return {
          ...summary,
          lapsCount: totalLaps // Override with total laps from all sessions in that month
        };
      });
    }

    // Calculate deltas
    processedSessions = calculateDeltas(processedSessions);

    return processedSessions;
  } catch (error) {
    console.error('Error in getDriverProgress:', error);
    return [];
  }
}

/**
 * Create a session summary from a database session
 */
function createSessionSummary(
  session: SessionWithLaps,
  label: string
): SessionSummary {
  const lapTimes = session.laps
    .sort((a, b) => a.lap_number - b.lap_number)
    .map(lap => lap.lap_time_ms);

  const consistencyScore = calculateConsistencyScore(lapTimes) || 0;
  const paceTrendStr = calculatePaceTrend(lapTimes);

  // Convert pace trend string to enum
  let paceTrend: "improving" | "stable" | "fading";
  if (paceTrendStr.includes('Improving')) {
    paceTrend = "improving";
  } else if (paceTrendStr.includes('Fading')) {
    paceTrend = "fading";
  } else {
    paceTrend = "stable";
  }

  // Convert best lap from milliseconds to seconds
  const bestLap = session.best_lap_ms ? session.best_lap_ms / 1000 : 0;

  return {
    sessionId: session.id,
    label,
    date: session.date,
    trackName: (session.tracks as any).name,
    trackId: session.track_id,
    bestLap,
    consistencyScore,
    paceTrend,
    lapsCount: session.laps.length
  };
}

/**
 * Group sessions by date (YYYY-MM-DD)
 */
function groupSessionsByDate(sessions: SessionWithLaps[]): Array<{
  date: string;
  sessions: SessionWithLaps[];
}> {
  const grouped = new Map<string, SessionWithLaps[]>();

  sessions.forEach(session => {
    const dateKey = session.date.split('T')[0]; // Get YYYY-MM-DD part
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(session);
  });

  return Array.from(grouped.entries())
    .map(([date, sessions]) => ({ date, sessions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group sessions by month (YYYY-MM)
 */
function groupSessionsByMonth(sessions: SessionWithLaps[]): Array<{
  month: string;
  sessions: SessionWithLaps[];
}> {
  const grouped = new Map<string, SessionWithLaps[]>();

  sessions.forEach(session => {
    const date = new Date(session.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(session);
  });

  return Array.from(grouped.entries())
    .map(([month, sessions]) => ({ month, sessions }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get the best session from a group (lowest best_lap_ms)
 */
function getBestSessionFromGroup(sessions: SessionWithLaps[]): SessionWithLaps {
  return sessions.reduce((best, current) => {
    if (!best.best_lap_ms) return current;
    if (!current.best_lap_ms) return best;
    return current.best_lap_ms < best.best_lap_ms ? current : best;
  });
}

/**
 * Format date as "May 2025", "June 2025", etc.
 */
function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Calculate deltas between consecutive sessions
 */
function calculateDeltas(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.map((session, index) => {
    if (index === 0) {
      // First session has no delta
      return session;
    }

    const previousSession = sessions[index - 1];

    return {
      ...session,
      delta: {
        bestLap: session.bestLap - previousSession.bestLap,
        consistency: session.consistencyScore - previousSession.consistencyScore
      }
    };
  });
}
