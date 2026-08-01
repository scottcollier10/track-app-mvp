/**
 * Track day detail — one student's day at one track.
 *
 * The navigation hub of the app: driver page -> day list -> here -> session,
 * one click deeper. Everything above the fold answers "how did the day go,
 * session to session?".
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getTrackDayDebrief } from '@/data/track-days';
import {
  CONSISTENCY_TREND_CLAIM,
  dayAggregateAnnotation,
  dayBestLapMs,
  dayConsistencyTrend,
  formatConsistencyTrend,
  representativeSessions,
  validLapTimesMs,
} from '@/lib/track-days';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { formatTrackDate, formatLapMs } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';
import SessionProgressionStrip from '@/components/days/SessionProgressionStrip';
import FocusPanel from '@/components/days/FocusPanel';
import DayNotes from '@/components/days/DayNotes';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function TrackDayPage({ params }: PageProps) {
  // The debrief variant: the day plus the driver's focus items, their
  // assessments and origin sessions — everything the sheet writes against.
  const { data: day, error } = await getTrackDayDebrief(params.id);

  // Only a genuine query failure gets an error state.
  if (error) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-primary md:text-3xl">Track Day</h1>
            <Card className="border-status-critical/30 bg-status-critical/10">
              <h2 className="mb-2 font-semibold text-status-critical">Error Loading Track Day</h2>
              <p className="text-sm text-status-critical/80">
                {error.message || 'Failed to load this track day.'}
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // getTrackDayWithSessions uses .maybeSingle(), so a missing or RLS-invisible
  // id arrives as { data: null, error: null }. Absence is a 404, not a failure.
  if (!day) {
    notFound();
  }

  const sessions = day.sessions;

  // A day with zero sessions is a real row (a partially-failed import), so it
  // renders — it just has nothing to compare.
  //
  // representativeness rides along untouched: the exclusion rule lives in the
  // aggregate helpers (representativeSessions), never at a call site, so this
  // page and the driver page's day list cannot filter differently.
  const bestLapMs = dayBestLapMs(
    sessions.map((s) => ({ bestLapMs: s.best_lap_ms, representativeness: s.representativeness }))
  );

  // Feed dates in and let the helper sort: it reports first -> last
  // chronologically, so caller ordering can never flip the trend's direction.
  //
  // validLapTimesMs, not a raw laps.map: a 0 lap time reaches the database (see
  // its docblock), and mapping the rows straight through computed this KPI's σ
  // over laps the canClaimConsistency gate had already refused elsewhere.
  const trend = dayConsistencyTrend(
    sessions.map((s) => ({
      id: s.id,
      date: s.date,
      lapTimesMs: validLapTimesMs(s.laps),
      representativeness: s.representativeness,
    }))
  );

  // "(3 of 4 sessions)" when the flag excluded something, null when everything
  // counted — the same helper (and therefore the same caption) as the driver
  // page's day list. representativeSessions is the ONE exclusion rule; counting
  // any other way here would let this caption disagree with the KPIs it annotates.
  const annotation = dayAggregateAnnotation(
    sessions.length,
    representativeSessions(sessions).length
  );

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <Link
              href={`/drivers/${day.driver_id}`}
              className="mb-2 flex items-center gap-1 text-sm text-accent-primary hover:text-accent-primary/80"
            >
              <ArrowLeft className="h-4 w-4" />
              {formatDriverName(day.driver.name)}
            </Link>
            <h1 className="text-2xl font-semibold text-primary md:text-3xl">{day.track.name}</h1>
            <p className="mt-2 text-sm text-muted md:text-base">
              {/* track_days.date is a plain track-local calendar date, not an
                  instant — formatTrackDate, never formatDate. */}
              {formatTrackDate(day.date)} • {formatDriverName(day.driver.name)}
            </p>
            {day.track.location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-text-subtle">
                <MapPin className="h-4 w-4" />
                {day.track.location}
              </p>
            )}
          </div>

          {/* Day KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
            <MetricCard
              label="Sessions"
              value={sessions.length.toString()}
              helper={sessions.length === 1 ? 'Session on this day' : 'Sessions on this day'}
            />
            <MetricCard
              label="Best Lap"
              value={bestLapMs !== null ? formatLapMs(bestLapMs) : '--'}
              helper={annotation ? `Fastest lap of the day ${annotation}` : 'Fastest lap of the day'}
            />
            <MetricCard
              label="Consistency Trend"
              value={formatConsistencyTrend(trend) ?? '--'}
              helper={
                trend
                  ? annotation
                    ? `${CONSISTENCY_TREND_CLAIM} ${annotation}`
                    : CONSISTENCY_TREND_CLAIM
                  : `Needs two sessions of ${MIN_LAPS_FOR_INSIGHTS}+ laps`
              }
            />
          </div>

          {/* Session progression */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Session Progression</h2>
            {sessions.length > 0 ? (
              <SessionProgressionStrip
                sessions={sessions}
                debrief={{
                  driverId: day.driver_id,
                  dayDate: day.date,
                  trackTimezone: day.track.timezone,
                  focusItems: day.focusItems,
                  originSessions: day.originSessions,
                }}
              />
            ) : (
              <Card className="py-8 text-center">
                <p className="text-muted">No sessions recorded for this track day.</p>
              </Card>
            )}
          </div>

          {/* Zone 2 — the focus panel: read/manage only. Assessments happen in
              a session's debrief sheet (above), never here. */}
          <FocusPanel
            driverId={day.driver_id}
            daySessionIds={sessions.map((s) => s.id)}
            focusItems={day.focusItems}
            originSessions={day.originSessions}
            assessmentSessions={day.assessmentSessions}
          />

          {/* Zone 3 — the day notes scratchpad. Debounced autosave with
              flush-on-leave; the Phase 3 summary slot renders above this. */}
          <DayNotes dayId={day.id} initialNotes={day.notes} />
        </div>
      </div>
    </div>
  );
}
