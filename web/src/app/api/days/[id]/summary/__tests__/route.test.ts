/**
 * @jest-environment node
 *
 * The day-summary WRITE PATH: generate, edit, approve.
 *
 * Three routes, one file, because they share one contract and the interesting
 * regressions live between them:
 *
 *  - POST /api/days/[id]/summary        — generate a draft
 *  - PATCH /api/day-summaries/[id]      — edit final_text
 *  - POST /api/day-summaries/[id]/approve
 *
 * Two properties are load-bearing and neither is visible in any single route:
 *
 *  1. PROVENANCE IDENTITY. The object handed to the prompt builder is the object
 *     stored in `prompt_context`. Only the generate route can break it, and it
 *     breaks silently — the draft still reads fine, it just stops being
 *     reproducible from the row that claims to record it.
 *  2. The REPLACED error. All three write against a table whose triggers reject
 *     stale writes, and every one of them must surface that as 409
 *     `{ error: 'replaced' }` rather than a 500. Two different DB conditions
 *     produce it (the trigger matrix's message, and a plain 23505 from the
 *     one-live-draft index), so testing one route's mapping proves nothing about
 *     the others.
 */

import { NextRequest } from 'next/server';
import { POST as generate } from '../route';
import { PATCH as editSummary } from '@/app/api/day-summaries/[id]/route';
import { POST as approve } from '@/app/api/day-summaries/[id]/approve/route';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { createServerSupabase } from '@/lib/supabase/server';
import { wrapLLMCall } from '@/lib/llm-telemetry';
import { buildDaySummaryContext } from '@/data/day-summaries';
import { AI_MODEL, buildDaySummaryPrompt } from '@/lib/coaching-prompts';
import { informingIdsFrom, type DaySummaryContext } from '@/lib/day-summaries';

jest.mock('@/lib/auth/current-coach');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/llm-telemetry');
jest.mock('@/data/day-summaries');
// NOT mocked: @/lib/day-summaries, which owns isReplacedWriteError. The 409
// tests below exercise the real classifier rather than a mock's return value.

/** The Anthropic SDK, stubbed at the one method the route calls. */
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create: (...args: unknown[]) => mockMessagesCreate(...args) };
  },
}));

const mockGetCurrentCoach = getCurrentCoach as jest.MockedFunction<typeof getCurrentCoach>;
const mockCreateServerSupabase = createServerSupabase as jest.MockedFunction<
  typeof createServerSupabase
>;
const mockWrapLLMCall = wrapLLMCall as jest.MockedFunction<typeof wrapLLMCall>;
const mockBuildDaySummaryContext = buildDaySummaryContext as jest.MockedFunction<
  typeof buildDaySummaryContext
>;

const coach = { id: 'coach-1', email: 'coach@example.com' } as Awaited<
  ReturnType<typeof getCurrentCoach>
>;

/**
 * A context with two sessions, an item carrying two assessments and a note —
 * enough that informingIdsFrom has something to derive and the prompt has
 * something to render.
 */
const ctx: DaySummaryContext = {
  day: {
    trackName: 'Thunderhill',
    date: '2026-07-28',
    driverName: 'Taylor Brooks',
    sessionCount: 2,
    notes: 'Hot and dusty all afternoon.',
  },
  sessions: [
    {
      id: 'session-1',
      label: 'Session 1',
      bestLapMs: 95000,
      countableLapCount: 6,
      consistencySeconds: 1.2,
      consistencyUnavailableReason: null,
      delta: null,
      representativeness: null,
      representativenessNote: null,
    },
    {
      id: 'session-2',
      label: 'Session 2',
      bestLapMs: 94000,
      countableLapCount: 7,
      consistencySeconds: 0.9,
      consistencyUnavailableReason: null,
      delta: { vsLabel: 'Session 1', bestLapDeltaMs: -1000, sigmaDeltaSeconds: -0.3 },
      representativeness: 'partial',
      representativenessNote: 'Traffic on the back half.',
    },
  ],
  focusItems: [
    {
      id: 'item-1',
      text: 'Brake later into 5',
      status: 'active',
      origin: 'from Thunderhill, 2026-07-12',
      assessments: [
        {
          id: 'assessment-1',
          sessionId: 'session-1',
          sessionLabel: 'Session 1',
          judgment: 'keep_working',
          note: null,
          createdAt: '2026-07-28T15:00:00Z',
        },
        {
          id: 'assessment-2',
          sessionId: 'session-2',
          sessionLabel: 'Session 2',
          judgment: 'improved',
          note: 'Held the later marker.',
          createdAt: '2026-07-28T17:00:00Z',
        },
      ],
    },
  ],
  coachingNotes: [
    {
      sessionId: 'session-1',
      author: 'coach',
      body: 'Hands settled by lap 4.',
      createdAt: '2026-07-28T15:05:00Z',
    },
  ],
};

const DRAFT_TEXT = '## Day overview\nTwo sessions, both countable.';

const summaryRow = {
  id: 'summary-1',
  track_day_id: 'day-1',
  status: 'draft',
  draft_text: DRAFT_TEXT,
  final_text: DRAFT_TEXT,
  model: AI_MODEL,
};

type QueryResult = { data: unknown; error: unknown };

/** Every payload handed to .insert()/.update(), in order. */
let writes: Array<{ table: string; op: 'insert' | 'update'; payload: unknown }>;
/** What awaiting a chain on a given table resolves to. */
let results: Record<string, QueryResult>;

interface QueryBuilder {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  order: () => QueryBuilder;
  single: () => QueryBuilder;
  maybeSingle: () => QueryBuilder;
  insert: (payload: unknown) => QueryBuilder;
  update: (payload: unknown) => QueryBuilder;
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
}

/**
 * Minimal stand-in for the Supabase query builder — same shape as the
 * import-session test's, plus .update()/.maybeSingle()/.order(). Every method
 * returns the builder; awaiting it resolves to the table's canned result.
 */
function makeSupabaseStub(): ReturnType<typeof createServerSupabase> {
  const stub = {
    from(table: string): QueryBuilder {
      const builder: QueryBuilder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
        insert: (payload: unknown) => {
          writes.push({ table, op: 'insert', payload });
          return builder;
        },
        update: (payload: unknown) => {
          writes.push({ table, op: 'update', payload });
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

function summaryWrites(op: 'insert' | 'update'): Record<string, unknown>[] {
  return writes
    .filter((write) => write.table === 'day_summaries' && write.op === op)
    .map((write) => write.payload as Record<string, unknown>);
}

function makeRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const dayParams = { params: { id: 'day-1' } };
const summaryParams = { params: { id: 'summary-1' } };

const originalApiKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  writes = [];
  results = { day_summaries: { data: summaryRow, error: null } };

  mockGetCurrentCoach.mockResolvedValue(coach);
  mockCreateServerSupabase.mockImplementation(() => makeSupabaseStub());
  mockBuildDaySummaryContext.mockResolvedValue(ctx);
  mockWrapLLMCall.mockResolvedValue({
    output: DRAFT_TEXT,
    tokensIn: 100,
    tokensOut: 200,
    cost: 0.01,
    latencyMs: 1200,
  });
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: DRAFT_TEXT }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 200 },
  });
});

/**
 * wrapLLMCall's contract in miniature: run the call, hand back its output, let a
 * throw escape (the real one records it in telemetry first, then rethrows).
 *
 * The default mock above resolves a canned string and never runs the route's
 * callback, which is where the stop_reason guard lives — so the truncation tests
 * swap this in to actually execute it.
 *
 * The escaping throw is the load-bearing half, and it mirrors the real rethrow at
 * llm-telemetry.ts:288 — which nothing else pins (that module has no test suite).
 * If you change that rethrow, change this.
 */
function runTheCallback() {
  mockWrapLLMCall.mockImplementation(async (_options, callFn) => {
    const { output } = await callFn();
    return { output, tokensIn: 100, tokensOut: 2000, cost: 0.01, latencyMs: 1200 };
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  process.env.ANTHROPIC_API_KEY = originalApiKey;
});

describe('POST /api/days/[id]/summary', () => {
  it('returns 401 when there is no coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(null);

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    expect(res.status).toBe(401);
    expect(mockBuildDaySummaryContext).not.toHaveBeenCalled();
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('returns 404 without calling the model when the day is not the coach\'s', async () => {
    mockBuildDaySummaryContext.mockResolvedValue(null);

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    expect(res.status).toBe(404);
    expect(mockWrapLLMCall).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('stores the SAME object it prompted with, and ids derived from it', async () => {
    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.summary).toEqual(summaryRow);

    const inserts = summaryWrites('insert');
    expect(inserts).toHaveLength(1);
    const captured = inserts[0];

    // The provenance-identity regression: prompt_context IS the builder's
    // object, not a reshaped copy assembled beside it.
    expect(captured.prompt_context).toEqual(ctx);
    expect(captured.prompt_context).toBe(ctx);

    // And it round-trips: the stored context reproduces, character for
    // character, the prompt the model was actually given. A route that prompted
    // with one object and stored another passes the deep-equality check above
    // only until the two shapes drift; this one fails immediately.
    expect(mockWrapLLMCall).toHaveBeenCalledTimes(1);
    expect(mockWrapLLMCall.mock.calls[0][0]).toMatchObject({
      provider: 'anthropic',
      model: AI_MODEL,
      prompt: buildDaySummaryPrompt(captured.prompt_context as DaySummaryContext),
      metadata: {
        project: 'track-app',
        feature: 'day-summary',
        coachId: 'coach-1',
        dayId: 'day-1',
      },
    });

    // Informing ids come off the context object, never from a second query.
    expect(captured.informing_session_ids).toEqual(informingIdsFrom(ctx).sessionIds);
    expect(captured.informing_assessment_ids).toEqual(informingIdsFrom(ctx).assessmentIds);

    expect(captured.track_day_id).toBe('day-1');
    expect(captured.draft_text).toBe(DRAFT_TEXT);
    // Seeded at insert — the one invariant left to route discipline, since the
    // seed generator legitimately inserts rows where the two differ.
    expect(captured.final_text).toBe(captured.draft_text);
    expect(captured.model).toBe(AI_MODEL);
    // status is the column default; approval fields belong to approve alone.
    expect(captured).not.toHaveProperty('status');
    expect(captured).not.toHaveProperty('approved_by');
    expect(captured).not.toHaveProperty('approved_at');
    // DB triggers own the timestamps.
    expect(captured).not.toHaveProperty('updated_at');
  });

  it('writes NO row when the model call fails', async () => {
    mockWrapLLMCall.mockRejectedValue(new Error('anthropic: overloaded'));

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    // State 4 honesty: a failed generation leaves no row behind claiming to be
    // a summary of this day.
    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it('writes NO row when the model returns empty text', async () => {
    mockWrapLLMCall.mockResolvedValue({
      output: '',
      tokensIn: 100,
      tokensOut: 0,
      cost: 0.01,
      latencyMs: 900,
    });

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it('writes NO row when the generation was truncated at max_tokens', async () => {
    // A rich day can hit the cap. The text that comes back reads fine and ends
    // mid-sentence — and draft_text is immutable with no DELETE policy, so
    // storing it once makes a truncated summary this day's permanent record.
    runTheCallback();
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '## Day overview\nSession 2 was quicker because the' }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 100, output_tokens: 2000 },
    });

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    expect(res.status).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it('stores the draft when the model stopped on its own', async () => {
    // The other direction: the guard is a named stop reason, not a blanket
    // refusal to trust the callback's output.
    runTheCallback();

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);

    expect(res.status).toBe(201);
    expect(summaryWrites('insert')).toHaveLength(1);
    expect(summaryWrites('insert')[0].draft_text).toBe(DRAFT_TEXT);
  });

  it('maps the one-live-draft collision (23505) to 409 replaced, not 500', async () => {
    // Two generates for one day overlapping: the second insert loses the race
    // to day_summaries_one_live_draft. The index raises a plain unique
    // violation whose message says nothing about day_summaries, so a route that
    // only matched the trigger matrix's message prefix would 500 here.
    results.day_summaries = {
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "day_summaries_one_live_draft"',
      },
    };

    const res = await generate(makeRequest('/api/days/day-1/summary', 'POST'), dayParams);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('replaced');
  });
});

describe('PATCH /api/day-summaries/[id]', () => {
  it('returns 401 when there is no coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(null);

    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: 'edited' }),
      summaryParams
    );

    expect(res.status).toBe(401);
    expect(writes).toHaveLength(0);
  });

  it('rejects text that is empty once trimmed', async () => {
    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: '   ' }),
      summaryParams
    );

    expect(res.status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it('updates final_text and nothing else', async () => {
    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: 'coach wording' }),
      summaryParams
    );

    expect(res.status).toBe(200);

    const updates = summaryWrites('update');
    expect(updates).toHaveLength(1);
    // Immutable columns are the DB's to refuse; sending them at all would make
    // every edit a trigger violation.
    expect(Object.keys(updates[0])).toEqual(['final_text']);
    expect(updates[0].final_text).toBe('coach wording');
  });

  it('stores the text exactly as sent, whitespace and all', async () => {
    // A deliberate divergence from the focus-item PATCH, which trims: this is
    // multi-line markdown from a debounced autosave, and trimming every save
    // would eat the paragraph break the coach is typing into.
    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: '  coach wording\n\n' }),
      summaryParams
    );

    expect(res.status).toBe(200);
    expect(summaryWrites('update')[0].final_text).toBe('  coach wording\n\n');
  });

  it('maps a write-matrix rejection to 409 replaced, never a 500', async () => {
    // The draft this edit was typed against has since been superseded by a
    // regenerate. The coach did nothing wrong and their tab is simply stale.
    results.day_summaries = {
      data: null,
      error: { code: 'P0001', message: 'day_summaries: superseded rows are frozen' },
    };

    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: 'edited' }),
      summaryParams
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('replaced');
    expect(json.message).toContain('refresh');
  });

  it('leaves an unrelated database failure as a 500', async () => {
    // The 409 mapping is a named condition, not a catch-all: a connection
    // failure reported as "replaced" would send the coach to refresh a page
    // that cannot load.
    results.day_summaries = {
      data: null,
      error: { code: '08006', message: 'connection to server was lost' },
    };

    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: 'edited' }),
      summaryParams
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).not.toBe('replaced');
  });

  it('returns 404 when the row is not the coach\'s', async () => {
    results.day_summaries = { data: null, error: null };

    const res = await editSummary(
      makeRequest('/api/day-summaries/summary-1', 'PATCH', { finalText: 'edited' }),
      summaryParams
    );

    expect(res.status).toBe(404);
  });
});

describe('POST /api/day-summaries/[id]/approve', () => {
  it('returns 401 when there is no coach', async () => {
    mockGetCurrentCoach.mockResolvedValue(null);

    const res = await approve(
      makeRequest('/api/day-summaries/summary-1/approve', 'POST'),
      summaryParams
    );

    expect(res.status).toBe(401);
    expect(writes).toHaveLength(0);
  });

  it('sends status, approver and a non-null approved_at, and nothing else', async () => {
    results.day_summaries = {
      data: { ...summaryRow, status: 'approved', approved_by: 'coach-1' },
      error: null,
    };

    const res = await approve(
      makeRequest('/api/day-summaries/summary-1/approve', 'POST'),
      summaryParams
    );

    expect(res.status).toBe(200);

    const updates = summaryWrites('update');
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0]).sort()).toEqual(['approved_at', 'approved_by', 'status']);
    expect(updates[0].status).toBe('approved');
    expect(updates[0].approved_by).toBe('coach-1');
    // The trigger overwrites this with now(), but the CHECK constraint
    // day_summaries_approved_has_approver is evaluated on the finished row and
    // a null here raises before the trigger's value would ever land. Dropping
    // the field as "redundant" breaks every approval.
    expect(updates[0].approved_at).not.toBeNull();
    expect(updates[0].approved_at).toEqual(expect.any(String));
    // Approval never carries text: a payload race with the debounced edit is
    // how an approved summary ends up holding stale wording.
    expect(updates[0]).not.toHaveProperty('final_text');
  });

  it('maps a write-matrix rejection to 409 replaced, never a 500', async () => {
    results.day_summaries = {
      data: null,
      error: { code: 'P0001', message: 'day_summaries: superseded rows are frozen' },
    };

    const res = await approve(
      makeRequest('/api/day-summaries/summary-1/approve', 'POST'),
      summaryParams
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('replaced');
  });

  it('leaves an unrelated database failure as a 500', async () => {
    // Same reason as the PATCH's twin: approve reporting a connection failure
    // as "replaced" sends the coach to refresh a page that cannot load.
    results.day_summaries = {
      data: null,
      error: { code: '08006', message: 'connection to server was lost' },
    };

    const res = await approve(
      makeRequest('/api/day-summaries/summary-1/approve', 'POST'),
      summaryParams
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).not.toBe('replaced');
  });

  it('returns 404 when the row is not the coach\'s', async () => {
    // RLS returns an empty update, not an error. Without this branch approve
    // answers 200 with a null summary for someone else's row.
    results.day_summaries = { data: null, error: null };

    const res = await approve(
      makeRequest('/api/day-summaries/summary-1/approve', 'POST'),
      summaryParams
    );

    expect(res.status).toBe(404);
  });
});
