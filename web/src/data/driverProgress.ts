/**
 * Driver Progress Data Layer
 *
 * Fetches longitudinal driver progression data grouped by track
 */

import { createServerClient } from '@/lib/supabase/client';
import { calculateConsistencyScore } from '@/lib/analytics';

export interface EventMetrics {
  date: string;
  sessionId: string;
  bestLapMs: number | null;
  consistency: number | null;
  lapCount: number;
  bestLapNumber: number | null; // Which lap was the best
  peakWindowAvg: number | null; // Best 3-lap average
}

export interface DriverProgressData {
  trackId: string;
  trackName: string;
  events: EventMetrics[];
  firstEvent: EventMetrics | null;
  latestEvent: EventMetrics | null;
  deltas: {
    bestLapDelta: number; // Improvement in ms (negative = faster)
    consistencyDelta: number; // Improvement in points
    lapNumberDelta: number; // Lap number improvement (negative = finding pace sooner)
  };
}

/**
 * Fetches driver progression data for a specific track.
 * Groups sessions by date (event) and calculates improvement metrics.
 */
export async function getDriverProgressByTrack(
  driverId: string,
  trackId: string,
  options?: {
    after?: string;
    before?: string;
  }
): Promise<{ data: DriverProgressData | null; error: string | null }> {
  console.log('[getDriverProgressByTrack] Fetching progress for driver:', driverId, 'at track:', trackId);

  try {
    const supabase = createServerClient();

    // Build query for sessions at this track
    let query = (supabase.from('sessions') as any)
      .select(`
        id,
        date,
        best_lap_ms,
        track:tracks(id, name),
        laps(lap_number, lap_time_ms)
      `)
      .eq('driver_id', driverId)
      .eq('track_id', trackId)
      .order('date', { ascending: true });

    // Apply date filters if provided
    if (options?.after) {
      query = query.gte('date', options.after);
    }
    if (options?.before) {
      query = query.lte('date', options.before);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('[getDriverProgressByTrack] Query error:', error);
      return { data: null, error: error.message };
    }

    if (!sessions || sessions.length === 0) {
      console.log('[getDriverProgressByTrack] No sessions found');
      return { data: null, error: 'No sessions found for this driver at this track' };
    }

    console.log(`[getDriverProgressByTrack] Found ${sessions.length} sessions`);

    // Extract track info
    const trackName = sessions[0]?.track?.name || 'Unknown Track';
    const extractedTrackId = sessions[0]?.track?.id || trackId;

    // Process each session into event metrics
    const events: EventMetrics[] = sessions.map((session: any) => {
      const laps = session.laps || [];
      const lapTimes = laps.map((lap: any) => lap.lap_time_ms).filter((t: number) => t > 0);

      // Find which lap number was the best
      let bestLapNumber: number | null = null;
      if (session.best_lap_ms && laps.length > 0) {
        const bestLap = laps.find((lap: any) => lap.lap_time_ms === session.best_lap_ms);
        bestLapNumber = bestLap?.lap_number || null;
      }

      // Calculate best 3-lap average (peak window)
      let peakWindowAvg: number | null = null;
      if (lapTimes.length >= 3) {
        const sortedLaps = [...lapTimes].sort((a, b) => a - b);
        const best3 = sortedLaps.slice(0, 3);
        peakWindowAvg = best3.reduce((sum, t) => sum + t, 0) / 3;
      }

      return {
        date: session.date,
        sessionId: session.id,
        bestLapMs: session.best_lap_ms,
        consistency: calculateConsistencyScore(lapTimes),
        lapCount: laps.length,
        bestLapNumber,
        peakWindowAvg,
      };
    });

    // Get first and latest events
    const firstEvent = events[0] || null;
    const latestEvent = events[events.length - 1] || null;

    // Calculate deltas
    const deltas = {
      bestLapDelta: 0,
      consistencyDelta: 0,
      lapNumberDelta: 0,
    };

    if (firstEvent && latestEvent) {
      // Best lap delta (negative = improvement)
      if (firstEvent.bestLapMs && latestEvent.bestLapMs) {
        deltas.bestLapDelta = latestEvent.bestLapMs - firstEvent.bestLapMs;
      }

      // Consistency delta (positive = improvement)
      if (firstEvent.consistency !== null && latestEvent.consistency !== null) {
        deltas.consistencyDelta = latestEvent.consistency - firstEvent.consistency;
      }

      // Lap number delta (negative = finding pace sooner)
      if (firstEvent.bestLapNumber && latestEvent.bestLapNumber) {
        deltas.lapNumberDelta = latestEvent.bestLapNumber - firstEvent.bestLapNumber;
      }
    }

    console.log('[getDriverProgressByTrack] Calculated deltas:', deltas);

    return {
      data: {
        trackId: extractedTrackId,
        trackName,
        events,
        firstEvent,
        latestEvent,
        deltas,
      },
      error: null,
    };
  } catch (err) {
    console.error('[getDriverProgressByTrack] Error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get list of tracks that a driver has sessions at
 */
export async function getDriverTracks(
  driverId: string
): Promise<{ data: Array<{ id: string; name: string }> | null; error: string | null }> {
  try {
    const supabase = createServerClient();

    const { data: sessions, error } = await (supabase.from('sessions') as any)
      .select('track:tracks(id, name)')
      .eq('driver_id', driverId);

    if (error) {
      return { data: null, error: error.message };
    }

    // Extract unique tracks
    const tracksMap = new Map<string, { id: string; name: string }>();
    sessions?.forEach((session: any) => {
      if (session.track) {
        tracksMap.set(session.track.id, {
          id: session.track.id,
          name: session.track.name,
        });
      }
    });

    const tracks = Array.from(tracksMap.values());
    console.log(`[getDriverTracks] Found ${tracks.length} unique tracks for driver ${driverId}`);

    return { data: tracks, error: null };
  } catch (err) {
    console.error('[getDriverTracks] Error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
