/**
 * @jest-environment node
 *
 * The session-coaching route, after the observation-only rewrite.
 *
 * Only the EDGES are mocked — the coach, the Supabase client, the telemetry
 * wrapper, the Anthropic SDK, and the debrief query. The fetch layer
 * (`@/data/day-summaries`), the assembly core, the eligibility function and the
 * prompt builder all run for real, because the three properties worth pinning
 * here are only visible end to end:
 *
 *  1. NO AI TEXT REACHES THE PROMPT. The session rows this route's day context
 *     is assembled from carry `ai_coaching_summary` — this route's own previous
 *     output. The loop-back is closed by the input type's tripwire and by the
 *     adapter projecting field by field; with the real fetch layer in the run,
 *     the assertion below actually exercises that. Mocking the context object
 *     would make it unfalsifiable.
 *  2. ELIGIBILITY IS THE BANNER'S, ANCHORED ON THE FOCAL SESSION. An item is
 *     never evidence against its own origin session, and it becomes evidence at
 *     the very next one. A route that anchored on the day rather than the
 *     session, or that passed every item id, still renders a plausible prompt.
 *  3. NO WRITE ON A FAILED OR TRUNCATED GENERATION. The write is a destructive
 *     overwrite of `ai_coaching_summary`, so a bad generation that reaches the
 *     update costs the coach the previous good text.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { createServerSupabase } from '@/lib/supabase/server';
import { wrapLLMCall } from '@/lib/llm-telemetry';
import { getTrackDayDebrief } from '@/data/track-days';
import { AI_MODEL } from '@/lib/coaching-prompts';
import type { TrackDayDebrief } from '@/lib/types';

jest.mock('@/lib/auth/current-coach');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/llm-telemetry');
jest.mock('@/data/track-days');

/**
 * The Anthropic SDK, stubbed at the one method the route calls — plus the
 * static `APIError` its catch block narrows on. Without that static, every
 * failure path dies inside the catch on `instanceof undefined` and the route
 * answers 500 for the wrong reason.
 */
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  return {
    __esModule: true,
    default: class {
      static APIError = APIError;
      messages = { create: (...args: unknown[]) => mockMessagesCreate(...args) };
    },
  };
});

const mockGetCurrentCoach = getCurrentCoach as jest.MockedFunction<typeof getCurrentCoach>;
const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;
const mockWrapLLMCall = wrapLLMCall as jest.MockedFunction<typeof wrapLLMCall>;
const mockGetTrackDayDebrief = getTrackDayDebrief as jest.MockedFunction<
  typeof getTrackDayDebrief
>;

const coach = { id: 'coach-1', email: 'coach@example.com' } as Awaited<
  ReturnType<typeof getCurrentCoach>
>;

/** This route's own previous output, sitting on the rows the context is built from. */
const AI_TEXT = 'AI SAYS: carry more speed through 5 and brake later into 7.';

const TIGHT_6 = [90000, 90100, 90050, 90080, 90020, 90060];

const lapRows = (timesMs: Array<number | null>) =>
  timesMs.map((lap_time_ms, i) => ({ lap_number: i + 1, lap_time_ms }));

/** Carried in from another day — in play for every session of this one. */
const ITEM_CARRIED_IN = {
  id: 'item-carried-in',
  text: 'Brake later into T5',
  status: 'active',
  created_at: '2026-07-05T18:00:00Z',
  created_after_session_id: 'prev-day-session',
  focus_item_assessments: [],
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

/**
 * Reviewed AT session 2 and signed off there. No longer active, so it is in
 * `reviewed` and NOT in `inPlay` — the half of the union a route that only
 * carried `inPlay` would silently drop, taking the assessment the model is
 * meant to weigh this session's data against with it.
 */
const ITEM_ACHIEVED_AT_S2 = {
  id: 'item-achieved-at-s2',
  text: 'Settle the hands before turn-in',
  status: 'achieved',
  created_at: '2026-07-05T18:00:00Z',
  created_after_session_id: 'prev-day-session',
  focus_item_assessments: [
    {
      id: 'a-s2',
      session_id: 's-2',
      judgment: 'improved',
      note: 'Quiet hands all run.',
      created_at: '2026-07-12T18:40:00Z',
    },
  ],
};

const daySession = (id: string, date: string, bestLapMs: number) => ({
  id,
  date,
  best_lap_ms: bestLapMs,
  representativeness: null,
  representativeness_note: null,
  // The loop-back this route has to keep closed.
  ai_coaching_summary: AI_TEXT,
  laps: lapRows(TIGHT_6),
});

const debrief = () =>
  ({
    id: 'day-1',
    driver_id: 'driver-1',
    track_id: 'track-1',
    date: '2026-07-12',
    notes: 'Hot, 95F.',
    driver: { id: 'driver-1', name: 'Elena Ross', email: 'elena@example.com' },
    track: { id: 'track-1', name: 'Thunderhill', timezone: 'America/Los_Angeles' },
    sessions: [
      daySession('s-1', '2026-07-12T15:00:00Z', 91000),
      daySession('s-2', '2026-07-12T18:00:00Z', 90200),
      daySession('s-3', '2026-07-12T21:00:00Z', 89500),
    ],
    focusItems: [ITEM_CARRIED_IN, ITEM_BORN_AT_S2, ITEM_ACHIEVED_AT_S2],
    originSessions: [
      {
        id: 'prev-day-session',
        date: '2026-07-05T18:00:00Z',
        track_day: { date: '2026-07-05', track: { name: 'Sonoma' } },
      },
      {
        id: 's-2',
        date: '2026-07-12T18:00:00Z',
        track_day: { date: '2026-07-12', track: { name: 'Thunderhill' } },
      },
    ],
    assessmentSessions: [],
  }) as unknown as TrackDayDebrief;

const COACHING_TEXT = "## Session in the day's arc\nSession 2 was 0.8s quicker.";

type QueryResult = { data: unknown; error: unknown };

/** Every payload handed to .update(), in order. */
let writes: Array<{ table: string; payload: unknown }>;
/** What awaiting a chain on a given table resolves to. */
let results: Record<string, QueryResult>;

interface QueryBuilder {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  in: () => QueryBuilder;
  order: () => QueryBuilder;
  single: () => QueryBuilder;
  update: (payload: unknown) => QueryBuilder;
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
}

function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from(table: string): QueryBuilder {
      const builder: QueryBuilder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        single: () => builder,
        update: (payload: unknown) => {
          writes.push({ table, payload });
          return builder;
        },
        then: (onFulfilled, onRejected) =>
          Promise.resolve(results[table] ?? { data: null, error: null }).then(
            onFulfilled,
            onRejected
          ),
      };
      return builder;
    },
  };
  return stub as unknown as ReturnType<typeof createServerSupabase>;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/coaching/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** The prompt the route actually handed to the model. */
function promptSent(): string {
  return (mockWrapLLMCall.mock.calls[0][0] as { prompt: string }).prompt;
}

/**
 * wrapLLMCall's contract in miniature: run the call, hand back its output, let a
 * throw escape (the real one records it in telemetry first, then rethrows).
 *
 * The default mock resolves a canned string and never runs the route's callback,
 * which is where the stop_reason guard lives — so the truncation tests swap this
 * in to actually execute it. Mirrors the sibling summary route's test harness.
 */
function runTheCallback() {
  mockWrapLLMCall.mockImplementation(async (_options, callFn) => {
    const { output } = await callFn();
    return { output, tokensIn: 100, tokensOut: 1500, cost: 0.01, latencyMs: 1200 };
  });
}

const originalApiKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  writes = [];
  results = {
    sessions: {
      data: {
        id: 's-2',
        date: '2026-07-12T18:00:00Z',
        driver_id: 'driver-1',
        track_day_id: 'day-1',
      },
      error: null,
    },
    laps: { data: lapRows([...TIGHT_6, 0]), error: null },
    driver_profiles: {
      data: { experience_level: 'intermediate', total_sessions: 12 },
      error: null,
    },
    coaching_notes: { data: [], error: null },
  };

  mockGetCurrentCoach.mockResolvedValue(coach);
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
  mockGetTrackDayDebrief.mockResolvedValue({ data: debrief(), error: null });
  mockWrapLLMCall.mockResolvedValue({
    output: COACHING_TEXT,
    tokensIn: 100,
    tokensOut: 400,
    cost: 0.01,
    latencyMs: 1200,
  });
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: COACHING_TEXT }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 400 },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env.ANTHROPIC_API_KEY = originalApiKey;
});

describe('POST /api/coaching/generate', () => {
  it('returns 401 when there is no coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(null);

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(401);
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('refuses the generation when the session has no track day', async () => {
    // Post-P1 a session without a day is corrupt data, not a supported state:
    // there is exactly one prompt for this route and it is day-aware, so there
    // is nothing to fall back to.
    results.sessions = {
      data: {
        id: 's-2',
        date: '2026-07-12T18:00:00Z',
        driver_id: 'driver-1',
        track_day_id: null,
      },
      error: null,
    };

    const res = await POST(makeRequest({ sessionId: 's-2' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toContain('no track day');
    expect(mockGetTrackDayDebrief).not.toHaveBeenCalled();
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('refuses the generation when the day context comes back empty', async () => {
    // A 500, not the sibling route's 404: the session row was already read under
    // this coach's RLS and sessions.track_day_id is an FK, so an empty day read
    // here is corruption, not "not yours".
    mockGetTrackDayDebrief.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest({ sessionId: 's-2' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    // The named refusal, not the generic catch: without the explicit branch the
    // route dies destructuring null and 500s for a reason nobody can act on.
    expect(json.error).toContain('Track day not found');
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('refuses a session that cannot claim consistency, before the model call', async () => {
    results.laps = { data: lapRows([90000, 90100, 0, null, 90050]), error: null };

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(400);
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('prompts with the day context, the focal session marked, and stores the result', async () => {
    const res = await POST(makeRequest({ sessionId: 's-2' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.coaching).toBe(COACHING_TEXT);

    expect(mockWrapLLMCall).toHaveBeenCalledTimes(1);
    expect(mockWrapLLMCall.mock.calls[0][0]).toMatchObject({
      provider: 'anthropic',
      model: AI_MODEL,
      metadata: {
        project: 'track-app',
        feature: 'ai-coaching',
        userId: 'driver-1',
        coachId: 'coach-1',
        sessionId: 's-2',
      },
    });

    const prompt = promptSent();
    // The whole day is context, with one session in focus.
    expect(prompt).toContain('Session 2 (THIS SESSION)');
    expect(prompt).toContain('Session 3 (after this session)');
    // The focal session's laps, from the laps query, through the one predicate:
    // the 0 row is absent and the numbers are as recorded.
    expect(prompt).toContain('Lap 1: 1:30.000');
    expect(prompt).not.toContain('0:00.000');
    // The driver profile the route reads is passed through, not dropped.
    expect(prompt).toContain('Sessions completed: 12');

    // The overwrite, and nothing else.
    expect(writes).toEqual([
      { table: 'sessions', payload: { ai_coaching_summary: COACHING_TEXT } },
    ]);
  });

  it('asks for the observation contract, not a prompt of its own', async () => {
    // The route's own prompt used to live inline and ask for improvements to
    // make and goals for next time. These are the builder's strings: an inline
    // prompt reintroduced here fails every one of them. (The old headings are
    // deliberately NOT quoted, here or anywhere: grepping the tree for them is
    // the reviewer's check that the prescriptive contract is gone, and an
    // assertion naming them puts the phrase back in the tree it is meant to be
    // absent from. The prompt builder's tests pin the three settled sections.)
    await POST(makeRequest({ sessionId: 's-2' }));
    const prompt = promptSent();

    expect(prompt).toContain("## Session in the day's arc");
    expect(prompt).toContain('## Evidence on focus items');
    expect(prompt).toContain("## Patterns worth the coach's attention");
    expect(prompt).toContain('NEVER author new driving instructions');
    expect(prompt).toContain('never judge this session with hindsight');
  });

  it('never shows the model its own previous output', async () => {
    // Every session row the context is assembled from carries this route's
    // prior generation. The input type's tripwire and the adapter's field-by-
    // field projection are what keep it out; this is that property, end to end.
    await POST(makeRequest({ sessionId: 's-2' }));

    expect(promptSent()).not.toContain(AI_TEXT);
    expect(promptSent()).not.toContain('ai_coaching');
  });

  it('takes its item set from the shared banner function, anchored on the focal session', async () => {
    // item-born-at-s2 was the coach's response TO session 2, not something
    // session 2 tested — and it becomes evidence at the very next session. The
    // exclusion arrives by reusing focusItemsForSession with the FOCAL session
    // as anchor; a route anchored on the day would show it in both.
    await POST(makeRequest({ sessionId: 's-2' }));
    const atS2 = promptSent();
    expect(atS2).toContain('Brake later into T5');
    expect(atS2).not.toContain('Unwind the wheel earlier');
    // Both halves of the union: an item reviewed AT this session belongs in
    // evidence even though it is no longer active, so `inPlay` alone is not the
    // item set.
    expect(atS2).toContain('Settle the hands before turn-in');

    jest.clearAllMocks();
    mockWrapLLMCall.mockResolvedValue({
      output: COACHING_TEXT,
      tokensIn: 100,
      tokensOut: 400,
      cost: 0.01,
      latencyMs: 1200,
    });
    results.sessions = {
      data: {
        id: 's-3',
        date: '2026-07-12T21:00:00Z',
        driver_id: 'driver-1',
        track_day_id: 'day-1',
      },
      error: null,
    };

    await POST(makeRequest({ sessionId: 's-3' }));
    expect(promptSent()).toContain('Unwind the wheel earlier');
  });

  it('leaves the stored summary alone when the model call fails', async () => {
    mockWrapLLMCall.mockRejectedValue(new Error('anthropic: overloaded'));

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it('leaves the stored summary alone when the generation was truncated', async () => {
    // The write is a DESTRUCTIVE overwrite: storing a generation that ends
    // mid-sentence costs the coach the previous good text. Refusing to write
    // leaves it intact with a retry available.
    runTheCallback();
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: "## Session in the day's arc\nSession 2 was quicker because the" }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 100, output_tokens: 1500 },
    });

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it('stores the generation when the model stopped on its own', async () => {
    // The other direction: the guard is a named stop reason, not a blanket
    // refusal to trust the callback's output.
    runTheCallback();

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(200);
    expect(writes).toEqual([
      { table: 'sessions', payload: { ai_coaching_summary: COACHING_TEXT } },
    ]);
  });

  it('leaves the stored summary alone when the model returns nothing', async () => {
    mockWrapLLMCall.mockResolvedValue({
      output: '',
      tokensIn: 100,
      tokensOut: 0,
      cost: 0.01,
      latencyMs: 900,
    });

    const res = await POST(makeRequest({ sessionId: 's-2' }));

    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });
});
