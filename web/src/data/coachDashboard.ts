/**
 * Coach Dashboard Data Layer
 *
 * Fetches sessions from Supabase and rolls them up into one row per student
 * using the pure analytics-v2 core. I/O and computation are kept separate:
 * `getCoachDashboardData` handles fetch + normalization; `buildStudents` is a
 * pure, unit-testable transform.
 */

import { createServerSupabase } from '@/lib/supabase/server';
import { evaluateStudent } from '@/lib/analytics-v2';
import type {
  Flag,
  StudentHistory,
  StudentSession,
} from '@/lib/analytics-v2';

/**
 * A single normalized session, flattened from the Supabase query.
 * One row per session (a driver may have many).
 */
export interface SessionRow {
  driverId: string;
  driverName: string;
  driverEmail: string;
  experienceLevel: string | null; // from driver_profiles, may be null
  trackId: string;
  trackName: string;
  date: string;
  bestLapMs: number | null;
  lapTimesMs: Array<number | null>; // this session's lap_time_ms values
  sectorData: Array<Record<string, number> | null>; // this session's per-lap sector_data
}

/**
 * Rolled-up student row for the coach dashboard.
 * ONE ROW PER DRIVER. Replaces the legacy CoachDashboardDriver.
 */
export interface CoachDashboardStudent {
  driverId: string;
  driverName: string;
  driverEmail: string;
  runGroup: string; // experience_level, default 'beginner' when null
  lastTrackName: string;
  bestLapMs: number | null;
  avgBestLapMs: number | null;
  sessionConsistencySeconds: number | null; // latest session std-dev in seconds
  sessionCount: number;
  totalLaps: number;
  lastSessionDate: string | null;
  flags: Flag[];
  severityScore: number;
  baselineState: 'ok' | 'building';
  sparkline: number[];
  ready: boolean;
  readyWhy: string | null;
}

/**
 * @deprecated Legacy shape kept only so the not-yet-rewritten coach UI
 * (Phase C) keeps compiling. Do not add new consumers. Removed in Phase E.
 */
export interface CoachDashboardDriver {
  driverId: string;
  driverName: string;
  driverEmail: string;
  lastTrackName: string;
  bestLapMs: number | null;
  avgBestLapMs: number | null;
  consistencyScore: number | null;
  behaviorScore: number | null;
  sessionCount: number;
  totalLaps: number;
  lastSessionDate: string | null;
  isImproving: boolean;
  improvementPct: number | null;
}

const DEFAULT_RUN_GROUP = 'beginner';

/**
 * Pure transform: group normalized session rows by driver, evaluate each
 * driver's history via analytics-v2, and roll up into dashboard rows.
 */
export function buildStudents(rows: SessionRow[]): CoachDashboardStudent[] {
  const byDriver = new Map<string, SessionRow[]>();
  for (const r of rows) {
    const existing = byDriver.get(r.driverId);
    if (existing) existing.push(r);
    else byDriver.set(r.driverId, [r]);
  }

  const students: CoachDashboardStudent[] = [];

  for (const [driverId, driverRows] of byDriver) {
    const first = driverRows[0];

    const runGroup =
      first.experienceLevel && first.experienceLevel.trim() !== ''
        ? first.experienceLevel
        : DEFAULT_RUN_GROUP;

    const sessions: StudentSession[] = driverRows.map((r) => ({
      date: r.date,
      trackId: r.trackId,
      bestLapMs: r.bestLapMs,
      lapTimesMs: r.lapTimesMs,
      sectorData: r.sectorData,
    }));

    const history: StudentHistory = { runGroup, sessions };
    const evaluation = evaluateStudent(history);

    // Latest session by date (string dates sort/compare lexically here via Date).
    const latestRow = driverRows.reduce((latest, r) =>
      new Date(r.date) > new Date(latest.date) ? r : latest
    );

    // Best lap = min non-null session best across all sessions.
    const sessionBests = driverRows
      .map((r) => r.bestLapMs)
      .filter((v): v is number => v !== null && v > 0);
    const bestLapMs = sessionBests.length > 0 ? Math.min(...sessionBests) : null;

    // Average best lap = rounded mean of non-null session bests.
    const avgBestLapMs =
      sessionBests.length > 0
        ? Math.round(
            sessionBests.reduce((sum, v) => sum + v, 0) / sessionBests.length
          )
        : null;

    // Total positive laps across all sessions.
    const totalLaps = driverRows.reduce(
      (sum, r) =>
        sum +
        r.lapTimesMs.filter((t): t is number => t !== null && t > 0).length,
      0
    );

    students.push({
      driverId,
      driverName: first.driverName || 'Unknown',
      driverEmail: first.driverEmail || '',
      runGroup,
      lastTrackName: latestRow.trackName || 'Unknown',
      bestLapMs,
      avgBestLapMs,
      sessionConsistencySeconds: evaluation.sessionConsistencySeconds,
      sessionCount: driverRows.length,
      totalLaps,
      lastSessionDate: latestRow.date,
      flags: evaluation.flags,
      severityScore: evaluation.severityScore,
      baselineState: evaluation.baselineState,
      sparkline: evaluation.sparkline,
      ready: evaluation.ready,
      readyWhy: evaluation.readyWhy,
    });
  }

  return students;
}

/**
 * Normalize a single Supabase relation value that may come back as an array
 * or a single object, returning the first element (or null).
 */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  return value ?? null;
}

/** Shape of the nested rows returned by the dashboard select. */
interface FetchedLap {
  lap_time_ms: number | null;
  sector_data: unknown | null;
}
interface FetchedDriverProfile {
  experience_level: string | null;
}
interface FetchedDriver {
  id: string;
  name: string | null;
  email: string | null;
  driver_profiles: FetchedDriverProfile | FetchedDriverProfile[] | null;
}
interface FetchedTrack {
  id: string;
  name: string | null;
  location: string | null;
}
interface FetchedSession {
  id: string;
  date: string;
  best_lap_ms: number | null;
  source: string | null;
  driver: FetchedDriver | FetchedDriver[] | null;
  track: FetchedTrack | FetchedTrack[] | null;
  laps: FetchedLap[] | null;
}

/** Coerce a raw sector_data JSON value into Record<string, number> | null. */
function normalizeSectorData(
  raw: unknown
): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Get coach dashboard data: one rolled-up row per student.
 * Fetches → normalizes into SessionRow[] → buildStudents.
 */
export async function getCoachDashboardData(): Promise<{
  data: CoachDashboardStudent[] | null;
  error: Error | null;
}> {
  try {
    const supabase = createServerSupabase();

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(
        `
        id,
        date,
        best_lap_ms,
        source,
        driver:drivers(id, name, email, driver_profiles(experience_level)),
        track:tracks(id, name, location),
        laps!left(lap_time_ms, sector_data)
      `
      )
      .order('date', { ascending: false });

    if (error) {
      console.error('[getCoachDashboardData] Error fetching sessions:', error);
      return { data: null, error: new Error(error.message) };
    }

    if (!sessions || sessions.length === 0) {
      return { data: [], error: null };
    }

    const rows: SessionRow[] = [];

    for (const raw of sessions as unknown as FetchedSession[]) {
      const driver = firstOf(raw.driver);
      const track = firstOf(raw.track);
      if (!driver?.id) continue;

      const profile = firstOf(driver.driver_profiles);
      const laps = raw.laps ?? [];

      rows.push({
        driverId: driver.id,
        driverName: driver.name ?? 'Unknown',
        driverEmail: driver.email ?? '',
        experienceLevel: profile?.experience_level ?? null,
        trackId: track?.id ?? '',
        trackName: track?.name ?? 'Unknown',
        date: raw.date,
        bestLapMs: raw.best_lap_ms,
        lapTimesMs: laps.map((l) => l.lap_time_ms),
        sectorData: laps.map((l) => normalizeSectorData(l.sector_data)),
      });
    }

    return { data: buildStudents(rows), error: null };
  } catch (err) {
    console.error('[getCoachDashboardData] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
