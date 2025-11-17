/**
 * ScoreChip Component
 *
 * Small pill-shaped badge for displaying score labels.
 * Used standalone or within ScoreCard components.
 */

import { getVariantColor, getVariantBgColor, type ScoreVariant } from '@/lib/scores';

export interface ScoreChipProps {
  label: string; // "Excellent", "Strong", etc.
  variant?: ScoreVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ScoreChip({
  label,
  variant = 'moderate',
  size = 'md',
  className = '',
}: ScoreChipProps) {
  const colorClass = getVariantColor(variant);
  const bgColorClass = getVariantBgColor(variant);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`
        inline-flex items-center
        rounded-full border
        font-medium
        ${colorClass}
        ${bgColorClass}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {label}
    </span>
  );
}
