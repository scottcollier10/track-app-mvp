'use client';

import { DriverProgressData } from '@/data/driverProgress';
import { formatLapMs, formatDelta } from '@/lib/time';
import { getConsistencyColor } from '@/lib/analytics';

interface ProgressStatsProps {
  progressData: DriverProgressData;
}

export default function ProgressStats({ progressData }: ProgressStatsProps) {
  const { firstEvent, latestEvent, deltas } = progressData;

  if (!firstEvent || !latestEvent) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Container 1: Best Lap Progress */}
      <StatContainer
        label="Best Lap Progress"
        value={
          firstEvent.bestLapMs && latestEvent.bestLapMs
            ? formatDelta(deltas.bestLapDelta)
            : 'N/A'
        }
        subtext={
          firstEvent.bestLapMs && latestEvent.bestLapMs
            ? `${formatLapMs(firstEvent.bestLapMs)} → ${formatLapMs(latestEvent.bestLapMs)}`
            : 'Insufficient data'
        }
        trend={deltas.bestLapDelta < 0 ? 'improving' : deltas.bestLapDelta > 0 ? 'declining' : 'stable'}
      />

      {/* Container 2: Consistency Score */}
      <StatContainer
        label="Consistency Score"
        value={
          firstEvent.consistency !== null && latestEvent.consistency !== null
            ? `${firstEvent.consistency} → ${latestEvent.consistency}`
            : 'N/A'
        }
        subtext={getConsistencyText(deltas.consistencyDelta)}
        consistencyScore={latestEvent.consistency}
      />

      {/* Container 3: Pace Trend */}
      <StatContainer
        label="Pace Trend"
        value={
          firstEvent.bestLapNumber && latestEvent.bestLapNumber
            ? `Lap ${firstEvent.bestLapNumber} → Lap ${latestEvent.bestLapNumber}`
            : 'N/A'
        }
        subtext={
          firstEvent.bestLapNumber && latestEvent.bestLapNumber
            ? deltas.lapNumberDelta < 0
              ? 'Finding pace sooner'
              : deltas.lapNumberDelta > 0
              ? 'Taking longer to warm up'
              : 'Same warm-up pace'
            : 'Insufficient data'
        }
        trend={deltas.lapNumberDelta < 0 ? 'improving' : deltas.lapNumberDelta > 0 ? 'declining' : 'stable'}
      />

      {/* Container 4: Peak Performance Window */}
      <StatContainer
        label="Peak Performance"
        value={`${firstEvent.lapCount} → ${latestEvent.lapCount} laps`}
        subtext={
          latestEvent.lapCount > firstEvent.lapCount
            ? 'More seat time'
            : latestEvent.lapCount < firstEvent.lapCount
            ? 'Fewer laps per session'
            : 'Consistent session length'
        }
        trend={latestEvent.lapCount >= firstEvent.lapCount ? 'improving' : 'stable'}
      />
    </div>
  );
}

// Helper function for consistency text
function getConsistencyText(delta: number): string {
  if (delta >= 10) return 'Much more repeatable';
  if (delta >= 5) return 'More consistent';
  if (delta <= -10) return 'Much less consistent';
  if (delta <= -5) return 'Less consistent';
  return 'Similar consistency';
}

// Sub-component: Individual stat container
interface StatContainerProps {
  label: string;
  value: string;
  subtext: string;
  trend?: 'improving' | 'declining' | 'stable';
  consistencyScore?: number | null;
}

function StatContainer({ label, value, subtext, trend, consistencyScore }: StatContainerProps) {
  // Determine color based on trend or consistency score
  let valueColor = 'text-white';
  let borderColor = 'border-gray-700';

  if (consistencyScore !== undefined && consistencyScore !== null) {
    // Use consistency color coding
    if (consistencyScore >= 95) {
      valueColor = 'text-green-400';
      borderColor = 'border-green-500';
    } else if (consistencyScore >= 85) {
      valueColor = 'text-blue-400';
      borderColor = 'border-blue-500';
    } else if (consistencyScore >= 75) {
      valueColor = 'text-yellow-400';
      borderColor = 'border-yellow-500';
    } else {
      valueColor = 'text-red-400';
      borderColor = 'border-red-500';
    }
  } else if (trend) {
    // Use trend color coding
    if (trend === 'improving') {
      valueColor = 'text-green-400';
      borderColor = 'border-green-500';
    } else if (trend === 'declining') {
      valueColor = 'text-red-400';
      borderColor = 'border-red-500';
    } else {
      valueColor = 'text-blue-400';
      borderColor = 'border-blue-500';
    }
  }

  // Determine trend arrow
  let trendArrow = '';
  if (trend === 'improving') {
    trendArrow = '↑';
  } else if (trend === 'declining') {
    trendArrow = '↓';
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700 border-l-4 ${borderColor}`}>
      <p className="text-gray-400 text-sm mb-3 uppercase tracking-wide font-medium">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-3xl font-bold mb-2 ${valueColor}`}>{value}</p>
        {trendArrow && <span className={`text-xl ${valueColor}`}>{trendArrow}</span>}
      </div>
      <p className="text-sm text-gray-500">{subtext}</p>
    </div>
  );
}
