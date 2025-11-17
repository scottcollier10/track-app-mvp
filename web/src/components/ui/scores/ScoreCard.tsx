/**
 * ScoreCard Component
 *
 * Displays a score (0-100) with optional label, description, and trend indicator.
 * Used for consistency scores, driving behavior, match scores, quality scores, etc.
 */

import { getScoreLabel, getVariantColor, type ScoreVariant } from '@/lib/scores';
import ScoreChip from './ScoreChip';

export interface ScoreCardProps {
  label: string; // "Consistency", "Match Score", etc.
  score: number; // 0-100
  scoreLabel?: string; // "Excellent", "Strong", etc. (auto-generated if not provided)
  description?: string; // Helper text
  trend?: 'up' | 'down' | 'stable'; // Optional trend indicator
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const TREND_COLORS = {
  up: 'text-green-400',
  down: 'text-red-400',
  stable: 'text-gray-400',
};

export default function ScoreCard({
  label,
  score,
  scoreLabel,
  description,
  trend,
  size = 'md',
  className = '',
}: ScoreCardProps) {
  // Auto-generate score label if not provided
  const computedScoreLabel = scoreLabel || getScoreLabel(score);
  const variant =
    typeof computedScoreLabel === 'string'
      ? getScoreLabel(score).variant
      : computedScoreLabel.variant;

  // Size classes
  const sizeClasses = {
    sm: {
      score: 'text-2xl',
      label: 'text-xs',
      chip: 'sm' as const,
      description: 'text-xs',
    },
    md: {
      score: 'text-3xl',
      label: 'text-sm',
      chip: 'md' as const,
      description: 'text-xs',
    },
    lg: {
      score: 'text-4xl',
      label: 'text-base',
      chip: 'md' as const,
      description: 'text-sm',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg p-6 ${className}`}
    >
      {/* Label */}
      <div className={`${sizes.label} text-gray-400 mb-2 flex items-center justify-between`}>
        <span>{label}</span>
        {trend && (
          <span className={`font-bold ${TREND_COLORS[trend]}`}>
            {TREND_ICONS[trend]}
          </span>
        )}
      </div>

      {/* Score */}
      <div className={`${sizes.score} font-bold mb-2`}>
        {Math.round(score)}
        <span className="text-gray-600">/100</span>
      </div>

      {/* Score Label Chip */}
      <div className="mb-2">
        <ScoreChip
          label={
            typeof computedScoreLabel === 'string'
              ? computedScoreLabel
              : computedScoreLabel.label
          }
          variant={variant}
          size={sizes.chip}
        />
      </div>

      {/* Description */}
      {description && (
        <div className={`${sizes.description} text-gray-500 mt-2`}>
          {description}
        </div>
      )}
    </div>
  );
}
