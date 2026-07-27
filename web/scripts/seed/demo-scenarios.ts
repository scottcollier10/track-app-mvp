// NOTE: relative import (not @/) so this file also runs under plain tsx outside jest.
import type { StudentHistory } from '../../src/lib/analytics-v2';

export type Weekday = 'sat' | 'sun';

export interface ScenarioSession {
  weeksAgo: number;      // 0 = most recent weekend
  day: Weekday;
  trackName: string;     // must match tracks.name in prod (recon confirms later)
  lapTimesMs: number[];
}

export interface Scenario {
  n: number;             // 1-6, drives stable UUIDs later
  name: string;
  email: string;         // must end @trackapp.demo (purge scope)
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  sessions: ScenarioSession[];  // chronological, oldest first
  expect: {
    flagKinds: Array<'faded' | 'regressed' | 'off_baseline'>;
    sustained?: boolean;
    baselineState: 'ok' | 'building';
    ready: boolean;
  };
}

/** Saturday (or Sunday) of the weekend N weeks before `now`, at 10:00 UTC, as ISO string. */
export function weekendDate(now: Date, weeksAgo: number, day: Weekday): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10));
  const daysSinceSaturday = (d.getUTCDay() + 1) % 7; // Sat=6 -> 0, Sun=0 -> 1, Wed=3 -> 4
  d.setUTCDate(d.getUTCDate() - daysSinceSaturday - weeksAgo * 7 + (day === 'sun' ? 1 : 0));
  return d.toISOString();
}
