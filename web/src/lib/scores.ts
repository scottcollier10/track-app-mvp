/**
 * Score Utilities - Unified scoring system for all products
 *
 * Provides consistent score labels, colors, and variants across:
 * - Track App (consistency, behavior, pace)
 * - JobBot (match scores)
 * - Content Ops Copilot (quality scores)
 */

export type ScoreVariant = 'excellent' | 'strong' | 'moderate' | 'needs-work' | 'poor';

/**
 * Color mappings for score variants
 */
export const SCORE_COLORS = {
  excellent: 'text-emerald-400',
  strong: 'text-green-400',
  moderate: 'text-yellow-400',
  'needs-work': 'text-amber-400',
  poor: 'text-red-400',
} as const;

/**
 * Background color mappings for score chips
 */
export const SCORE_BG_COLORS = {
  excellent: 'bg-emerald-400/10 border-emerald-400/20',
  strong: 'bg-green-400/10 border-green-400/20',
  moderate: 'bg-yellow-400/10 border-yellow-400/20',
  'needs-work': 'bg-amber-400/10 border-amber-400/20',
  poor: 'bg-red-400/10 border-red-400/20',
} as const;

/**
 * Get label and variant for a score (0-100)
 *
 * @param score - Numeric score from 0-100
 * @returns Object with label, variant, and color class
 */
export function getScoreLabel(score: number): {
  label: string;
  variant: ScoreVariant;
  colorClass: string;
} {
  if (score >= 90) {
    return {
      label: 'Excellent',
      variant: 'excellent',
      colorClass: SCORE_COLORS.excellent,
    };
  }

  if (score >= 80) {
    return {
      label: 'Strong',
      variant: 'strong',
      colorClass: SCORE_COLORS.strong,
    };
  }

  if (score >= 70) {
    return {
      label: 'Moderate',
      variant: 'moderate',
      colorClass: SCORE_COLORS.moderate,
    };
  }

  if (score >= 60) {
    return {
      label: 'Needs Work',
      variant: 'needs-work',
      colorClass: SCORE_COLORS['needs-work'],
    };
  }

  return {
    label: 'Poor',
    variant: 'poor',
    colorClass: SCORE_COLORS.poor,
  };
}

/**
 * Get color class for a variant
 */
export function getVariantColor(variant: ScoreVariant): string {
  return SCORE_COLORS[variant];
}

/**
 * Get background color class for a variant
 */
export function getVariantBgColor(variant: ScoreVariant): string {
  return SCORE_BG_COLORS[variant];
}
