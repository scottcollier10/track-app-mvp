/**
 * Run-group display labels + banding, shared by the triage queue and roster.
 * Maps the raw `runGroup` string (experience_level) to instructor-corps bands.
 * Anything unrecognized falls back to Novice.
 */

export type RunGroupBand = 'beginner' | 'intermediate' | 'advanced';

export const RUN_GROUP_BANDS: RunGroupBand[] = [
  'beginner',
  'intermediate',
  'advanced',
];

export const RUN_GROUP_LABELS: Record<RunGroupBand, string> = {
  beginner: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Normalize any raw runGroup string to one of the three canonical bands. */
export function toRunGroupBand(runGroup: string): RunGroupBand {
  const normalized = runGroup?.trim().toLowerCase();
  if (normalized === 'intermediate') return 'intermediate';
  if (normalized === 'advanced') return 'advanced';
  return 'beginner';
}

/** Signed delta in tenths, e.g. +0.9s. Empty when it rounds to zero. */
export function formatDelta(deltaSeconds: number): string {
  const rounded = Math.round(deltaSeconds * 10) / 10;
  if (rounded === 0) return '';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}s`;
}
