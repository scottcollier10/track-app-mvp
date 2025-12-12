'use client';

import { DriverProgressData } from '@/data/driverProgress';
import { formatLapMs, formatDelta } from '@/lib/time';

interface ProgressStatsProps {
  progressData: DriverProgressData;
}

export default function ProgressStats({ progressData }: ProgressStatsProps) {
  const { firstEvent, latestEvent, deltas } = progressData;

  if (!firstEvent || !latestEvent) {
    return null;
  }

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {/* Card 1: Best Lap Progress */}
      {firstEvent.bestLapMs && latestEvent.bestLapMs ? (
        <ProgressionCard
          label="Best Lap Progress"
          value={formatLapMs(latestEvent.bestLapMs)}
          previousValue={formatLapMs(firstEvent.bestLapMs)}
          trend={deltas.bestLapDelta < 0 ? 'up' : deltas.bestLapDelta > 0 ? 'down' : 'neutral'}
          description={
            deltas.bestLapDelta < 0
              ? `${formatDelta(Math.abs(deltas.bestLapDelta))} faster than first session`
              : deltas.bestLapDelta > 0
              ? `${formatDelta(deltas.bestLapDelta)} slower than first session`
              : 'Same as first session'
          }
        />
      ) : (
        <ProgressionCard
          label="Best Lap Progress"
          value="N/A"
          trend="neutral"
          description="Insufficient data"
        />
      )}

      {/* Card 2: Consistency Trend */}
      {firstEvent.consistency !== null && latestEvent.consistency !== null ? (
        <ProgressionCard
          label="Consistency Trend"
          value={latestEvent.consistency.toString()}
          previousValue={firstEvent.consistency.toString()}
          unit="/100"
          trend={
            deltas.consistencyDelta > 0
              ? 'up'
              : deltas.consistencyDelta < 0
              ? 'down'
              : 'neutral'
          }
          description={getConsistencyText(deltas.consistencyDelta)}
        />
      ) : (
        <ProgressionCard
          label="Consistency Trend"
          value="N/A"
          trend="neutral"
          description="Insufficient data"
        />
      )}

      {/* Card 3: Peak Performance Window */}
      {firstEvent.bestLapNumber && latestEvent.bestLapNumber ? (
        <ProgressionCard
          label="Peak Performance Window"
          value={`Lap ${latestEvent.bestLapNumber}`}
          previousValue={`Lap ${firstEvent.bestLapNumber}`}
          trend={
            deltas.lapNumberDelta < 0
              ? 'up'
              : deltas.lapNumberDelta > 0
              ? 'down'
              : 'neutral'
          }
          description={
            deltas.lapNumberDelta < 0
              ? 'Finding peak performance earlier'
              : deltas.lapNumberDelta > 0
              ? 'Taking longer to reach peak'
              : 'Same warm-up pace'
          }
        />
      ) : (
        <ProgressionCard
          label="Peak Performance Window"
          value="N/A"
          trend="neutral"
          description="Insufficient data"
        />
      )}
    </section>
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

// Progression Card Component
interface ProgressionCardProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  unit?: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
}

function ProgressionCard({
  label,
  value,
  previousValue,
  unit = '',
  trend,
  description,
}: ProgressionCardProps) {
  const trendColors = {
    up: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
    down: 'text-rose-400 border-rose-400/40 bg-rose-400/10',
    neutral: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
  };

  const trendBorderColors = {
    up: 'border-emerald-400/40',
    down: 'border-rose-400/40',
    neutral: 'border-sky-400/40',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→',
  };

  return (
    <div className={`rounded-2xl border ${trendBorderColors[trend]} bg-slate-900/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.75)]`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <div className="mb-3 flex items-baseline gap-3 flex-wrap">
        <span className="text-4xl font-bold text-slate-50">
          {value}
          {unit && <span className="text-2xl text-slate-400">{unit}</span>}
        </span>

        {previousValue && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${trendColors[trend]}`}
            >
              {trendIcons[trend]} {previousValue}{unit}
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-300">{description}</p>
    </div>
  );
}
