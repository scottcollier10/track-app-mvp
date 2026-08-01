import { getSessionWithLaps } from '@/data/sessions';
import { formatDate, formatTrackDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { notFound } from 'next/navigation';
import CoachNotes from '@/components/ui/CoachNotes';
import Sparkline from '@/components/analytics/Sparkline';
import Link from 'next/link';
import {
  canClaimConsistency,
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
  MIN_LAPS_FOR_INSIGHTS,
} from '@/lib/insights';
import { cleanLaps } from '@/lib/analytics-v2';
import { SIGMA_DISPLAY_DECIMALS, validLapTimesMs } from '@/lib/track-days';
import EmptyInsights from '@/components/analytics/EmptyInsights';
import AICoachingCard from '@/components/coaching/AICoachingCard';
import LapAnalysisChart from '@/components/charts/LapAnalysisChart';
import LapAnalysisTable from '@/components/analytics/LapAnalysisTable';
import SessionPatterns from '@/components/analytics/SessionPatterns';
import { Tabs } from '@/components/ui/Tabs';
import ShareSessionButton from '@/components/ui/ShareSessionButton';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { MapPin, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';
import EvidenceBanner from '@/components/sessions/EvidenceBanner';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { data: session, error } = await getSessionWithLaps(params.id);

  // Error state
  if (error) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-semibold text-primary">Session Detail</h1>
            <Card className="bg-status-critical/10 border-status-critical/30">
              <h3 className="text-status-critical font-semibold mb-2">
                Error Loading Session
              </h3>
              <p className="text-status-critical/80 text-sm">
                {error.message || 'Failed to load session details.'}
              </p>
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1 mt-4 text-sm text-status-critical hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sessions
              </Link>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    notFound();
  }

  const laps = session.laps || [];

  // ---- One pass of honest statistics for the whole page ----
  const lapTimes = validLapTimesMs(laps);
  const insights = getSessionInsightsFromMs(lapTimes);
  const consistencySeconds = insights.consistencySeconds;

  const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : null;
  const slowestLapMs = lapTimes.length > 0 ? Math.max(...lapTimes) : null;
  const avgLapMs = lapTimes.length > 0
    ? lapTimes.reduce((sum, t) => sum + t, 0) / lapTimes.length
    : null;

  // Band centre = clean-lap mean, width = analytics-v2 sigma (same number as the Consistency card)
  const clean = cleanLaps(lapTimes);
  const cleanMeanS = clean.length > 0
    ? clean.reduce((s, t) => s + t, 0) / clean.length / 1000
    : null;

  const chartData = laps.map((lap) => ({
    lap: lap.lap_number,
    time: lap.lap_time_ms / 1000,
    timeMs: lap.lap_time_ms,
    isBest: lap.lap_time_ms === bestLapMs,
    ...(consistencySeconds !== null && cleanMeanS !== null
      ? {
          upperBand: cleanMeanS + consistencySeconds,
          lowerBand: cleanMeanS - consistencySeconds,
        }
      : {}),
  }));

  // canClaimConsistency over lapTimes, not raw laps: every figure behind this
  // gate (σ, pace trend) is computed from lapTimes (validLapTimesMs output),
  // and counting raw rows instead let the page claim the six-lap minimum was
  // met while reporting a σ over five laps.
  const showInsights = canClaimConsistency(lapTimes);

  // Where this session sits in its track day. Null for a session with no day
  // (shouldn't exist post-backfill), in which case the header falls back to the
  // flat /sessions list exactly as before.
  const dayContext = session.dayContext;

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {/* Up one level in the navigation spine: driver -> day -> session.
                  The label is the day's own track name and PLAIN calendar date,
                  so it reads identically to the page it lands on (formatTrackDate,
                  never formatDate — see @/lib/time). */}
              {dayContext ? (
                <Link
                  href={`/days/${dayContext.trackDayId}`}
                  className="text-accent-primary hover:text-accent-primary/80 text-sm flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {dayContext.trackName} • {formatTrackDate(dayContext.date)}
                </Link>
              ) : (
                <Link
                  href="/sessions"
                  className="text-accent-primary hover:text-accent-primary/80 text-sm flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sessions
                </Link>
              )}
              <ShareSessionButton />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-primary">
                {session.track?.name || 'Session Detail'}
              </h1>
              {session.source && <SourceBadge source={session.source} size="md" />}
            </div>

            {/* "Session 2 of 4" + step through the day. Coaching happens BETWEEN
                sessions, so a coach walking S1 -> S4 never has to bounce back to
                the day page. The count comes from the same ordered list the day
                page numbers its cards from, so the two cannot disagree. */}
            {dayContext && (
              <div className="flex items-center gap-2 text-sm text-muted">
                {dayContext.prevSessionId && (
                  <Link
                    href={`/sessions/${dayContext.prevSessionId}`}
                    aria-label="Previous session"
                    className="text-accent-primary hover:text-accent-primary/80 p-2 -m-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                )}
                <span>
                  Session {dayContext.index + 1} of {dayContext.count}
                </span>
                {dayContext.nextSessionId && (
                  <Link
                    href={`/sessions/${dayContext.nextSessionId}`}
                    aria-label="Next session"
                    className="text-accent-primary hover:text-accent-primary/80 p-2 -m-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}

            {/* The DAY's date wins over the session's own timestamptz whenever we
                have one. track_days.date is the track-LOCAL calendar date the URL
                groups on — it is what decides which day this session belongs to.
                session.date is an instant rendered in the RUNTIME's timezone, so a
                02:00Z session west of UTC prints the previous day and this line
                would contradict the back-link 50px above it. Only fall back to the
                instant when there is no day to be authoritative. */}
            <p className="text-muted mt-2 text-sm md:text-base">
              {formatDriverName(session.driver?.name || 'Unknown Driver')} •{' '}
              {dayContext ? formatTrackDate(dayContext.date) : formatDate(session.date)}
            </p>
            {session.track?.location && (
              <p className="text-text-subtle mt-1 text-sm flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {session.track.location}
              </p>
            )}
          </div>

          {/* Evidence banner — facts plus present tense, under the day header.
              Both gates come from the data layer: no dayContext means no
              honest day date for the eligibility rule, and a degraded focus
              fetch means no banner rather than a wrong one. The component
              itself renders null when there is nothing to report. */}
          {dayContext && session.focus && (
            <EvidenceBanner
              focusItems={session.focus.focusItems}
              session={{ id: session.id, date: session.date }}
              originSessions={session.focus.originSessions}
              dayDate={dayContext.date}
              trackTimezone={session.track?.timezone ?? null}
            />
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <MetricCard
              label="Total Time"
              value={formatDurationMs(session.total_time_ms)}
              helper="Session duration"
            />
            <MetricCard
              label="Best Lap"
              value={session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
              helper="Fastest lap time"
            />
            <MetricCard
              label="Average Lap"
              value={avgLapMs !== null ? formatLapMs(avgLapMs) : '--'}
              helper="Average across all laps"
            />
            <MetricCard
              label="Laps"
              value={laps.length.toString()}
              helper="Total lap count"
            />
          </div>

          {/* Lap Time Progression */}
          {laps.length > 0 && bestLapMs !== null && (
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-primary">Lap Time Progression</h2>
                  {consistencySeconds !== null && (
                    <p className="text-sm text-muted">
                      Performance over session with ±1σ consistency band
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <LapAnalysisChart
                  data={chartData}
                  bestLapTime={bestLapMs}
                  stdDev={consistencySeconds}
                />
              </CardContent>
            </Card>
          )}

          {/* Lap Details */}
          {laps.length > 0 && bestLapMs !== null && slowestLapMs !== null ? (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-primary">Lap Details</h2>
              </CardHeader>
              <CardContent>
                <LapAnalysisTable
                  laps={laps}
                  bestLapTime={bestLapMs}
                  slowestLapTime={slowestLapMs}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="py-8 text-center">
              <p className="text-muted">No laps recorded for this session.</p>
            </Card>
          )}

          {/* Interpretive layer: Insights | Patterns */}
          {laps.length > 0 && bestLapMs !== null && (
            showInsights ? (
              <Tabs
                tabs={[
                  {
                    id: 'insights',
                    label: 'Session Insights',
                    content: (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Consistency Card */}
                        <Card>
                          <div className="text-xs md:text-sm text-muted uppercase tracking-wide mb-2">
                            Consistency
                          </div>
                          <div className="text-lg font-semibold mb-1 text-primary">
                            {consistencySeconds !== null
                              ? `±${consistencySeconds.toFixed(SIGMA_DISPLAY_DECIMALS)}s`
                              : '--'}
                          </div>
                          <div className="text-xs text-text-subtle">
                            {INSIGHT_HELPERS.consistency}
                          </div>
                        </Card>

                        {/* Pace Trend Card with Sparkline */}
                        <Card>
                          <div className="text-xs md:text-sm text-muted uppercase tracking-wide mb-2">Pace Trend</div>
                          <div className={`text-lg font-semibold mb-1 ${insights.paceTrendLabel === 'improving' ? 'text-status-success' : insights.paceTrendLabel === 'fading' ? 'text-status-warn' : 'text-muted'}`}>
                            {insights.paceTrendLabel.charAt(0).toUpperCase() + insights.paceTrendLabel.slice(1)}
                          </div>
                          <div className="text-xs text-text-subtle mb-3">
                            {insights.paceTrendDetail}
                          </div>
                          <Sparkline
                            data={lapTimes}
                            height={40}
                            color={insights.paceTrendLabel === 'improving' ? '#22C55E' : insights.paceTrendLabel === 'fading' ? '#FACC15' : '#6B7280'}
                          />
                        </Card>
                      </div>
                    ),
                  },
                  {
                    id: 'patterns',
                    label: 'Session Patterns',
                    content: (
                      <SessionPatterns
                        laps={laps}
                        bestLapTime={bestLapMs}
                        consistencySeconds={consistencySeconds}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              // lapTimes.length, because this panel explains the gate above and
              // has to count what the gate counted — "requires 6 laps, you have
              // 6" is what passing laps.length here would print.
              <EmptyInsights lapCount={lapTimes.length} minimumRequired={MIN_LAPS_FOR_INSIGHTS} />
            )
          )}

          {/* AI Coaching */}
          {showInsights && (
            <AICoachingCard
              sessionId={session.id}
              initialCoaching={session.ai_coaching_summary}
            />
          )}

          {/* Instructor Notes */}
          <CoachNotes sessionId={session.id} initialNotes={session.coach_notes} />
        </div>
      </div>
    </div>
  );
}
