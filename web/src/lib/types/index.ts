/**
 * Application Types
 *
 * Higher-level types for use throughout the application
 */

import { Database } from './database';

// Table row types
export type Driver = Database['public']['Tables']['drivers']['Row'];
export type Track = Database['public']['Tables']['tracks']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type Lap = Database['public']['Tables']['laps']['Row'];
export type CoachingNote = Database['public']['Tables']['coaching_notes']['Row'];
export type TrackDay = Database['public']['Tables']['track_days']['Row'];

// Extended types with relations
export interface SessionWithRelations extends Session {
  driver: Driver;
  track: Track;
  laps: Lap[];
  coaching_notes?: CoachingNote[];
}

/** Session + the minimal lap projection fetched by the track-day queries. Mirrors the exact `laps(lap_number, lap_time_ms)` select — widening it to `Lap[]` would break that correspondence. */
export interface SessionWithLapTimes extends Session {
  laps: Pick<Lap, 'lap_number' | 'lap_time_ms'>[];
}

/** A day plus its ordered sessions. Driver is implied by context (e.g. the driver page). */
export interface TrackDayWithSessions extends TrackDay {
  track: Track;
  sessions: SessionWithLapTimes[];
}

/** Standalone day view (/days/[id]) — no ambient driver context, so it carries one. */
export interface TrackDayDetail extends TrackDayWithSessions {
  driver: Driver;
}

/** DB CHECK constraint on sessions.representativeness. NULL = representative. */
export type Representativeness = 'representative' | 'partial' | 'not_representative';

export interface LapWithDelta extends Lap {
  delta_ms?: number;
  delta_formatted?: string;
  is_best?: boolean;
}

// Import session payload (from iOS app)
export interface ImportSessionPayload {
  driverEmail: string;
  trackId: string;
  date: string;
  totalTimeMs: number;
  bestLapMs?: number;
  source?: string;
  laps: {
    lapNumber: number;
    lapTimeMs: number;
    sectorData?: Record<string, number>;
  }[];
}

// Filter types
export interface SessionFilters {
  trackId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Stats types
export interface DashboardStats {
  totalSessions: number;
  totalDrivers: number;
  totalTracks: number;
  recentSessions: SessionWithRelations[];
}
