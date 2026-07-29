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
 * fetch.
 *
 * Two rules this component must never break:
 *  - σ claims come only from dayConsistencyTrend, which owns the
 *    >=MIN_LAPS_FOR_INSIGHTS gate. No σ math is reimplemented here.
 *  - The trend is a signed pair of numbers, not a verdict. The app compares,
 *    the instructor concludes.
 */

import Link from 'next/link';
import type { SessionWithDetails } from '@/data/sessions';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import {
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
  sessions: SessionWithDetails[];
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
function groupByTrackDay(sessions: SessionWithDetails[]): DayGroup[] {
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
  // tracks on one date have a stable order.
  return Array.from(groups.values()).sort(
    (a, b) => b.date.localeCompare(a.date) || a.trackName.localeCompare(b.trackName)
  );
}

export default function TrackDayList({ sessions }: { sessions: SessionWithDetails[] }) {
  const days = groupByTrackDay(sessions);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Track Days</h2>

      <div className="space-y-3">
        {days.map((day) => {
          const bestLapMs = dayBestLapMs(
            day.sessions.map((s) => ({ bestLapMs: s.best_lap_ms }))
          );

          // Sessions arrive newest-first from /api/sessions. dayConsistencyTrend
          // sorts chronologically itself, so it is fed as-is — pre-sorting here
          // would just be a second place for the direction to go wrong.
          const trend = dayConsistencyTrend(
            day.sessions.map((s) => ({ date: s.date, lapTimesMs: s.lapTimesMs ?? [] }))
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
                    <p className="mt-1 font-mono text-sm text-primary">
                      {bestLapMs !== null ? formatLapMs(bestLapMs) : '--'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-subtle">
                      Consistency Trend
                    </p>
                    <p className="mt-1 text-sm text-primary">
                      {formatConsistencyTrend(trend) ?? '--'}
                    </p>
                    {!trend && (
                      // Say why there is no figure rather than leaving a bare
                      // dash to be read as "flat".
                      <p className="mt-0.5 text-xs text-text-subtle">
                        Needs two sessions of {MIN_LAPS_FOR_INSIGHTS}+ laps
                      </p>
                    )}
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
