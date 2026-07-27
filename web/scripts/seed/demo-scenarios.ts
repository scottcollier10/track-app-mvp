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

export function toStudentHistory(s: Scenario, now: Date): StudentHistory {
  return {
    runGroup: s.experienceLevel,
    sessions: s.sessions.map(sess => ({
      date: weekendDate(now, sess.weeksAgo, sess.day),
      trackId: sess.trackName,
      bestLapMs: Math.min(...sess.lapTimesMs),
      lapTimesMs: sess.lapTimesMs,
    })),
  };
}

const THUNDERHILL = 'Thunderhill Raceway';
const SONOMA = 'Sonoma Raceway';
const BUTTONWILLOW = 'Buttonwillow Raceway';
const LAGUNA = 'Laguna Seca';
const STREETS = 'Streets of Willow';

export const SCENARIOS: Scenario[] = [
  {
    // Latest session: first-third median 91400, last-third median 92150 -> fade 0.75s.
    // Priors' sigma deliberately varied (~0.2/0.3/0.5s) to keep the baseline band wide
    // so the fade session's spread does NOT also trip off_baseline.
    n: 1, name: 'Kai Garcia', email: 'kai.garcia@trackapp.demo', experienceLevel: 'beginner',
    sessions: [
      { weeksAgo: 3, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [92100, 91900, 92200, 92000, 92150, 91950, 92250, 92050] },
      { weeksAgo: 2, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [92000, 91600, 92300, 91700, 92200, 91500, 92400, 91800] },
      { weeksAgo: 1, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [91900, 91400, 92500, 91500, 92300, 91400, 92600, 91600] },
      { weeksAgo: 0, day: 'sat', trackName: THUNDERHILL,
        lapTimesMs: [91300, 91500, 91400, 91600, 91700, 91800, 92000, 92150, 92200] },
    ],
    expect: { flagKinds: ['faded'], sustained: false, baselineState: 'ok', ready: false },
  },
  {
    // Same track throughout. PB 89400 in s1; s2 best 90500 (>1.01*89400=90294) and
    // latest best 90600 -> regressed AND sustained. Only 2 priors -> baselineState 'building'.
    n: 2, name: 'Marcus Webb', email: 'marcus.webb@trackapp.demo', experienceLevel: 'intermediate',
    sessions: [
      { weeksAgo: 2, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90100, 89800, 89400, 90000, 89900, 89700, 90200, 89600] },
      { weeksAgo: 1, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90800, 90600, 90500, 90900, 90700, 91000, 90600, 90800] },
      { weeksAgo: 0, day: 'sun', trackName: SONOMA,
        lapTimesMs: [90900, 90700, 90600, 91000, 90800, 91100, 90700, 90900] },
    ],
    expect: { flagKinds: ['regressed'], sustained: true, baselineState: 'building', ready: false },
  },
  {
    // Three tight near-identical priors (σ≈0.2s) then a latest session swinging ±0.8s
    // -> off_baseline. First/last third medians equalized so no fade; latest min beats
    // prior PB so no regression.
    n: 3, name: 'Ava Torres', email: 'ava.torres@trackapp.demo', experienceLevel: 'intermediate',
    sessions: [
      { weeksAgo: 3, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95250, 95750, 95300, 95700, 95350, 95650, 95400, 95600] },
      { weeksAgo: 2, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95200, 95700, 95250, 95650, 95300, 95600, 95350, 95550] },
      { weeksAgo: 1, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [95300, 95800, 95350, 95750, 95400, 95700, 95450, 95650] },
      { weeksAgo: 0, day: 'sun', trackName: BUTTONWILLOW,
        lapTimesMs: [94800, 96400, 95100, 96200, 94900, 96400, 94900, 95100] },
    ],
    expect: { flagKinds: ['off_baseline'], baselineState: 'ok', ready: false },
  },
  {
    // Five sessions, bests improving every time (latest is a new PB -> no regression),
    // priors' σ ≈ 0.35-0.45s, latest σ ≈ 0.25s (below baseline mean -> tightening),
    // latest has 8 clean laps with flat thirds -> ready.
    n: 4, name: 'Elena Ross', email: 'elena.ross@trackapp.demo', experienceLevel: 'advanced',
    sessions: [
      { weeksAgo: 4, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88900, 88300, 89100, 88400, 88800, 88200, 89200, 88500] },
      { weeksAgo: 3, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88600, 88100, 88800, 88200, 88500, 87900, 88900, 88300] },
      { weeksAgo: 2, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [88300, 87700, 88600, 87800, 88200, 87600, 88700, 87900] },
      { weeksAgo: 1, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [87900, 87400, 88200, 87500, 87800, 87300, 88300, 87600] },
      { weeksAgo: 0, day: 'sat', trackName: LAGUNA,
        lapTimesMs: [87100, 86800, 87400, 86900, 87200, 86700, 87300, 87000] },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: true },
  },
  {
    // One session, five laps: no baseline, no fade computation (<6 laps), nothing to judge.
    n: 5, name: 'Jordan Lee', email: 'jordan.lee@trackapp.demo', experienceLevel: 'beginner',
    sessions: [
      { weeksAgo: 0, day: 'sat', trackName: STREETS,
        lapTimesMs: [98500, 97800, 98200, 97600, 98000] },
    ],
    expect: { flagKinds: [], baselineState: 'building', ready: false },
  },
  {
    // Six flat sessions. Latest best (90150) within 1% of PB (89900 in s2).
    // Latest σ (~0.33s) just ABOVE prior mean (~0.29s) so not tightening -> not ready,
    // but only ~0.04s over the mean, under the 0.1s min-delta guard -> not off_baseline.
    // The quiet control.
    n: 6, name: 'Sam Whitaker', email: 'sam.whitaker@trackapp.demo', experienceLevel: 'advanced',
    sessions: [
      { weeksAgo: 5, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90100, 90700, 90200, 90600, 90000, 90800, 90300] },
      { weeksAgo: 4, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90400, 89900, 90600, 90100, 90500, 90000, 90700, 90200] },
      { weeksAgo: 3, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90000, 90700, 90100, 90600, 90100, 90800, 90300] },
      { weeksAgo: 2, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90400, 90000, 90600, 90100, 90500, 89950, 90700, 90200] },
      { weeksAgo: 1, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90500, 90050, 90700, 90150, 90600, 90050, 90800, 90250] },
      { weeksAgo: 0, day: 'sun', trackName: THUNDERHILL,
        lapTimesMs: [90650, 90150, 90850, 90200, 90750, 90150, 90950, 90300] },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: false },
  },
];
