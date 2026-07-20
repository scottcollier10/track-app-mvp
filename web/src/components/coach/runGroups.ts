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

export const RUN_GROUP_LABELS: Record<string, string> = {
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
