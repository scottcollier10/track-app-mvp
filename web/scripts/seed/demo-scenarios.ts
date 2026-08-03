// NOTE: relative import (not @/) so this file also runs under plain tsx outside jest.
import type { StudentHistory } from '../../src/lib/analytics-v2';

export type Weekday = 'sat' | 'sun';

export interface ScenarioSession {
  /**
   * UTC hour the session starts. Kept in 17-23 on purpose: for every track in
   * the cast (all America/Los_Angeles) that window is daytime local on the SAME
   * calendar date — 10:00-16:00 under PDT, 09:00-15:00 under PST, and a refresh
   * run in November gets the latter — so a session's UTC date and its
   * track-local date never disagree and the day grouping cannot be read two
   * ways. The offset moves the wall clock; the calendar date is the invariant.
   */
  hourUtc: number;
  lapTimesMs: number[];
  /** Absent = unflagged (sessions.representativeness NULL = representative). */
  representativeness?: 'partial' | 'not_representative';
  representativenessNote?: string;
}

/** A driver's day at a track — one track_days row, owning its sessions. */
export interface ScenarioDay {
  weeksAgo: number;      // 0 = most recent weekend
  day: Weekday;
  trackName: string;     // must match tracks.name in prod (recon confirms later)
  sessions: ScenarioSession[]; // chronological (hourUtc ascending)
  notes?: string;        // track_days.notes — coach day scratchpad
}

export interface Scenario {
  n: number;             // 1-6, drives stable UUIDs later
  name: string;
  email: string;         // must end @trackapp.demo (purge scope)
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  days: ScenarioDay[];   // chronological, oldest first
  expect: {
    flagKinds: Array<'faded' | 'regressed' | 'off_baseline'>;
    sustained?: boolean;
    baselineState: 'ok' | 'building';
    ready: boolean;
  };
}

/** Saturday (or Sunday) of the weekend N weeks before `now`, at `hourUtc`, as ISO string. */
export function weekendDate(now: Date, weeksAgo: number, day: Weekday, hourUtc: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc));
  const daysSinceSaturday = (d.getUTCDay() + 1) % 7; // Sat=6 -> 0, Sun=0 -> 1, Wed=3 -> 4
  d.setUTCDate(d.getUTCDate() - daysSinceSaturday - weeksAgo * 7 + (day === 'sun' ? 1 : 0));
  return d.toISOString();
}

/**
 * Every session of a scenario, day order then hour order — the ONE flattening.
 *
 * `dayIdx` rides along because the flat index IS the session's seed identity
 * (sessionUuid's Nth), and its day's identity (dayUuid's dayIdx+1) has to be
 * read off the SAME walk. The generator used to re-implement this flatten
 * inline just to get dayIdx, which made the session->day and session->lap
 * correspondences depend on two independent traversals agreeing.
 */
export function scenarioSessions(
  s: Scenario,
): Array<{ day: ScenarioDay; dayIdx: number; session: ScenarioSession }> {
  return s.days.flatMap((day, dayIdx) => day.sessions.map(session => ({ day, dayIdx, session })));
}

/** evaluateStudent is day-agnostic: it sees the flat session list, exactly as prod does. */
export function toStudentHistory(s: Scenario, now: Date): StudentHistory {
  return {
    runGroup: s.experienceLevel,
    sessions: scenarioSessions(s).map(({ day, session }) => ({
      date: weekendDate(now, day.weeksAgo, day.day, session.hourUtc),
      trackId: day.trackName,
      bestLapMs: Math.min(...session.lapTimesMs),
      lapTimesMs: session.lapTimesMs,
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
    // Two days of four. The fade lives in the LAST session of the LATEST day:
    // first-third median 91400, last-third median 92150 -> fade 0.75s.
    // The seven priors' sigma is deliberately varied (0.12-0.50s) to keep the
    // baseline band wide, so the fade session's spread does NOT also trip
    // off_baseline. The session before it fades -0.25s -> not sustained.
    n: 1, name: 'Kai Garcia', email: 'kai.garcia@trackapp.demo', experienceLevel: 'beginner',
    days: [
      {
        weeksAgo: 1, day: 'sat', trackName: THUNDERHILL,
        sessions: [
          { hourUtc: 17, lapTimesMs: [92100, 91900, 92200, 92000, 92150, 91950, 92250, 92050] },
          { hourUtc: 19, lapTimesMs: [92000, 91600, 92300, 91700, 92200, 91500, 92400, 91800] },
          { hourUtc: 21, lapTimesMs: [91900, 91400, 92500, 91500, 92300, 91400, 92600, 91600] },
          { hourUtc: 23, lapTimesMs: [92050, 91750, 92150, 91800, 92000, 91700, 92200, 91850] },
        ],
      },
      {
        weeksAgo: 0, day: 'sat', trackName: THUNDERHILL,
        notes: 'Hot day, 95F by lunch. Kai on the same set of tires all day.',
        sessions: [
          { hourUtc: 17, lapTimesMs: [91950, 91500, 92150, 91600, 92050, 91450, 92250, 91700] },
          {
            hourUtc: 19, lapTimesMs: [91850, 91650, 91950, 91700, 91900, 91600, 92000, 91750],
            representativeness: 'not_representative',
            representativenessNote: 'Instructor ride-along — demo laps, not a timed run.',
          },
          { hourUtc: 21, lapTimesMs: [91800, 91350, 92100, 91450, 92000, 91300, 92200, 91550] },
          { hourUtc: 23, lapTimesMs: [91300, 91500, 91400, 91600, 91700, 91800, 92000, 92150, 92200] },
        ],
      },
    ],
    expect: { flagKinds: ['faded'], sustained: false, baselineState: 'ok', ready: false },
  },
  {
    // Same track throughout. PB 89400 on day one; both of the latest day's
    // sessions are >1.01*PB (90294) -> regressed, and the second-to-last
    // session is itself regressed vs the PB -> sustained. Only 2 priors, so
    // the consistency baseline is still 'building'.
    n: 2, name: 'Marcus Webb', email: 'marcus.webb@trackapp.demo', experienceLevel: 'intermediate',
    days: [
      {
        weeksAgo: 1, day: 'sun', trackName: SONOMA,
        sessions: [
          { hourUtc: 17, lapTimesMs: [90100, 89800, 89400, 90000, 89900, 89700, 90200, 89600] },
        ],
      },
      {
        weeksAgo: 0, day: 'sun', trackName: SONOMA,
        notes: 'Second event back after the gearbox rebuild. Watch turn 7 entry.',
        sessions: [
          { hourUtc: 17, lapTimesMs: [90800, 90600, 90500, 90900, 90700, 91000, 90600, 90800] },
          { hourUtc: 21, lapTimesMs: [90900, 90700, 90600, 91000, 90800, 91100, 90700, 90900] },
        ],
      },
    ],
    expect: { flagKinds: ['regressed'], sustained: true, baselineState: 'building', ready: false },
  },
  {
    // Four near-identical tight priors (sigma 0.20s) across two days, then a
    // latest session swinging +/-0.8s -> off_baseline. First/last third medians
    // equalized so no fade; latest min beats the prior PB so no regression.
    n: 3, name: 'Ava Torres', email: 'ava.torres@trackapp.demo', experienceLevel: 'intermediate',
    days: [
      {
        weeksAgo: 1, day: 'sun', trackName: BUTTONWILLOW,
        sessions: [
          { hourUtc: 17, lapTimesMs: [95250, 95750, 95300, 95700, 95350, 95650, 95400, 95600] },
          { hourUtc: 19, lapTimesMs: [95200, 95700, 95250, 95650, 95300, 95600, 95350, 95550] },
          { hourUtc: 21, lapTimesMs: [95300, 95800, 95350, 95750, 95400, 95700, 95450, 95650] },
        ],
      },
      {
        weeksAgo: 0, day: 'sun', trackName: BUTTONWILLOW,
        notes: 'New tires on in the afternoon. Ava chasing the fast lap, not the rhythm.',
        sessions: [
          { hourUtc: 17, lapTimesMs: [95150, 95650, 95200, 95600, 95250, 95550, 95300, 95500] },
          { hourUtc: 21, lapTimesMs: [94800, 96400, 95100, 96200, 94900, 96400, 94900, 95100] },
        ],
      },
    ],
    expect: { flagKinds: ['off_baseline'], baselineState: 'ok', ready: false },
  },
  {
    // Three days of four, including a two-day weekend (Sat + Sun = two day
    // rows). Session bests improve every single time, so the latest is a new PB
    // -> no regression. Priors' sigma 0.32-0.43s, latest 0.25s (below the
    // baseline mean -> tightening) with flat thirds -> ready.
    n: 4, name: 'Elena Ross', email: 'elena.ross@trackapp.demo', experienceLevel: 'advanced',
    days: [
      {
        weeksAgo: 2, day: 'sat', trackName: LAGUNA,
        sessions: [
          { hourUtc: 17, lapTimesMs: [90100, 89500, 90300, 89600, 90000, 89400, 90400, 89700] },
          { hourUtc: 19, lapTimesMs: [89950, 89300, 90200, 89400, 89850, 89150, 90300, 89500] },
          { hourUtc: 21, lapTimesMs: [89500, 89000, 89700, 89050, 89450, 88900, 89750, 89150] },
          { hourUtc: 23, lapTimesMs: [89400, 88800, 89600, 88900, 89300, 88700, 89700, 88950] },
        ],
      },
      {
        weeksAgo: 0, day: 'sat', trackName: LAGUNA,
        sessions: [
          { hourUtc: 17, lapTimesMs: [89150, 88550, 89350, 88650, 89050, 88450, 89450, 88750] },
          { hourUtc: 19, lapTimesMs: [88900, 88300, 89100, 88400, 88800, 88200, 89200, 88500] },
          { hourUtc: 21, lapTimesMs: [88600, 88100, 88800, 88150, 88550, 88000, 88850, 88250] },
          { hourUtc: 23, lapTimesMs: [88550, 87900, 88800, 88000, 88450, 87750, 88900, 88100] },
        ],
      },
      {
        weeksAgo: 0, day: 'sun', trackName: LAGUNA,
        notes: 'Sunday of the doubleheader. Elena finally stopped chasing the entry to 2.',
        sessions: [
          { hourUtc: 17, lapTimesMs: [88200, 87600, 88400, 87700, 88100, 87500, 88500, 87800] },
          {
            hourUtc: 19, lapTimesMs: [87850, 87350, 88050, 87400, 87800, 87250, 88100, 87500],
            representativeness: 'partial',
            representativenessNote: 'Full-course yellow at four minutes — session cut short.',
          },
          { hourUtc: 21, lapTimesMs: [87700, 87100, 87900, 87200, 87600, 87000, 88000, 87300] },
          { hourUtc: 23, lapTimesMs: [87160, 86770, 87300, 86830, 87100, 86700, 87360, 86900] },
        ],
      },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: true },
  },
  {
    // ONE day, TWO short sessions (5 and 4 laps). Both are under the six-lap
    // fade gate, one prior leaves the baseline 'building', and the second
    // session's best beats the first's so nothing regresses. This is the n=1
    // rendering check: a day page with almost nothing to say must still work.
    n: 5, name: 'Jordan Lee', email: 'jordan.lee@trackapp.demo', experienceLevel: 'beginner',
    days: [
      {
        weeksAgo: 0, day: 'sat', trackName: STREETS,
        sessions: [
          { hourUtc: 17, lapTimesMs: [98500, 97800, 98200, 97600, 98000] },
          { hourUtc: 19, lapTimesMs: [97900, 97400, 97700, 97500] },
        ],
      },
    ],
    expect: { flagKinds: [], baselineState: 'building', ready: false },
  },
  {
    // THE QUIET CONTROL. Three days of two flat sessions. Latest best (90150)
    // is within 1% of the PB (89900, 1.01*PB = 90799). Priors' sigma spread is
    // deliberately wide (0.20-0.40s -> mean ~0.30s, 2-sigma upper ~0.46s).
    // Latest sigma (~0.33s) sits ABOVE the mean so it is not tightening -> not
    // ready, but comfortably INSIDE the band -> not off_baseline (no reliance
    // on the 0.1s min-delta guard).
    //
    // Sam carries NO day notes and NO representativeness flags, and Task 7 adds
    // him no focus items: a control with a focus trail is not a control.
    n: 6, name: 'Sam Whitaker', email: 'sam.whitaker@trackapp.demo', experienceLevel: 'advanced',
    days: [
      {
        weeksAgo: 2, day: 'sun', trackName: THUNDERHILL,
        sessions: [
          { hourUtc: 17, lapTimesMs: [90500, 90250, 90600, 90150, 90650, 90200, 90550, 90300] },
          { hourUtc: 21, lapTimesMs: [90400, 90050, 90450, 89900, 90600, 90050, 90450, 90100] },
        ],
      },
      {
        weeksAgo: 1, day: 'sun', trackName: THUNDERHILL,
        sessions: [
          { hourUtc: 17, lapTimesMs: [90500, 90150, 90700, 90000, 90800, 90100, 90650, 90300] },
          { hourUtc: 21, lapTimesMs: [90500, 90100, 90750, 89950, 90850, 90050, 90700, 90300] },
        ],
      },
      {
        weeksAgo: 0, day: 'sun', trackName: THUNDERHILL,
        sessions: [
          { hourUtc: 17, lapTimesMs: [90600, 90200, 90900, 89950, 91050, 90100, 90800, 90400] },
          { hourUtc: 21, lapTimesMs: [90650, 90150, 90850, 90200, 90750, 90150, 90950, 90300] },
        ],
      },
    ],
    expect: { flagKinds: [], baselineState: 'ok', ready: false },
  },
];
