import { getSessionWithLaps } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { notFound } from 'next/navigation';
import CoachNotes from '@/components/ui/CoachNotes';
import Sparkline from '@/components/analytics/Sparkline';
import Link from 'next/link';
import {
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
  MIN_LAPS_FOR_INSIGHTS,
} from '@/lib/insights';
import { cleanLaps } from '@/lib/analytics-v2';
import EmptyInsights from '@/components/analytics/EmptyInsights';
import AICoachingCard from '@/components/coaching/AICoachingCard';
import LapAnalysisChart from '@/components/charts/LapAnalysisChart';
import LapAnalysisTable from '@/components/analytics/LapAnalysisTable';
import SessionPatterns from '@/components/analytics/SessionPatterns';
import { Tabs } from '@/components/ui/Tabs';
import ShareSessionButton from '@/components/ui/ShareSessionButton';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { MapPin, ArrowLeft } from 'lucide-react';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

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
  const lapTimes = laps.map(lap => lap.lap_time_ms).filter((t): t is number => t != null && t > 0);
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

  const showInsights = laps.length >= MIN_LAPS_FOR_INSIGHTS;

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Link
                href="/sessions"
                className="text-accent-primary hover:text-accent-primary/80 text-sm flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Sessions
              </Link>
              <ShareSessionButton />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-primary">
                {session.track?.name || 'Session Detail'}
              </h1>
              {session.source && <SourceBadge source={session.source} size="md" />}
            </div>
            <p className="text-muted mt-2 text-sm md:text-base">
              {formatDriverName(session.driver?.name || 'Unknown Driver')} • {formatDate(session.date)}
            </p>
            {session.track?.location && (
              <p className="text-text-subtle mt-1 text-sm flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {session.track.location}
              </p>
            )}
          </div>

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
          {laps.length > 0 && (
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
                              ? `±${consistencySeconds.toFixed(1)}s`
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
                        bestLapTime={bestLapMs!}
                        consistencySeconds={consistencySeconds}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyInsights lapCount={laps.length} minimumRequired={MIN_LAPS_FOR_INSIGHTS} />
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
