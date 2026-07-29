'use client';

/**
 * A driver's history as track days, newest first — the second hop of the app's
 * navigation spine: driver -> day -> session.
 *
 * This is the compact form of the day page's KPI row. Every number here is
 * produced by the same helper the day page calls (dayBestLapMs,
 * dayConsistencyTrend, formatConsistencyTrend), because a coach clicking a row
 * must land on a page that says exactly what the row said.
 *
 * Grouping happens client-side: the driver page is a client component that
 * already holds every session with its lap times, so a day list costs no extra
 * fetch. It is handed UNFILTERED sessions plus a day-granularity cutoff, never
 * a pre-filtered list — see the filter in the component body for why.
 *
 * Two rules this component must never break:
 *  - σ claims come only from dayConsistencyTrend, which owns the
 *    >=MIN_LAPS_FOR_INSIGHTS gate. No σ math is reimplemented here.
 *  - The trend is a signed pair of numbers, not a verdict. The app compares,
 *    the instructor concludes.
 */

import Link from 'next/link';
import type { SessionWithTrackDay } from '@/data/sessions';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import {
  CONSISTENCY_TREND_CLAIM,
  bySessionStart,
  dayBestLapMs,
  dayConsistencyTrend,
  formatConsistencyTrend,
  localDateForTimezone,
} from '@/lib/track-days';
import { formatLapMs, formatTrackDate } from '@/lib/time';

interface DayGroup {
  key: string;
  /** Null for an orphan group — see groupByTrackDay. */
  trackDayId: string | null;
  /** Plain track-local calendar date, YYYY-MM-DD. Never an instant. */
  date: string;
  trackName: string;
  sessions: SessionWithTrackDay[];
}

/**
 * Buckets sessions into days, newest day first.
 *
 * The key is the track day's id, so the grouping is exactly the one the
 * database made on import — not a second, subtly different definition of "day".
 *
 * A session with no track day shouldn't exist after the backfill, but if one
 * does it still has to appear somewhere. It falls back to a derived
 * date+track key using localDateForTimezone — the same function the import
 * uses — and the row links to a session instead of a day. Degraded, not
 * missing.
 */
function groupByTrackDay(sessions: SessionWithTrackDay[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const session of sessions) {
    const trackDay = session.track_day ?? null;

    // Sessions carry a timestamptz; a track day carries a track-local calendar
    // date. tracks.timezone is not on this payload, so the orphan fallback
    // derives the date the way an import with an unknown timezone would — one
    // derivation, used for both the group key and the label, so an orphan row
    // cannot be filed under one day and titled with another.
    const date = trackDay ? trackDay.date : localDateForTimezone(session.date, null);
    const key = trackDay ? trackDay.id : `orphan:${session.track?.id ?? 'unknown'}:${date}`;

    const existing = groups.get(key);
    if (existing) {
      existing.sessions.push(session);
      continue;
    }

    groups.set(key, {
      key,
      trackDayId: trackDay?.id ?? null,
      date,
      trackName: session.track?.name ?? 'Unknown Track',
      sessions: [session],
    });
  }

  // Newest day first. Plain YYYY-MM-DD sorts chronologically as a string, so no
  // Date parsing (and no timezone) is involved. Track name breaks ties so two
  // tracks on one date have a stable order, and the group key breaks the
  // remaining one: a real day and an orphan group at the same track and date
  // tie on both, and falling through to Map insertion order would let the two
  // rows swap places between renders.
  return Array.from(groups.values()).sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.trackName.localeCompare(b.trackName) ||
      a.key.localeCompare(b.key)
  );
}

export default function TrackDayList({
  sessions,
  cutoffDate,
}: {
  /** Every session in scope, UNFILTERED by date — see the grouping note below. */
  sessions: SessionWithTrackDay[];
  /**
   * Inclusive lower bound as a plain track-local calendar date (YYYY-MM-DD).
   * Null or undefined means no bound.
   */
  cutoffDate?: string | null;
}) {
  // Group FIRST, then drop whole days. Filtering sessions before grouping lets a
  // cutoff land in the middle of a track day and split it: the row would say
  // "2 sessions" with a σ trend over that subset while the day page one click
  // away says 4 and reports a different trend — the exact contradiction this
  // list exists to prevent.
  //
  // The comparison is date-granularity and string-only. day.date is a plain
  // calendar date with no instant attached; parsing it into a Date to compare
  // against a cutoff instant is what put "Jul 11" on a Jul 12 track day in the
  // first place (see formatTrackDate in @/lib/time). YYYY-MM-DD sorts
  // chronologically as a string, so no parsing is needed at all.
  const days = groupByTrackDay(sessions).filter(
    (day) => !cutoffDate || day.date >= cutoffDate
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Track Days</h2>

      {days.length === 0 && (
        <div className="rounded-lg border border-subtle bg-surface p-8 text-center">
          <p className="text-muted">
            {cutoffDate
              ? 'No track days in the selected time period.'
              : 'No track days yet. Import a session to start one.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {days.map((day) => {
          const bestLapMs = dayBestLapMs(
            day.sessions.map((s) => ({ bestLapMs: s.best_lap_ms }))
          );

          // Sessions arrive newest-first from /api/sessions. dayConsistencyTrend
          // sorts chronologically itself, so it is fed as-is — pre-sorting here
          // would just be a second place for the direction to go wrong.
          const trend = dayConsistencyTrend(
            day.sessions.map((s) => ({ id: s.id, date: s.date, lapTimesMs: s.lapTimesMs }))
          );

          const href = day.trackDayId
            ? `/days/${day.trackDayId}`
            : `/sessions/${[...day.sessions].sort(bySessionStart)[0].id}`;

          return (
            <Link
              key={day.key}
              href={href}
              className="block rounded-lg border border-subtle bg-surface p-4 transition-colors hover:border-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                <div>
                  <p className="font-semibold text-primary">{day.trackName}</p>
                  <p className="mt-1 text-sm text-muted">
                    {/* A plain calendar date, so formatTrackDate — never formatDate. */}
                    {formatTrackDate(day.date)} • {day.sessions.length}{' '}
                    {day.sessions.length === 1 ? 'session' : 'sessions'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-subtle">Best Lap</p>
                    <p data-testid="day-best-lap" className="mt-1 font-mono text-sm text-primary">
                      {bestLapMs !== null ? formatLapMs(bestLapMs) : '--'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-subtle">
                      Consistency Trend
                    </p>
                    <p data-testid="day-consistency-trend" className="mt-1 text-sm text-primary">
                      {formatConsistencyTrend(trend) ?? '--'}
                    </p>
                    {/* With a trend: the same qualifying-session caveat the day
                        page prints, from the same constant, so the compact view
                        cannot quietly make the bigger claim. Without one: why
                        there is no figure, rather than a bare dash to be read
                        as "flat". */}
                    <p className="mt-0.5 text-xs text-text-subtle">
                      {trend
                        ? CONSISTENCY_TREND_CLAIM
                        : `Needs two sessions of ${MIN_LAPS_FOR_INSIGHTS}+ laps`}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
