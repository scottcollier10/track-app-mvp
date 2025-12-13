/**
 * InsightsPanel Component
 *
 * Displays session analytics: Consistency Score, Pace Trend, Behavior Score
 */

import {
  calculateConsistencyScore,
  calculatePaceTrend,
  calculateBehaviorScore,
} from '@/lib/analytics';

interface InsightsPanelProps {
  laps: Array<{
    lap_number: number;
    lap_time_ms: number | null;
  }>;
}

function getConsistencyColor(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' };
  if (score >= 60) return { text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900' };
  return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900' };
}

function getPaceTrendColor(trend: string | null): { text: string; bg: string } {
  if (trend === 'improving') return { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' };
  if (trend === 'fading') return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900' };
  return { text: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900' };
}

function getBehaviorScoreColor(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' };
  if (score >= 60) return { text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900' };
  return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900' };
}

export default function InsightsPanel({ laps }: InsightsPanelProps) {
  const lapTimes = laps.map(lap => lap.lap_time_ms).filter((time): time is number => time !== null);

  const consistencyScore = calculateConsistencyScore(lapTimes);
  const paceTrend = calculatePaceTrend(lapTimes);
  const behaviorScore = calculateBehaviorScore(lapTimes);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-6">Session Insights</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Consistency Score */}
        <InsightCard
          title="Consistency"
          value={
            consistencyScore !== null ? `${consistencyScore}/100` : 'Not Enough Data'
          }
          description="Lap time variation"
          colors={
            consistencyScore !== null
              ? getConsistencyColor(consistencyScore)
              : { text: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900' }
          }
        />

        {/* Pace Trend */}
        <InsightCard
          title="Pace Trend"
          value={paceTrend || 'Not Enough Data'}
          description="First 3 vs last 3 laps"
          colors={getPaceTrendColor(paceTrend)}
        />

        {/* Behavior Score */}
        <InsightCard
          title="Driving Behavior"
          value={
            behaviorScore !== null ? `${behaviorScore}/100` : 'Not Enough Data'
          }
          description="Smoothness & control"
          colors={
            behaviorScore !== null
              ? getBehaviorScoreColor(behaviorScore)
              : { text: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900' }
          }
        />
      </div>

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Analytics calculated from valid lap times. Requires minimum 6 laps for pace trend.
        </p>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  description,
  colors,
}: {
  title: string;
  value: string;
  description: string;
  colors: { text: string; bg: string };
}) {
  return (
    <div className={`${colors.bg} rounded-lg p-4 border border-gray-200 dark:border-gray-700`}>
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {title}
      </div>
      <div className={`text-2xl font-bold ${colors.text} mb-1`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {description}
      </div>
    </div>
  );
}
