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
export type FocusItem = Database['public']['Tables']['focus_items']['Row'];
export type FocusItemAssessment =
  Database['public']['Tables']['focus_item_assessments']['Row'];

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

/**
 * Session + the lap projection the /days/[id] query fetches — SessionWithLapTimes
 * plus `sector_data`, which the debrief sheet's ideal-lap delta reads. Mirrors
 * the exact `laps(lap_number, lap_time_ms, sector_data)` select, same discipline
 * as SessionWithLapTimes above. Assignable to SessionWithLapTimes, so everything
 * built for the narrower projection accepts these rows unchanged.
 */
export interface SessionWithLapDetail extends Session {
  laps: Pick<Lap, 'lap_number' | 'lap_time_ms' | 'sector_data'>[];
}

/** A day plus its ordered sessions. Driver is implied by context (e.g. the driver page). */
export interface TrackDayWithSessions extends TrackDay {
  track: Track;
  sessions: SessionWithLapTimes[];
}

/** Standalone day view (/days/[id]) — no ambient driver context, so it carries one, and its sessions carry the fuller lap projection the debrief sheet needs. */
export interface TrackDayDetail extends TrackDayWithSessions {
  driver: Driver;
  sessions: SessionWithLapDetail[];
}

/** A focus item with its full assessment history — the `focus_items(*, focus_item_assessments(*))` embed. */
export interface FocusItemWithAssessments extends FocusItem {
  focus_item_assessments: FocusItemAssessment[];
}

/**
 * A session a focus item references (as its origin, or as the anchor of one of
 * its assessments), carrying its DAY — mirrors the exact
 * `sessions(id, date, track_day:track_days(date, track:tracks(name)))` select.
 *
 * `track_day` is what the focus panel's origin label is read from: the day's
 * plain track-local calendar date and its track's name. The session's own
 * `date` (a timestamptz) exists for bySessionStart ordering ONLY — deriving a
 * label date from it renders in the runtime's timezone and can name the wrong
 * day. Null for a pre-day-model session that escaped the backfill; the label
 * then says nothing rather than inferring.
 */
export interface FocusOriginSession {
  id: string;
  date: string;
  track_day: { date: string; track: { name: string } } | null;
}

/**
 * Everything the day page's debrief flow needs in one fetch: the day, plus the
 * driver's focus items with assessments, plus the ORIGIN sessions those items'
 * created_after_session_id values point at, plus the sessions their
 * assessments anchor to. Origins are fetched by id, not assumed to be among
 * this day's sessions — an item created after a session at another track day
 * is still in play here, and its assessments can come from other days too.
 */
export interface TrackDayDebrief extends TrackDayDetail {
  focusItems: FocusItemWithAssessments[];
  originSessions: FocusOriginSession[];
  /**
   * id+date of every session the items' assessments point at — what orders
   * the focus panel's judgment timelines (assessmentsInSessionOrder).
   */
  assessmentSessions: Pick<Session, 'id' | 'date'>[];
}

/** DB CHECK constraint on sessions.representativeness. NULL = representative. */
export type Representativeness = 'representative' | 'partial' | 'not_representative';

/** DB CHECK constraint on focus_items.status. */
export type FocusItemStatus = 'active' | 'achieved' | 'paused' | 'dropped';

/** DB CHECK constraint on focus_item_assessments.judgment. */
export type AssessmentJudgment = 'improved' | 'keep_working' | 'no_change' | 'regressed';

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

/**
 * Response body of POST /api/import-session — the other half of
 * ImportSessionPayload's contract, kept beside it so a route change has one
 * place to land.
 *
 * `trackDayId` and `driverName` are returned by BOTH success paths: 201, and
 * the 207 "session created but some laps failed" path, which still created the
 * session and so still has a day worth linking to. The import panel's day links
 * depend on both; `web/src/app/api/import-session/__tests__/route.test.ts`
 * covers both paths.
 */
export interface ImportedSessionResponse {
  sessionId: string;
  trackDayId?: string | null;
  /**
   * `drivers.name` as stored in the DB for the driver this session was filed
   * under — NOT the name column of the CSV row that produced it. The two can
   * differ (a driver created by an import is named from the email local part,
   * and an existing driver's row may simply have been named differently), and
   * anything labelling a link to /days/[id] has to spell the driver the way
   * that page will.
   */
  driverName: string;
  message?: string;
  /** 207 only — why some laps did not import. */
  warning?: string;
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
