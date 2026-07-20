'use client';

import type { DriverProgressData } from '@/data/driverProgress';
import { formatLapMs, formatDelta } from '@/lib/time';
import {
  consistencyBandState,
  formatConsistencySeconds,
  type ConsistencyBandState,
} from './consistencyBand';

interface ProgressStatsProps {
  progressData: DriverProgressData;
}

export default function ProgressStats({ progressData }: ProgressStatsProps) {
  const { firstEvent, latestEvent, deltas, events } = progressData;

  if (!firstEvent || !latestEvent) {
    return null;
  }

  const bandState = consistencyBandState(events.map((e) => e.consistencySeconds));

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {/* Card 1: Best Lap Progress */}
      {firstEvent.bestLapMs && latestEvent.bestLapMs ? (
        <ProgressionCard
          label="Best Lap Progress"
          value={formatLapMs(latestEvent.bestLapMs)}
          previousValue={formatLapMs(firstEvent.bestLapMs)}
          tone={deltas.bestLapDelta < 0 ? 'progress' : 'neutral'}
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
          tone="neutral"
          description="Insufficient data"
        />
      )}

      {/* Card 2: Consistency Trend (std-dev in seconds; lower = tighter) */}
      {firstEvent.consistencySeconds !== null && latestEvent.consistencySeconds !== null ? (
        <ProgressionCard
          label="Consistency Trend"
          value={`±${formatConsistencySeconds(latestEvent.consistencySeconds)}`}
          previousValue={`±${formatConsistencySeconds(firstEvent.consistencySeconds)}`}
          tone={
            bandState === 'better'
              ? 'progress'
              : bandState === 'worse'
              ? 'breakout'
              : 'neutral'
          }
          description={getConsistencyText(bandState)}
        />
      ) : (
        <ProgressionCard
          label="Consistency Trend"
          value="N/A"
          tone="neutral"
          description="Insufficient data"
        />
      )}

      {/* Card 3: Peak Performance Window */}
      {firstEvent.bestLapNumber && latestEvent.bestLapNumber ? (
        <ProgressionCard
          label="Peak Performance Window"
          value={`Lap ${latestEvent.bestLapNumber}`}
          previousValue={`Lap ${firstEvent.bestLapNumber}`}
          tone={deltas.lapNumberDelta < 0 ? 'progress' : 'neutral'}
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
          tone="neutral"
          description="Insufficient data"
        />
      )}
    </section>
  );
}

// Helper: baseline-aware consistency caption.
function getConsistencyText(state: ConsistencyBandState): string {
  if (state === 'better') return 'Tightening past their usual spread';
  if (state === 'worse') return 'Swinging wider than usual';
  return 'Holding their usual spread';
}

// Card tone: never green-by-default. Blue = progressing, amber = breakout, grey = neutral.
type CardTone = 'progress' | 'breakout' | 'neutral';

// Progression Card Component
interface ProgressionCardProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  tone: CardTone;
  description: string;
}

function ProgressionCard({
  label,
  value,
  previousValue,
  tone,
  description,
}: ProgressionCardProps) {
  const toneBadge = {
    progress: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
    breakout: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
    neutral: 'text-slate-300 border-slate-600/60 bg-slate-700/20',
  };

  const toneBorder = {
    progress: 'border-sky-400/40',
    breakout: 'border-amber-400/40',
    neutral: 'border-slate-800/80',
  };

  const toneIcon = {
    progress: '↘', // tighter / faster is downward movement
    breakout: '⚠',
    neutral: '→',
  };

  return (
    <div className={`rounded-2xl border ${toneBorder[tone]} bg-slate-900/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.75)]`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <div className="mb-3 flex items-baseline gap-3 flex-wrap">
        <span className="text-4xl font-bold text-slate-50">{value}</span>

        {previousValue && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${toneBadge[tone]}`}
            >
              {toneIcon[tone]} {previousValue}
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-300">{description}</p>
    </div>
  );
}
