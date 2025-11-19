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
  up: { icon: TrendingUp, color: 'text-emerald-500' },
  down: { icon: TrendingDown, color: 'text-red-500' },
  neutral: { icon: Minus, color: 'text-slate-400' },
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
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-blue-500" />
        <span className="text-xs md:text-sm uppercase tracking-wide text-slate-400 font-medium">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl md:text-3xl font-semibold tabular-nums ${
            highlight ? 'text-emerald-500' : 'text-slate-100'
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
        <p className="mt-2 text-xs md:text-sm text-slate-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export { MetricCard };
export type { MetricCardProps, TrendDirection };
