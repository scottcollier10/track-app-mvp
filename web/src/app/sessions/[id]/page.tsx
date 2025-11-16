import { getSessionWithLaps } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import LapTimeChart from '@/components/charts/LapTimeChart';
import AddNoteForm from '@/components/ui/AddNoteForm';
import CoachNotes from '@/components/ui/CoachNotes';
import Sparkline from '@/components/analytics/Sparkline';
import Link from 'next/link';
import {
  getSessionInsightsFromMs,
  getScoreLabel,
  INSIGHT_HELPERS,
} from '@/lib/insights';
import EmptyInsights from '@/components/analytics/EmptyInsights';

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
        <h1 className="text-3xl font-bold">Session Detail</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Session
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message || 'Failed to load session details.'}
          </p>
          <Link
            href="/sessions"
            className="inline-block mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            ← Back to Sessions
          </Link>
        </div>
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
    consistencyLabel: getScoreLabel(insightsData.consistencyScore || 0).label,
    drivingBehaviorLabel: getScoreLabel(insightsData.drivingBehaviorScore || 0).label,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/sessions"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Sessions
          </Link>
        </div>
        <h1 className="text-3xl font-bold">
          {session.track?.name || 'Session Detail'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {session.driver?.name || 'Unknown Driver'} • {formatDate(session.date)}
        </p>
        {session.track?.location && (
          <p className="text-gray-500 dark:text-gray-500 mt-1">
            📍 {session.track.location}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Time"
          value={formatDurationMs(session.total_time_ms)}
        />
        <StatCard
          label="Best Lap"
          value={session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
          highlight
        />
        <StatCard label="Laps" value={laps.length.toString()} />
      </div>

      {/* Session Insights */}
      {laps.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Session Insights</h2>
          
          {laps.length < 6 ? (
            <EmptyInsights lapCount={laps.length} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Consistency Card */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Consistency</div>
                <div className="text-3xl font-bold mb-1">{Math.round(insights.consistencyScore)}/100</div>
                <div className={`text-sm font-medium ${insights.consistencyLabel === 'Excellent' ? 'text-emerald-400' : insights.consistencyLabel === 'Strong' ? 'text-green-400' : insights.consistencyLabel === 'Needs Work' ? 'text-amber-400' : 'text-red-400'}`}>
                  {insights.consistencyLabel}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {INSIGHT_HELPERS.consistency}
                </div>
              </div>

              {/* Pace Trend Card with Sparkline */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Pace Trend</div>
                <div className={`text-lg font-bold mb-1 ${insights.paceTrendLabel.includes('Improving') ? 'text-green-400' : insights.paceTrendLabel.includes('Fading') ? 'text-amber-400' : 'text-gray-400'}`}>
                  {insights.paceTrendLabel}
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {insights.paceTrendDetail}
                </div>
                <Sparkline 
                  data={lapTimes}
                  height={40}
                  color={insights.paceTrendLabel.includes('Improving') ? '#10b981' : insights.paceTrendLabel.includes('Fading') ? '#f59e0b' : '#6b7280'}
                />
              </div>

              {/* Driving Behavior Card */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Driving Behavior</div>
                <div className="text-3xl font-bold mb-1">{Math.round(insights.drivingBehaviorScore)}/100</div>
                <div className={`text-sm font-medium ${insights.drivingBehaviorLabel === 'Excellent' ? 'text-emerald-400' : insights.drivingBehaviorLabel === 'Strong' ? 'text-green-400' : insights.drivingBehaviorLabel === 'Needs Work' ? 'text-amber-400' : 'text-red-400'}`}>
                  {insights.drivingBehaviorLabel}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {INSIGHT_HELPERS.behavior}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lap Time Chart */}
      {laps.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-4">Lap Times</h2>
          <LapTimeChart laps={laps} />
        </div>
      )}

      {/* Laps Table */}
      {laps.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">Laps</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {laps.map((lap: any) => {
                  const isBest = lap.lap_time_ms === session.best_lap_ms;
                  const delta = session.best_lap_ms
                    ? lap.lap_time_ms - session.best_lap_ms
                    : 0;
                  const deltaSeconds = delta / 1000;
                  const deltaFormatted = deltaSeconds >= 0 ? `+${deltaSeconds.toFixed(3)}` : deltaSeconds.toFixed(3);

                  return (
                    <tr key={lap.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium">{lap.lap_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">
                        <span
                          className={
                            isBest
                              ? 'text-green-600 dark:text-green-400 font-semibold'
                              : ''
                          }
                        >
                          {formatLapMs(lap.lap_time_ms)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                        {isBest ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            Best
                          </span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400">
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
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">
            No laps recorded for this session.
          </p>
        </div>
      )}

      {/* Coach Notes (Coach View Only) */}
      <CoachNotes sessionId={session.id} initialNotes={session.coach_notes} />
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {label}
      </div>
      <div
        className={`text-3xl font-mono font-bold ${
          highlight ? 'text-green-600 dark:text-green-400' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
