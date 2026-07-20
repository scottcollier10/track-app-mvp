import { AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import type { Flag } from '@/lib/analytics-v2';

interface FlagChipProps {
  flag: Flag;
}

const LABELS: Record<Flag['kind'], string> = {
  faded: 'Faded',
  regressed: 'Off PB',
  off_baseline: 'Scattered',
};

const ICONS: Record<Flag['kind'], typeof AlertTriangle> = {
  faded: TrendingDown,
  regressed: AlertTriangle,
  off_baseline: Activity,
};

/** Signed delta in tenths, e.g. +0.9s. Empty when the delta rounds to zero. */
function formatDelta(deltaSeconds: number): string {
  const rounded = Math.round(deltaSeconds * 10) / 10;
  if (rounded === 0) return '';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}s`;
}

/**
 * Small pill summarizing a fired flag. Amber by default; red when the flag is
 * sustained across sessions. Colour is always paired with an icon + text label
 * so it reads without relying on colour alone (colourblind-safe).
 */
export function FlagChip({ flag }: FlagChipProps) {
  const Icon = ICONS[flag.kind];
  const label = LABELS[flag.kind];
  const delta = formatDelta(flag.deltaSeconds);

  const tone = flag.sustained
    ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
    : 'border-amber-500/50 bg-amber-500/10 text-amber-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      title={flag.why}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span>{label}</span>
      {delta && <span className="font-mono opacity-90">{delta}</span>}
    </span>
  );
}
