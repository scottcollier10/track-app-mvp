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

// Extended types with relations
export interface SessionWithRelations extends Session {
  driver: Driver;
  track: Track;
  laps: Lap[];
  coaching_notes?: CoachingNote[];
}

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
