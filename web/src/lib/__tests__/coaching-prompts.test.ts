/**
 * The testable half of the model contract (design spine item 4).
 *
 * These assert the strings that carry the hard rule — AI may summarize
 * coach-directed work and may never author a driving instruction — plus the
 * input-set property at the prompt level: no AI-authored text reaches a prompt,
 * so the model cannot launder an old instruction into a new "summary".
 */
import {
  AI_MODEL,
  buildDaySummaryPrompt,
  buildSessionCoachingPrompt,
} from '@/lib/coaching-prompts';
import { assembleDaySummaryContext, type DaySummaryInput } from '@/lib/day-summaries';
import { focusItemsForSession } from '@/lib/track-days';

const TIGHT_6 = [90000, 90100, 90050, 90080, 90020, 90060];
const LOOSE_6 = [90000, 92000, 91000, 90500, 93000, 90800];
const SHORT_4 = [90000, 90100, 90050, 90080];

const laps = (timesMs: Array<number | null>) =>
  timesMs.map((lap_time_ms, i) => ({ lap_number: i + 1, lap_time_ms }));

const ITEM_CARRIED_IN = {
  id: 'item-carried-in',
  text: 'Brake later into T5',
  status: 'active',
  created_at: '2026-07-05T18:00:00Z',
  created_after_session_id: 'prev-day-session',
  focus_item_assessments: [
    {
      id: 'a-1',
      session_id: 's-1',
      judgment: 'keep_working',
      note: 'Still lifting early',
      created_at: '2026-07-12T15:30:00Z',
    },
  ],
};

/** Born out of session 2's debrief — never evidence against session 2 itself. */
const ITEM_BORN_AT_S2 = {
  id: 'item-born-at-s2',
  text: 'Unwind the wheel earlier onto the front straight',
  status: 'active',
  created_at: '2026-07-12T18:45:00Z',
  created_after_session_id: 's-2',
  focus_item_assessments: [],
};

const fullInput = (): DaySummaryInput => ({
  date: '2026-07-12',
  notes: 'Hot, 95F. Student tired by the last run.',
  track: { name: 'Thunderhill' },
  driver: { name: 'Elena Ross' },
  sessions: [
    {
      id: 's-1',
      date: '2026-07-12T15:00:00Z',
      best_lap_ms: 91000,
      representativeness: null,
      representativeness_note: null,
      laps: laps(LOOSE_6),
    },
    {
      id: 's-2',
      date: '2026-07-12T18:00:00Z',
      best_lap_ms: 90200,
      representativeness: 'partial',
      representativeness_note: 'Traffic from lap 4',
      laps: laps(TIGHT_6),
    },
    {
      id: 's-3',
      date: '2026-07-12T21:00:00Z',
      best_lap_ms: 89500,
      representativeness: null,
      representativeness_note: null,
      laps: laps(SHORT_4),
    },
  ],
  focusItems: [ITEM_CARRIED_IN, ITEM_BORN_AT_S2],
  originSessions: [
    { id: 'prev-day-session', track_day: { date: '2026-07-05', track: { name: 'Sonoma' } } },
    { id: 's-2', track_day: { date: '2026-07-12', track: { name: 'Thunderhill' } } },
  ],
  assessmentSessions: [{ id: 'prev-day-session', date: '2026-07-05T18:00:00Z' }],
  coachingNotes: [
    {
      id: 'n-1',
      session_id: 's-2',
      author: 'coach',
      body: 'Caught the 911 twice, lost the last two laps.',
      created_at: '2026-07-12T18:40:00Z',
    },
  ],
});

const emptyInput = (): DaySummaryInput => ({
  date: '2026-07-12',
  notes: null,
  track: { name: 'Thunderhill' },
  driver: { name: 'Jordan Lee' },
  sessions: [],
  focusItems: [],
  originSessions: [],
  assessmentSessions: [],
  coachingNotes: [],
});

describe('AI_MODEL', () => {
  it('is one definition for both routes', () => {
    expect(AI_MODEL).toBe('claude-sonnet-4-6');
  });
});

describe('buildDaySummaryPrompt', () => {
  it('carries the three contract strings', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('NEVER author new driving instructions');
    // The canonical smuggled prescription, named so the model cannot mistake
    // observation clothing for an observation.
    expect(p).toContain('the data suggests earlier braking would help');
    // Empty-means-empty is required output, not model initiative.
    expect(p).toContain('No coaching records exist for this day');
  });

  it('asks for exactly the five settled sections', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    for (const heading of [
      '## Day overview',
      '## Coaching progression',
      '## Important context',
      '## Strengths demonstrated',
      '## Carry-forward',
    ]) {
      expect(p).toContain(heading);
    }
  });

  it('renders explicit empty markers for empty sources, never omitting the section', () => {
    // A near-empty day is exactly where a model's helpfulness instinct invents
    // coaching narrative, so every source states its own emptiness.
    //
    // The coach-notes marker is deliberately NOT the sentence the HARD
    // CONSTRAINT block quotes. It used to be, which made this assertion pass
    // with renderCoachingNotes deleted entirely — coverage of one of the two
    // canonical failure modes that could not fail. Every marker asserted here
    // is now a string that appears nowhere else in the prompt.
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(emptyInput()));
    expect(p).toContain('SESSIONS');
    expect(p).toContain('No sessions are recorded for this day.');
    expect(p).toContain('FOCUS ITEMS');
    expect(p).toContain('No focus items were in play on this day.');
    expect(p).toContain('COACH SESSION NOTES');
    expect(p).toContain('No coach session notes were recorded for this day.');
    expect(p).toContain('DAY NOTES');
    expect(p).toContain('No day notes were recorded.');
  });

  it('states each empty source in its own words — no marker is a substring the constraint block supplies', () => {
    // The guard on the fix above: if a marker is ever reworded back into a
    // sentence the HARD CONSTRAINT block already contains, its assertion stops
    // being able to fail. Asserted on an EMPTY day, where each marker is
    // rendered exactly once.
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(emptyInput()));
    const occurrences = (needle: string) => p.split(needle).length - 1;
    for (const marker of [
      'No sessions are recorded for this day.',
      'No focus items were in play on this day.',
      'No coach session notes were recorded for this day.',
      'No day notes were recorded.',
    ]) {
      expect(occurrences(marker)).toBe(1);
    }
  });

  it('renders each session with its label, best lap and countable lap count', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('Session 1');
    expect(p).toContain('Session 3');
    expect(p).toContain('1:31.000'); // s-1 best lap, formatLapMs
    expect(p).toContain('6 countable laps');
  });

  it('names the baseline every delta is measured against, signed', () => {
    // Deltas are signed numbers with a named baseline. An unlabelled delta is a
    // verdict; the app compares and the instructor concludes.
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('vs Session 1: best lap -0.800s');
  });

  it('states why a session cannot claim a consistency figure instead of omitting it', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('Consistency needs at least 6 countable laps; this session has 4.');
  });

  it('carries context flags with their notes', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('partial');
    expect(p).toContain('Traffic from lap 4');
  });

  it('renders focus items with origin and their full assessment history', () => {
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(fullInput()));
    expect(p).toContain('Brake later into T5');
    expect(p).toContain('from Sonoma, 2026-07-05');
    expect(p).toContain('keep_working');
    expect(p).toContain('Still lifting early');
  });

  it('does not contain any ai_coaching text — the input-set property at prompt level', () => {
    const input = fullInput();
    (input.sessions[0] as unknown as Record<string, unknown>).ai_coaching_summary =
      '## Next Session Goals\nCarry more speed through 5.';
    const p = buildDaySummaryPrompt(assembleDaySummaryContext(input));
    expect(p).not.toContain('ai_coaching');
    expect(p).not.toContain('Carry more speed');
  });
});

describe('buildSessionCoachingPrompt', () => {
  /**
   * Eligibility comes from the SHARED banner function with the focal session as
   * anchor — the same call the route makes. Computing it here by hand would
   * test the test.
   */
  const eligibleFor = (input: DaySummaryInput, focalSessionId: string) => {
    const focal = input.sessions.find((s) => s.id === focalSessionId)!;
    const { reviewed, inPlay } = focusItemsForSession({
      items: input.focusItems,
      assessedItemIds: new Set(
        input.focusItems
          .filter((item) =>
            item.focus_item_assessments.some((a) => a.session_id === focalSessionId)
          )
          .map((item) => item.id)
      ),
      session: { id: focal.id, date: focal.date },
      originSessions: new Map(
        input.sessions.map((s) => [s.id, { id: s.id, date: s.date }])
      ),
      dayDate: input.date,
      trackTimezone: 'America/Los_Angeles',
    });
    return new Set([...reviewed, ...inPlay].map((item) => item.id));
  };

  const args = (focalSessionId = 's-2', input = fullInput()) => ({
    ctx: assembleDaySummaryContext(input),
    focalSessionId,
    eligibleItemIds: eligibleFor(input, focalSessionId),
    focalLaps: laps([...TIGHT_6, 0, null]),
    driverProfile: { experienceLevel: 'intermediate', totalSessions: 12 },
  });

  it('carries the constraint + retrospective framing strings', () => {
    const p = buildSessionCoachingPrompt(args());
    expect(p).toContain('NEVER author new driving instructions');
    expect(p).toContain('never judge this session with hindsight');
  });

  it('asks for exactly the three settled sections', () => {
    const p = buildSessionCoachingPrompt(args());
    for (const heading of [
      "## Session in the day's arc",
      '## Evidence on focus items',
      "## Patterns worth the coach's attention",
    ]) {
      expect(p).toContain(heading);
    }
  });

  it('marks the focal session and frames later ones as subsequent context', () => {
    const p = buildSessionCoachingPrompt(args('s-2'));
    expect(p).toContain('Session 2 (THIS SESSION)');
    expect(p).toContain('Session 3 (after this session)');
  });

  it('marks a later session in the ASSESSMENT HISTORY too — the hindsight that matters most', () => {
    // This is the renderer decision 7 is actually about. The evidence section
    // asks what THIS session's data shows against the item's assessment
    // history; a bare "Session 3: improved" listed there is a verdict from
    // after the fact reading as something session 2 already had.
    const input = fullInput();
    input.focusItems = [
      {
        ...ITEM_CARRIED_IN,
        focus_item_assessments: [
          {
            id: 'a-later',
            session_id: 's-3',
            judgment: 'improved',
            note: 'finally nailed it',
            created_at: '2026-07-12T21:30:00Z',
          },
        ],
      },
    ];
    const p = buildSessionCoachingPrompt(args('s-2', input));
    expect(p).toContain('Session 3 (after this session): improved');
    expect(p).not.toContain('- Session 3: improved');
  });

  it('marks a later session in the COACH NOTES too', () => {
    const input = fullInput();
    input.coachingNotes = [
      {
        id: 'n-late',
        session_id: 's-3',
        author: 'coach',
        body: 'Much better placement in the carousel.',
        created_at: '2026-07-12T21:40:00Z',
      },
    ];
    const p = buildSessionCoachingPrompt(args('s-2', input));
    expect(p).toContain('Session 3 (after this session) (coach):');
    expect(p).not.toContain('- Session 3 (coach):');
  });

  it('leaves a cross-day assessment unmarked and unnumbered by this day', () => {
    // A session on another day has no position in this day's arc, so the
    // labeler returns the name the context resolved rather than borrowing a
    // "Session N" that belongs to one of this day's sessions.
    const input = fullInput();
    input.focusItems = [
      {
        ...ITEM_CARRIED_IN,
        focus_item_assessments: [
          {
            id: 'a-prev-day',
            session_id: 'prev-day-session',
            judgment: 'keep_working',
            note: null,
            created_at: '2026-07-05T18:30:00Z',
          },
        ],
      },
    ];
    const p = buildSessionCoachingPrompt(args('s-2', input));
    expect(p).toContain('a session on another day (1 of 1): keep_working');
    expect(p).not.toContain('a session on another day (1 of 1) (THIS SESSION)');
  });

  it('throws when the focal session is not in the day context, rather than drafting about some other session', () => {
    // With no focal session nothing is marked "(THIS SESSION)", no lap is
    // "(best)", and the header still promises a prompt about ONE session — the
    // model picks one and the route returns it as a 200. Corrupt input, not a
    // supported state.
    expect(() => buildSessionCoachingPrompt({ ...args('s-2'), focalSessionId: 's-nope' })).toThrow(
      /buildSessionCoachingPrompt/
    );
  });

  it('marks one lap "(best)" even when two laps tie on the session best', () => {
    const input = fullInput();
    input.sessions[1].best_lap_ms = 90000;
    const p = buildSessionCoachingPrompt({
      ...args('s-2', input),
      focalLaps: [
        { lap_number: 1, lap_time_ms: 90000 },
        { lap_number: 2, lap_time_ms: 90000 },
        { lap_number: 3, lap_time_ms: 91000 },
      ],
    });
    expect(p.split('(best)').length - 1).toBe(1);
    expect(p).toContain('Lap 1: 1:30.000 (best)');
    expect(p).toContain('Lap 2: 1:30.000\n');
  });

  it('lists only items eligible for the focal session — an item is absent from its own origin session', () => {
    // item-born-at-s2 was the coach's response TO session 2, not something
    // session 2 tested. The exclusion arrives by reusing focusItemsForSession,
    // not by a rule written here.
    const atS2 = buildSessionCoachingPrompt(args('s-2'));
    expect(atS2).toContain('Brake later into T5');
    expect(atS2).not.toContain('Unwind the wheel earlier');

    // The very next session is where it becomes evidence.
    const atS3 = buildSessionCoachingPrompt(args('s-3'));
    expect(atS3).toContain('Unwind the wheel earlier');
  });

  it('says so plainly when no items are in play, rather than padding', () => {
    const input = fullInput();
    input.focusItems = [];
    const p = buildSessionCoachingPrompt({
      ...args('s-2', input),
      eligibleItemIds: new Set<string>(),
    });
    expect(p).toContain('No focus items are in play for this session.');
  });

  it('renders countable laps only, with lap numbers as recorded', () => {
    // A raw row would print "Lap 7: 0:00.000" and invite the model to cite a
    // phantom lap in coach-visible text. Numbers stay AS RECORDED: a coach's
    // "lap 5" must still be lap 5 when an earlier lap was uncountable.
    const p = buildSessionCoachingPrompt({
      ...args('s-2'),
      focalLaps: [
        { lap_number: 1, lap_time_ms: 91000 },
        { lap_number: 2, lap_time_ms: 0 },
        { lap_number: 3, lap_time_ms: null },
        { lap_number: 4, lap_time_ms: 90200 },
      ],
    });
    expect(p).toContain('Lap 1: 1:31.000');
    expect(p).toContain('Lap 4: 1:30.200');
    expect(p).not.toContain('Lap 2');
    expect(p).not.toContain('Lap 3');
    expect(p).not.toContain('0:00.000');
  });

  it('carries the driver profile the coaching route already passed', () => {
    const p = buildSessionCoachingPrompt(args());
    expect(p).toContain('Elena Ross');
    expect(p).toContain('Experience level: intermediate');
    expect(p).toContain('Sessions completed: 12');
  });

  it('says the profile is not recorded when there is none, rather than defaulting it', () => {
    // The header two lines above promises the model that everything below is
    // recorded session data or something the coach wrote. A default —
    // "intermediate", "0 sessions completed" — is a fabricated fact under that
    // promise, and one the model reasons from: it frames a 40-session driver's
    // day as a beginner's.
    const p = buildSessionCoachingPrompt({ ...args(), driverProfile: null });
    expect(p).toContain('Experience level: not recorded');
    expect(p).toContain('Sessions completed: not recorded');
    expect(p).not.toContain('intermediate');
    expect(p).not.toContain('Sessions completed: 0');
  });

  it('marks the null fields of a profile that exists, and only those', () => {
    // The columns are nullable independently of the row.
    const p = buildSessionCoachingPrompt({
      ...args(),
      driverProfile: { experienceLevel: null, totalSessions: 12 },
    });
    expect(p).toContain('Experience level: not recorded');
    expect(p).toContain('Sessions completed: 12');
  });

  it('renders a recorded count of zero as zero, not as unrecorded', () => {
    // `??`, not `||`. A driver on their first day has a recorded count and it
    // is 0; collapsing that into "not recorded" discards a fact the data holds.
    const p = buildSessionCoachingPrompt({
      ...args(),
      driverProfile: { experienceLevel: 'novice', totalSessions: 0 },
    });
    expect(p).toContain('Sessions completed: 0');
    expect(p).not.toContain('Sessions completed: not recorded');
  });

  it('does not contain any ai_coaching text — the input-set property at prompt level', () => {
    const input = fullInput();
    (input.sessions[1] as unknown as Record<string, unknown>).ai_coaching_summary =
      '## Next Session Goals\nCarry more speed through 5.';
    const p = buildSessionCoachingPrompt(args('s-2', input));
    expect(p).not.toContain('ai_coaching');
    expect(p).not.toContain('Carry more speed');
  });
});
