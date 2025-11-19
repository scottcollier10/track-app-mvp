import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
  };
  highlight?: boolean;
}

const trendConfig: Record<TrendDirection, { icon: LucideIcon; color: string }> = {
  up: { icon: TrendingUp, color: 'text-status-success' },
  down: { icon: TrendingDown, color: 'text-status-critical' },
  neutral: { icon: Minus, color: 'text-muted' },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  trend,
  highlight = false,
}: MetricCardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;

  return (
    <div className="bg-surface border border-subtle rounded-xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent-secondary" />
        <span className="text-xs md:text-sm uppercase tracking-wide text-muted">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl md:text-3xl font-semibold font-mono ${
            highlight ? 'text-status-success' : 'text-primary'
          }`}
        >
          {value}
        </span>

        {trend && TrendIcon && (
          <span className={`flex items-center gap-1 text-xs ${trendConfig[trend.direction].color}`}>
            <TrendIcon className="w-3 h-3" />
            {trend.value}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-2 text-xs md:text-sm text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

export { MetricCard };
export type { MetricCardProps, TrendDirection };
