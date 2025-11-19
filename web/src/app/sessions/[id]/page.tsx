import { getSessionWithLaps } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import LapTimeChart from '@/components/charts/LapTimeChart';
import AddNoteForm from '@/components/ui/AddNoteForm';
import CoachNotes from '@/components/ui/CoachNotes';
import SessionNotes from '@/components/ui/SessionNotes';
import Sparkline from '@/components/analytics/Sparkline';
import Link from 'next/link';
import {
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
} from '@/lib/insights';
import EmptyInsights from '@/components/analytics/EmptyInsights';
import AICoachingCard from '@/components/coaching/AICoachingCard';
import { ScoreCard } from '@/components/ui/scores';
import ShareSessionButton from '@/components/ui/ShareSessionButton';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Timer, Gauge, Hash, MapPin, ArrowLeft } from 'lucide-react';

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
    );
  }

  if (!session) {
    notFound();
  }

  const laps = session.laps || [];

  // Calculate session insights
  const lapTimes = laps.map(lap => lap.lap_time_ms).filter((t): t is number => t != null);
  const insightsData = getSessionInsightsFromMs(lapTimes);
  const insights = {
    consistencyScore: insightsData.consistencyScore || 0,
    drivingBehaviorScore: insightsData.drivingBehaviorScore || 0,
    paceTrendLabel: insightsData.paceTrendLabel,
    paceTrendDetail: insightsData.paceTrendDetail,
  };

  return (
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
        <h1 className="text-2xl md:text-3xl font-semibold text-primary">
          {session.track?.name || 'Session Detail'}
        </h1>
        <p className="text-muted mt-2 text-sm md:text-base">
          {session.driver?.name || 'Unknown Driver'} • {formatDate(session.date)}
        </p>
        {session.track?.location && (
          <p className="text-text-subtle mt-1 text-sm flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {session.track.location}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <MetricCard
          icon={Timer}
          label="Total Time"
          value={formatDurationMs(session.total_time_ms)}
        />
        <MetricCard
          icon={Gauge}
          label="Best Lap"
          value={session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
          highlight
        />
        <MetricCard
          icon={Hash}
          label="Laps"
          value={laps.length.toString()}
        />
      </div>

      {/* Session Insights */}
      {laps.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-primary">Session Insights</h2>

          {laps.length < 6 ? (
            <EmptyInsights lapCount={laps.length} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Consistency Card */}
              <ScoreCard
                label="Consistency"
                score={insights.consistencyScore}
                description={INSIGHT_HELPERS.consistency}
              />

              {/* Pace Trend Card with Sparkline */}
              <Card>
                <div className="text-xs md:text-sm text-muted uppercase tracking-wide mb-2">Pace Trend</div>
                <div className={`text-lg font-semibold mb-1 ${insights.paceTrendLabel.includes('Improving') ? 'text-status-success' : insights.paceTrendLabel.includes('Fading') ? 'text-status-warn' : 'text-muted'}`}>
                  {insights.paceTrendLabel}
                </div>
                <div className="text-xs text-text-subtle mb-3">
                  {insights.paceTrendDetail}
                </div>
                <Sparkline
                  data={lapTimes}
                  height={40}
                  color={insights.paceTrendLabel.includes('Improving') ? '#22C55E' : insights.paceTrendLabel.includes('Fading') ? '#FACC15' : '#6B7280'}
                />
              </Card>

              {/* Driving Behavior Card */}
              <ScoreCard
                label="Driving Behavior"
                score={insights.drivingBehaviorScore}
                description={INSIGHT_HELPERS.behavior}
              />
            </div>
          )}
        </div>
      )}

      {/* AI Coaching (Coach View Only) */}
      {laps.length >= 6 && (
        <AICoachingCard
          sessionId={session.id}
          initialCoaching={session.ai_coaching_summary}
        />
      )}

      {/* Lap Time Chart */}
      {laps.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold text-primary mb-4">Lap Times</h2>
          <LapTimeChart laps={laps} />
        </Card>
      )}

      {/* Laps Table */}
      {laps.length > 0 ? (
        <Card noPadding className="overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-subtle">
            <h2 className="text-xl font-semibold text-primary">Laps</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surfaceAlt">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    Lap
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    Time
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {laps.map((lap: any) => {
                  const isBest = lap.lap_time_ms === session.best_lap_ms;
                  const delta = session.best_lap_ms
                    ? lap.lap_time_ms - session.best_lap_ms
                    : 0;
                  const deltaSeconds = delta / 1000;
                  const deltaFormatted = deltaSeconds >= 0 ? `+${deltaSeconds.toFixed(3)}` : deltaSeconds.toFixed(3);

                  return (
                    <tr key={lap.id} className="hover:bg-surfaceAlt/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-primary">{lap.lap_number}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap font-mono">
                        <span
                          className={
                            isBest
                              ? 'text-status-success font-semibold'
                              : 'text-muted'
                          }
                        >
                          {formatLapMs(lap.lap_time_ms)}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono">
                        {isBest ? (
                          <span className="text-status-success font-semibold">
                            Best
                          </span>
                        ) : (
                          <span className="text-muted">
                            {deltaFormatted}s
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="py-8 text-center">
          <p className="text-muted">
            No laps recorded for this session.
          </p>
        </Card>
      )}

      {/* Session Notes */}
      <SessionNotes sessionId={session.id} initialNotes={session.notes} />

      {/* Coach Notes (Coach View Only) */}
      <CoachNotes sessionId={session.id} initialNotes={session.coach_notes} />
    </div>
  );
}
