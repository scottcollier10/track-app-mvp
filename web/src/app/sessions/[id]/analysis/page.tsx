import { getSessionWithLaps } from '@/data/sessions';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ArrowLeft, Timer, TrendingUp, Target, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatLapMs, formatDurationMs } from '@/lib/time';
import { calculateConsistencyScore } from '@/lib/analytics';
import LapAnalysisChart from '@/components/charts/LapAnalysisChart';
import LapAnalysisTable from '@/components/analytics/LapAnalysisTable';
import SessionPatterns from '@/components/analytics/SessionPatterns';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function SessionAnalysisPage({ params }: PageProps) {
  const { data: session, error } = await getSessionWithLaps(params.id);

  if (error || !session || !session.laps || session.laps.length < 5) {
    notFound();
  }

  // Extract lap times
  const laps = session.laps;
  const lapTimes = laps.map(lap => lap.lap_time_ms);

  // Calculate statistics
  const bestLapTime = Math.min(...lapTimes);
  const slowestLapTime = Math.max(...lapTimes);
  const avgLapTime = lapTimes.reduce((sum, time) => sum + time, 0) / lapTimes.length;
  const totalSessionTime = lapTimes.reduce((sum, time) => sum + time, 0);

  // Calculate standard deviation for consistency
  const mean = avgLapTime;
  const squaredDiffs = lapTimes.map(time => Math.pow(time - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / lapTimes.length;
  const stdDev = Math.sqrt(variance);

  // Calculate consistency score (0-100, higher is better)
  const consistencyScore = calculateConsistencyScore(lapTimes) || 0;

  // Prepare chart data with consistency bands
  const chartData = laps.map((lap, index) => ({
    lap: lap.lap_number,
    time: lap.lap_time_ms / 1000, // Convert to seconds for display
    timeMs: lap.lap_time_ms,
    isBest: lap.lap_time_ms === bestLapTime,
    upperBand: (mean + stdDev) / 1000,
    lowerBand: (mean - stdDev) / 1000,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-app">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/sessions/${params.id}`}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Session
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-primary">
            Lap Analysis
          </h1>
          <p className="text-gray-600 dark:text-muted mt-1">
            {session.track?.name || 'Track Session'} • {laps.length} Laps
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={Target}
            label="Best Lap"
            value={formatLapMs(bestLapTime)}
            highlight={true}
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Lap"
            value={formatLapMs(avgLapTime)}
          />
          <MetricCard
            icon={Timer}
            label="Consistency"
            value={`${Math.round(consistencyScore)}%`}
          />
          <MetricCard
            icon={Clock}
            label="Total Time"
            value={formatDurationMs(totalSessionTime)}
          />
        </div>

        {/* Session Patterns */}
        <div className="mb-6">
          <SessionPatterns laps={laps} bestLapTime={bestLapTime} />
        </div>

        {/* Lap Time Chart with Consistency Bands */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-primary">
                Lap Time Progression
              </h2>
              <p className="text-sm text-gray-600 dark:text-muted">
                Performance over session with ±1σ consistency band
              </p>
            </CardHeader>
            <CardContent>
              <LapAnalysisChart
                data={chartData}
                bestLapTime={bestLapTime}
                stdDev={stdDev / 1000}
              />
            </CardContent>
          </Card>
        </div>

        {/* Detailed Lap Table */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-primary">
                Lap Details
              </h2>
              <p className="text-sm text-gray-600 dark:text-muted">
                Comprehensive lap-by-lap breakdown
              </p>
            </CardHeader>
            <CardContent>
              <LapAnalysisTable
                laps={laps}
                bestLapTime={bestLapTime}
                slowestLapTime={slowestLapTime}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
