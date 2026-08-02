/**
 * The pure assembly core. Every metric here must come from track-days.ts /
 * insights.ts / analytics-v2.ts — these tests re-derive the expected numbers
 * with those same functions rather than hardcoding them, so a test can only
 * pass if the core delegated instead of computing.
 */
import {
  assembleDaySummaryContext,
  daySummaryView,
  editedAfterApproval,
  informingIdsFrom,
  isReplacedWriteError,
  type DaySummaryInput,
} from '@/lib/day-summaries';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { displayedSigmaSeconds, sessionDelta } from '@/lib/track-days';

const TIGHT_6 = [90000, 90100, 90050, 90080, 90020, 90060];
const LOOSE_6 = [90000, 92000, 91000, 90500, 93000, 90800];
const SHORT_4 = [90000, 90100, 90050, 90080];

const laps = (timesMs: Array<number | null>) =>
  timesMs.map((lap_time_ms, i) => ({ lap_number: i + 1, lap_time_ms }));

const session = (
  over: Partial<DaySummaryInput['sessions'][number]> & { id: string; date: string }
): DaySummaryInput['sessions'][number] => ({
  best_lap_ms: 90000,
  representativeness: null,
  representativeness_note: null,
  laps: laps(TIGHT_6),
  ...over,
});

/** A day with three sessions, handed in deliberately out of order. */
const baseInput = (): DaySummaryInput => ({
  date: '2026-07-12',
  notes: 'Hot, 95F. Student tired by the last run.',
  track: { name: 'Thunderhill' },
  driver: { name: 'Elena Ross' },
  sessions: [
    session({ id: 's-3', date: '2026-07-12T21:00:00Z', best_lap_ms: 89500, laps: laps(SHORT_4) }),
    session({ id: 's-1', date: '2026-07-12T15:00:00Z', best_lap_ms: 91000, laps: laps(LOOSE_6) }),
    session({ id: 's-2', date: '2026-07-12T18:00:00Z', best_lap_ms: 90200, laps: laps(TIGHT_6) }),
  ],
  focusItems: [],
  originSessions: [],
  assessmentSessions: [],
  coachingNotes: [],
});

/**
 * The same day with a focus trail on it — one item carried in from another day
 * (so its history is cross-day), one resolved here, and two that belong in
 * neither group. Module scope because the determinism test permutes it too:
 * a day with no focus items cannot show that focusItems, their assessments and
 * the origin/assessment session lists are all order-independent.
 */
const withFocus = (): DaySummaryInput => ({
  ...baseInput(),
  focusItems: [
    {
      id: 'item-active',
      text: 'Brake later into T5',
      status: 'active',
      created_at: '2026-07-05T18:00:00Z',
      created_after_session_id: 'prev-day-session',
      focus_item_assessments: [
        // Deliberately newest-first: order must come from the sessions.
        {
          id: 'a-2',
          session_id: 's-2',
          judgment: 'improved',
          note: 'Much later turn-in',
          created_at: '2026-07-12T18:30:00Z',
        },
        {
          id: 'a-1',
          session_id: 'prev-day-session',
          judgment: 'keep_working',
          note: null,
          created_at: '2026-07-05T18:30:00Z',
        },
      ],
    },
    {
      id: 'item-achieved',
      text: 'Smooth throttle application out of T2',
      status: 'achieved',
      created_at: '2026-07-06T18:00:00Z',
      created_after_session_id: null,
      focus_item_assessments: [
        {
          id: 'a-3',
          session_id: 's-3',
          judgment: 'improved',
          note: null,
          created_at: '2026-07-12T21:30:00Z',
        },
      ],
    },
    {
      id: 'item-paused',
      text: 'Trail brake into the carousel',
      status: 'paused',
      created_at: '2026-07-07T18:00:00Z',
      created_after_session_id: null,
      focus_item_assessments: [],
    },
    {
      id: 'item-dropped-elsewhere',
      text: 'Left-foot braking',
      status: 'dropped',
      created_at: '2026-07-08T18:00:00Z',
      created_after_session_id: null,
      focus_item_assessments: [],
    },
  ],
  originSessions: [
    {
      id: 'prev-day-session',
      track_day: { date: '2026-07-05', track: { name: 'Sonoma' } },
    },
  ],
  assessmentSessions: [{ id: 'prev-day-session', date: '2026-07-05T18:00:00Z' }],
});

describe('assembleDaySummaryContext', () => {
  it('orders sessions by bySessionStart and labels them Session 1..n', () => {
    const ctx = assembleDaySummaryContext(baseInput());
    expect(ctx.sessions.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
    expect(ctx.sessions.map((s) => s.label)).toEqual(['Session 1', 'Session 2', 'Session 3']);
  });

  it('breaks a tied start time on session id, like every other Session N in the app', () => {
    const input = baseInput();
    input.sessions = [
      session({ id: 's-b', date: '2026-07-12T15:00:00Z' }),
      session({ id: 's-a', date: '2026-07-12T15:00:00Z' }),
    ];
    expect(assembleDaySummaryContext(input).sessions.map((s) => s.id)).toEqual(['s-a', 's-b']);
  });

  it('claims σ only when canClaimConsistency passes; otherwise null with the reason', () => {
    const ctx = assembleDaySummaryContext(baseInput());

    // S2 clears the gate: the figure is the shared σ, snapped to the resolution
    // it is displayed at (nothing derived from a σ may claim finer).
    const s2 = ctx.sessions[1];
    expect(s2.consistencySeconds).toBe(
      displayedSigmaSeconds(sessionConsistencySeconds(TIGHT_6) as number)
    );
    expect(s2.consistencyUnavailableReason).toBeNull();

    // S3 has four countable laps: no number at all, and a reason that names the
    // gate's rule so the model says "not claimable" instead of inventing one.
    const s3 = ctx.sessions[2];
    expect(s3.consistencySeconds).toBeNull();
    expect(s3.consistencyUnavailableReason).toContain(`at least ${MIN_LAPS_FOR_INSIGHTS}`);
    expect(s3.consistencyUnavailableReason).toContain('4');
  });

  it('counts countable laps, not lap rows, and drops a 0 best lap', () => {
    const input = baseInput();
    input.sessions = [
      session({
        id: 's-1',
        date: '2026-07-12T15:00:00Z',
        best_lap_ms: 0,
        laps: laps([...TIGHT_6, 0, null]),
      }),
    ];
    const [s] = assembleDaySummaryContext(input).sessions;
    expect(s.countableLapCount).toBe(6);
    // 0 is not a best lap: the day KPI skips it and the session card prints
    // "--" for it, so the prompt must not be handed "0:00.000".
    expect(s.bestLapMs).toBeNull();
  });

  it('measures deltas against deltaBaselineIndex and names the baseline', () => {
    const input = baseInput();
    input.sessions = [
      session({ id: 's-1', date: '2026-07-12T15:00:00Z', best_lap_ms: 91000, laps: laps(LOOSE_6) }),
      session({
        id: 's-2',
        date: '2026-07-12T18:00:00Z',
        best_lap_ms: 88000,
        laps: laps(TIGHT_6),
        representativeness: 'not_representative',
        representativeness_note: 'Ran with a much faster group',
      }),
      session({ id: 's-3', date: '2026-07-12T21:00:00Z', best_lap_ms: 90200, laps: laps(TIGHT_6) }),
    ];
    const ctx = assembleDaySummaryContext(input);

    // First session has no earlier session to measure against.
    expect(ctx.sessions[0].delta).toBeNull();

    // S3's baseline is S1, NOT the not_representative S2 sitting between them —
    // a delta vs the flagged session is exactly what the flag prevents.
    expect(ctx.sessions[2].delta).toEqual({
      vsLabel: 'Session 1',
      bestLapDeltaMs: sessionDelta(
        { bestLapMs: 91000, lapTimesMs: LOOSE_6 },
        { bestLapMs: 90200, lapTimesMs: TIGHT_6 }
      ).bestLapDeltaMs,
      sigmaDeltaSeconds:
        displayedSigmaSeconds(sessionConsistencySeconds(TIGHT_6) as number) -
        displayedSigmaSeconds(sessionConsistencySeconds(LOOSE_6) as number),
    });
  });

  it('nulls the σ delta when either side cannot claim a σ, keeping the lap delta', () => {
    const ctx = assembleDaySummaryContext(baseInput());
    // S3 is the four-lap session; its best-lap delta is still honest.
    expect(ctx.sessions[2].delta?.sigmaDeltaSeconds).toBeNull();
    expect(ctx.sessions[2].delta?.bestLapDeltaMs).toBe(89500 - 90200);
  });

  it('includes non-representative sessions, labeled and flagged, never dropped', () => {
    const input = baseInput();
    input.sessions[0] = session({
      id: 's-3',
      date: '2026-07-12T21:00:00Z',
      representativeness: 'not_representative',
      representativeness_note: 'Red flag on lap 3',
      laps: laps(SHORT_4),
    });
    const ctx = assembleDaySummaryContext(input);
    expect(ctx.sessions).toHaveLength(3);
    expect(ctx.sessions[2]).toMatchObject({
      id: 's-3',
      label: 'Session 3',
      representativeness: 'not_representative',
      representativenessNote: 'Red flag on lap 3',
    });
  });

  describe('focus items', () => {
    it('takes focusPanelGroups active + resolvedThisDay, and nothing else', () => {
      const ctx = assembleDaySummaryContext(withFocus());
      expect(ctx.focusItems.map((i) => i.id)).toEqual(['item-active', 'item-achieved']);
    });

    it('inherits the resolved-this-day proxy: a resolution with no same-day evidence is absent', () => {
      // The intended gap in focusPanelGroups, not redefined here. item-dropped-
      // elsewhere has no assessment on any of this day's sessions, so it appears
      // in no day's summary — exactly as it appears in no day's history.
      const ctx = assembleDaySummaryContext(withFocus());
      expect(ctx.focusItems.map((i) => i.id)).not.toContain('item-dropped-elsewhere');
      expect(ctx.focusItems.map((i) => i.id)).not.toContain('item-paused');
    });

    it('snapshots text and status — items are mutable, ids alone cannot reproduce them', () => {
      const ctx = assembleDaySummaryContext(withFocus());
      expect(ctx.focusItems[0]).toMatchObject({
        text: 'Brake later into T5',
        status: 'active',
      });
      expect(ctx.focusItems[1]).toMatchObject({
        text: 'Smooth throttle application out of T2',
        status: 'achieved',
      });
    });

    it('labels origin from the origin session DAY, and null when there is none', () => {
      const ctx = assembleDaySummaryContext(withFocus());
      expect(ctx.focusItems[0].origin).toBe('from Sonoma, 2026-07-05');
      // Added outside a session: the recorded fact is "no origin", not a guess.
      expect(ctx.focusItems[1].origin).toBeNull();
    });

    it('carries the full cross-day assessment history in session order, uncapped', () => {
      const ctx = assembleDaySummaryContext(withFocus());
      expect(ctx.focusItems[0].assessments.map((a) => a.id)).toEqual(['a-1', 'a-2']);
      expect(ctx.focusItems[0].assessments[1]).toEqual({
        id: 'a-2',
        sessionId: 's-2',
        sessionLabel: 'Session 2',
        judgment: 'improved',
        note: 'Much later turn-in',
        createdAt: '2026-07-12T18:30:00Z',
      });
    });

    it('never labels a session from another day as one of THIS day\'s "Session N"', () => {
      const ctx = assembleDaySummaryContext(withFocus());
      const foreign = ctx.focusItems[0].assessments[0];
      expect(foreign.sessionId).toBe('prev-day-session');
      expect(foreign.sessionLabel).not.toMatch(/^Session \d+$/);
    });

    it('numbers cross-day assessments so a multi-day trail is not N identical bullets', () => {
      // The uncapped history exists to carry a cross-day narrative (decision 4).
      // Three prior-day assessments rendered as three copies of one string are
      // three bullets the model cannot tell apart, so the trail reads as one
      // repeated judgment. The ordinal is a position in THIS item's history —
      // never the assessment's createdAt, which retroactive debriefs scramble.
      const input = withFocus();
      input.focusItems[0].focus_item_assessments = [
        {
          id: 'a-x1',
          session_id: 'other-1',
          judgment: 'keep_working',
          note: null,
          created_at: '2026-07-05T18:30:00Z',
        },
        {
          id: 'a-x2',
          session_id: 'other-2',
          judgment: 'no_change',
          note: null,
          created_at: '2026-07-06T18:30:00Z',
        },
        {
          id: 'a-this-day',
          session_id: 's-2',
          judgment: 'improved',
          note: null,
          created_at: '2026-07-12T18:30:00Z',
        },
        {
          id: 'a-x3',
          session_id: 'other-3',
          judgment: 'improved',
          note: null,
          created_at: '2026-07-07T18:30:00Z',
        },
      ];
      input.assessmentSessions = [
        { id: 'other-1', date: '2026-07-05T18:00:00Z' },
        { id: 'other-2', date: '2026-07-06T18:00:00Z' },
        { id: 'other-3', date: '2026-07-07T18:00:00Z' },
      ];

      const labels = assembleDaySummaryContext(input).focusItems[0].assessments.map(
        (a) => a.sessionLabel
      );
      // Cross-day ones are distinguishable; the day's own session keeps its
      // "Session N" and is not counted among them.
      expect(labels).toEqual([
        'a session on another day (1 of 3)',
        'a session on another day (2 of 3)',
        'a session on another day (3 of 3)',
        'Session 2',
      ]);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  it('carries day identity and the day notes text', () => {
    const ctx = assembleDaySummaryContext(baseInput());
    expect(ctx.day).toEqual({
      trackName: 'Thunderhill',
      date: '2026-07-12',
      driverName: 'Elena Ross',
      sessionCount: 3,
      notes: 'Hot, 95F. Student tired by the last run.',
    });
  });

  it('carries coach session notes in day order, not row order', () => {
    const input = baseInput();
    input.coachingNotes = [
      {
        id: 'n-3',
        session_id: 's-3',
        author: 'coach',
        body: 'Traffic all run.',
        created_at: '2026-07-12T21:40:00Z',
      },
      {
        id: 'n-1',
        session_id: 's-1',
        author: 'coach',
        body: 'Warm-up run, no notes.',
        created_at: '2026-07-12T15:40:00Z',
      },
    ];
    const ctx = assembleDaySummaryContext(input);
    expect(ctx.coachingNotes).toEqual([
      {
        sessionId: 's-1',
        author: 'coach',
        body: 'Warm-up run, no notes.',
        createdAt: '2026-07-12T15:40:00Z',
      },
      {
        sessionId: 's-3',
        author: 'coach',
        body: 'Traffic all run.',
        createdAt: '2026-07-12T21:40:00Z',
      },
    ]);
  });

  it('breaks a coaching-note tie on note id — created_at is nullable and ties on it are reachable', () => {
    // Two undated notes on the same session tie on both earlier keys, so
    // without the id tiebreak their order is whatever PostgREST returned — the
    // one thing this object may not depend on.
    const input = baseInput();
    const undated = (id: string, body: string) => ({
      id,
      session_id: 's-2',
      author: 'coach',
      body,
      created_at: null,
    });
    input.coachingNotes = [undated('n-b', 'Second'), undated('n-a', 'First')];
    const forward = assembleDaySummaryContext(input);

    const reversed = baseInput();
    reversed.coachingNotes = [undated('n-a', 'First'), undated('n-b', 'Second')];

    expect(forward.coachingNotes.map((n) => n.body)).toEqual(['First', 'Second']);
    expect(assembleDaySummaryContext(reversed).coachingNotes).toEqual(forward.coachingNotes);
  });

  it('keeps empty sources explicit: empty arrays and null notes survive as-is', () => {
    const ctx = assembleDaySummaryContext({
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
    expect(ctx.day.notes).toBeNull();
    expect(ctx.day.sessionCount).toBe(0);
    expect(ctx.sessions).toEqual([]);
    expect(ctx.focusItems).toEqual([]);
    expect(ctx.coachingNotes).toEqual([]);
    // Omission would let a downstream renderer read "absent" as "unknown".
    expect(Object.keys(ctx)).toEqual(['day', 'sessions', 'focusItems', 'coachingNotes']);
  });

  it('contains no ai_coaching text anywhere — the input-set property, structurally', () => {
    // The core's input type does not name ai_coaching_summary, but the fetch
    // layer hands it whole session rows that carry one. Nothing may survive
    // into the object that gets prompted with and snapshotted.
    const input = baseInput();
    (input.sessions[0] as unknown as Record<string, unknown>).ai_coaching_summary =
      '## Next Session Goals\nCarry more speed through 5.';
    const serialized = JSON.stringify(assembleDaySummaryContext(input));
    expect(serialized).not.toContain('ai_coaching');
    expect(serialized).not.toContain('Carry more speed');
  });

  it('round-trips through JSON unchanged — it IS the stored provenance snapshot', () => {
    const ctx = assembleDaySummaryContext(baseInput());
    expect(JSON.parse(JSON.stringify(ctx))).toEqual(ctx);
  });

  it('is deterministic: the same day from differently-ordered rows serializes identically', () => {
    // Task 3 asserts the stored prompt_context deep-equals the object that was
    // prompted with; row order out of PostgREST must not be able to change it.
    // EVERY array is permuted, not just sessions: each one arrives from its own
    // embed with its own unspecified order, and a comparator missing from any
    // of them is the same bug.
    const withEverything = (): DaySummaryInput => ({
      ...withFocus(),
      coachingNotes: [
        {
          id: 'n-1',
          session_id: 's-1',
          author: 'coach',
          body: 'Warm-up run.',
          created_at: null,
        },
        {
          id: 'n-2',
          session_id: 's-1',
          author: 'coach',
          body: 'Same session, also undated.',
          created_at: null,
        },
        {
          id: 'n-3',
          session_id: 's-3',
          author: 'coach',
          body: 'Traffic all run.',
          created_at: '2026-07-12T21:40:00Z',
        },
      ],
    });

    const a = withEverything();
    const b = withEverything();
    b.sessions.reverse();
    b.focusItems.reverse();
    b.originSessions.reverse();
    b.assessmentSessions.reverse();
    b.coachingNotes.reverse();
    for (const item of b.focusItems) item.focus_item_assessments.reverse();

    expect(JSON.stringify(assembleDaySummaryContext(b))).toBe(
      JSON.stringify(assembleDaySummaryContext(a))
    );
  });

  it('does not mutate its input', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    assembleDaySummaryContext(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('informingIdsFrom', () => {
  it('derives both id sets from the context object itself, in its own order', () => {
    // Never a parallel query: a session imported mid-generation must not
    // desynchronize the recorded ids from the snapshot they claim to describe.
    const input = baseInput();
    input.focusItems = [
      {
        id: 'item-1',
        text: 'Brake later into T5',
        status: 'active',
        created_at: '2026-07-05T18:00:00Z',
        created_after_session_id: null,
        focus_item_assessments: [
          {
            id: 'a-2',
            session_id: 's-2',
            judgment: 'improved',
            note: null,
            created_at: '2026-07-12T18:30:00Z',
          },
          {
            id: 'a-1',
            session_id: 's-1',
            judgment: 'keep_working',
            note: null,
            created_at: '2026-07-12T15:30:00Z',
          },
        ],
      },
    ];
    const ctx = assembleDaySummaryContext(input);
    expect(informingIdsFrom(ctx)).toEqual({
      sessionIds: ['s-1', 's-2', 's-3'],
      assessmentIds: ['a-1', 'a-2'],
    });
  });

  it('returns empty arrays for an empty day rather than omitting the keys', () => {
    const ctx = assembleDaySummaryContext({
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
    expect(informingIdsFrom(ctx)).toEqual({ sessionIds: [], assessmentIds: [] });
  });
});

describe('daySummaryView', () => {
  const row = (id: string, status: string) => ({ id, status });

  it('state 1 — no rows: nothing is current', () => {
    expect(daySummaryView([])).toEqual({ current: null, pendingDraft: null });
  });

  it('state 2 — draft only: the draft is current', () => {
    const draft = row('d', 'draft');
    expect(daySummaryView([draft])).toEqual({ current: draft, pendingDraft: null });
  });

  it('state 3 — approved only: the approved row is current', () => {
    const approved = row('a', 'approved');
    expect(daySummaryView([approved])).toEqual({ current: approved, pendingDraft: null });
  });

  it('state 5 — approved beside a draft: approved stays current, draft is the revision', () => {
    // A dangling draft is a valid, expected state ("coach considering a
    // rewrite") and must never leave the day without a current summary.
    const approved = row('a', 'approved');
    const draft = row('d', 'draft');
    expect(daySummaryView([draft, approved])).toEqual({
      current: approved,
      pendingDraft: draft,
    });
  });

  it('ignores superseded rows entirely', () => {
    const superseded = row('s', 'superseded');
    const draft = row('d', 'draft');
    expect(daySummaryView([superseded])).toEqual({ current: null, pendingDraft: null });
    expect(daySummaryView([superseded, draft])).toEqual({ current: draft, pendingDraft: null });
  });
});

describe('editedAfterApproval', () => {
  it('is true only for an approved row touched after its approval', () => {
    expect(
      editedAfterApproval({
        status: 'approved',
        approved_at: '2026-07-12T20:00:00Z',
        updated_at: '2026-07-12T20:05:00Z',
      })
    ).toBe(true);
  });

  it('is false at the instant of approval — the DB stamps both from one now()', () => {
    // The chip is the phase's whole disclosure budget; born lit, it says nothing.
    expect(
      editedAfterApproval({
        status: 'approved',
        approved_at: '2026-07-12T20:00:00Z',
        updated_at: '2026-07-12T20:00:00Z',
      })
    ).toBe(false);
  });

  it('is false for a draft, however often it autosaved', () => {
    expect(
      editedAfterApproval({
        status: 'draft',
        approved_at: null,
        updated_at: '2026-07-12T20:05:00Z',
      })
    ).toBe(false);
  });

  it('is false when there is no approval instant to compare against', () => {
    expect(
      editedAfterApproval({
        status: 'approved',
        approved_at: null,
        updated_at: '2026-07-12T20:05:00Z',
      })
    ).toBe(false);
  });
});

describe('isReplacedWriteError', () => {
  it('recognizes a trigger-matrix rejection by its prefix', () => {
    expect(
      isReplacedWriteError({ code: 'P0001', message: 'day_summaries: superseded rows are frozen' })
    ).toBe(true);
  });

  it('recognizes the one-live-draft collision, which never says day_summaries:', () => {
    expect(
      isReplacedWriteError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "day_summaries_one_live_draft"',
      })
    ).toBe(true);
  });

  it('leaves unrelated failures alone', () => {
    expect(isReplacedWriteError({ code: '08006', message: 'connection to server was lost' })).toBe(
      false
    );
    expect(isReplacedWriteError(null)).toBe(false);
  });
});
