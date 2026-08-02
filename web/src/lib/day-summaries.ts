/**
 * AI day summaries — the PURE assembly core and the current-summary selection.
 *
 * See docs/plans/2026-08-01-ai-day-summary-design.md, decisions 4 and 5.
 *
 * Two rules govern this file:
 *
 *  1. It adds STRUCTURE, not math. Every metric comes from track-days.ts /
 *     insights.ts / analytics-v2.ts. If a σ, a best lap, a delta, a baseline or
 *     an eligibility rule were computed here, the day page and the summary that
 *     describes it could disagree about the same day.
 *
 *  2. No AI-authored text enters the object. `sessions.ai_coaching_summary` is
 *     deliberately absent from the input types below, so the core cannot reach
 *     it even when the fetch layer hands it whole session rows. That absence is
 *     the design's central safety property: with no AI text in the inputs, the
 *     model cannot launder an old AI instruction into a new "summary".
 *
 * The returned object IS the provenance snapshot — it is stored verbatim in
 * `day_summaries.prompt_context` and the informing id arrays are derived from
 * it, so what informed the draft and what is recorded as informing it cannot
 * diverge. It must therefore stay plain JSON (no Date, Set, Map or undefined)
 * and be deterministic for the same input, whatever order the rows arrived in.
 */
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS, canClaimConsistency } from '@/lib/insights';
import {
  assessmentsInSessionOrder,
  bySessionStart,
  deltaBaselineIndex,
  displayedSigmaDeltaSeconds,
  displayedSigmaSeconds,
  focusPanelGroups,
  isCountableLapMs,
  sessionDelta,
  validLapTimesMs,
} from '@/lib/track-days';

/* -------------------------------------------------------------------------- */
/* Input — plain rows, the shape getTrackDayDebrief already returns            */
/* -------------------------------------------------------------------------- */

/**
 * One session of the day. Names exactly the columns the core reads; widening it
 * is how `ai_coaching_summary` would get back in.
 */
export interface DaySummarySessionInput {
  id: string;
  /** sessions.date — a timestamptz. The day's order (bySessionStart). */
  date: string;
  best_lap_ms: number | null;
  representativeness: string | null;
  representativeness_note: string | null;
  laps: Array<{ lap_time_ms: number | null }>;
  /**
   * Compile-time tripwire: a caller handing over raw session rows fails to build.
   *
   * Omitting the column is not enough. TypeScript's excess-property check does
   * not survive a spread, so `assembleDaySummaryContext({ ...debriefRow })`
   * compiles and carries the AI text into the argument at runtime — the one
   * shape the fetch layer is most likely to reach for. Typed `never`, that
   * spread is a build error, and the fetch layer has to project the session
   * fields explicitly at the boundary where the AI text actually exists. That
   * is the point of decision 5: the exclusion is structural, not vigilance.
   */
  ai_coaching_summary?: never;
}

/** A focus item with its FULL assessment history — cross-day, uncapped. */
export interface DaySummaryFocusItemInput {
  id: string;
  text: string;
  status: string;
  created_at: string;
  created_after_session_id: string | null;
  focus_item_assessments: Array<{
    id: string;
    session_id: string;
    judgment: string;
    note: string | null;
    created_at: string;
  }>;
}

/**
 * Everything the core needs, in the shape `getTrackDayDebrief` returns plus the
 * day's coaching notes — so the fetch layer is an adapter and nothing more, and
 * the seed generator can build one by hand from scenario data without a DB.
 */
export interface DaySummaryInput {
  /** track_days.date — a plain track-local calendar date. */
  date: string;
  notes: string | null;
  track: { name: string };
  driver: { name: string };
  /** Any order; the core sorts. */
  sessions: DaySummarySessionInput[];
  /** The DRIVER's items — grouping decides which belong to this day. */
  focusItems: DaySummaryFocusItemInput[];
  /** The items' origin sessions with their days — possibly OTHER days'. */
  originSessions: Array<{
    id: string;
    track_day: { date: string; track: { name: string } } | null;
  }>;
  /** id+date of every session the assessments anchor to — cross-day by design. */
  assessmentSessions: Array<{ id: string; date: string }>;
  coachingNotes: Array<{
    /**
     * Input-only, and only for the sort's final tiebreak — `created_at` is
     * nullable, so two undated notes on the same session are otherwise ordered
     * by whatever the query returned. Every other comparator in the app carries
     * an id tiebreak for the same reason. It does not reach the output: nothing
     * downstream addresses a note by id, and a field in the snapshot that
     * nothing reads is a field a future reader has to reason about.
     */
    id: string;
    session_id: string;
    author: string;
    body: string;
    created_at: string | null;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Output — the context object, and therefore the provenance snapshot          */
/* -------------------------------------------------------------------------- */

export interface DaySummaryContext {
  day: {
    trackName: string;
    date: string;
    driverName: string;
    sessionCount: number;
    notes: string | null;
  };
  sessions: Array<{
    id: string;
    /** "Session 2" — bySessionStart's numbering, the app's only one. */
    label: string;
    bestLapMs: number | null;
    /** Countable laps, not lap rows: the count σ was gated on. */
    countableLapCount: number;
    /** Null unless canClaimConsistency passed; snapped to display resolution. */
    consistencySeconds: number | null;
    /** Why σ is absent, so the model says "not claimable" rather than inventing. */
    consistencyUnavailableReason: string | null;
    delta: {
      /** The baseline session's label — a delta with an unnamed baseline is a verdict. */
      vsLabel: string;
      bestLapDeltaMs: number | null;
      sigmaDeltaSeconds: number | null;
    } | null;
    representativeness: string | null;
    representativenessNote: string | null;
  }>;
  focusItems: Array<{
    id: string;
    /** Snapshotted: items are mutable, so ids alone cannot reproduce what the AI saw. */
    text: string;
    status: string;
    /** "from Thunderhill, 2026-07-12", or null when there is nothing honest to say. */
    origin: string | null;
    assessments: Array<{
      id: string;
      sessionId: string;
      sessionLabel: string;
      judgment: string;
      note: string | null;
      createdAt: string;
    }>;
  }>;
  coachingNotes: Array<{
    sessionId: string;
    author: string;
    body: string;
    createdAt: string | null;
  }>;
}

/**
 * How an assessment anchored to a session outside this day is named.
 *
 * Assessment history is cross-day and uncapped by design, and the debrief fetch
 * carries only id+date for those sessions — no day, no track. "Session 3" would
 * name one of THIS day's sessions, and a date derived from the session's
 * timestamptz renders in the runtime's timezone. Saying less is the only honest
 * option left.
 *
 * The ordinal is what makes the cross-day narrative decision 4 exists to
 * provide legible: three prior-day assessments rendered as three identical
 * strings are three bullets the model cannot tell apart, so an item's history
 * reads as one repeated judgment instead of a trail. It counts position within
 * THIS ITEM's history, in assessmentsInSessionOrder's order — a place in a
 * sequence, which the data supports. Not the assessment's createdAt, which
 * retroactively entered debriefs scramble (see that function's docblock), and
 * not "earlier": an item still being coached can be assessed at a session
 * AFTER the day being summarized.
 */
function foreignSessionLabel(ordinal: number, total: number): string {
  return `a session on another day (${ordinal} of ${total})`;
}

/** "Session 1", "Session 2", ... — the index is bySessionStart's. */
function sessionLabel(index: number): string {
  return `Session ${index + 1}`;
}

/**
 * Assemble the context object for one track day.
 *
 * Pure: plain data in, plain JSON out, no client, no clock, no mutation of the
 * input. Every number is delegated (see the file docblock).
 */
export function assembleDaySummaryContext(input: DaySummaryInput): DaySummaryContext {
  // The day's order IS the Session N numbering; nothing downstream re-sorts.
  const ordered = [...input.sessions].sort(bySessionStart);

  // Computed once so a session can reach its baseline's σ. canClaimConsistency
  // gates and sessionConsistencySeconds computes over the SAME array, which is
  // the whole point of validLapTimesMs.
  const lapTimes = ordered.map((session) => validLapTimesMs(session.laps));
  const sigmas = lapTimes.map((times) =>
    canClaimConsistency(times) ? sessionConsistencySeconds(times) : null
  );

  const sessions = ordered.map((session, i) => {
    const times = lapTimes[i];
    const sigma = sigmas[i];

    // 0 is not a best lap — the day KPI skips it and the session card prints
    // "--" for it, so the prompt must never be handed "0:00.000". Asked with
    // the app's one lap predicate rather than a fourth copy of `!== null && > 0`.
    const bestLapMs = isCountableLapMs(session.best_lap_ms) ? session.best_lap_ms : null;

    // Nearest EARLIER counted session, or null — a delta measured against a
    // not_representative session is exactly what the flag exists to prevent.
    const baselineIndex = deltaBaselineIndex(ordered, i);
    const baseline = baselineIndex !== null ? ordered[baselineIndex] : null;

    let delta: DaySummaryContext['sessions'][number]['delta'] = null;
    if (baseline !== null && baselineIndex !== null) {
      const baselineBestLapMs = isCountableLapMs(baseline.best_lap_ms)
        ? baseline.best_lap_ms
        : null;
      const raw = sessionDelta(
        { bestLapMs: baselineBestLapMs, lapTimesMs: lapTimes[baselineIndex] },
        { bestLapMs, lapTimesMs: times }
      );
      const baselineSigma = sigmas[baselineIndex];
      delta = {
        vsLabel: sessionLabel(baselineIndex),
        bestLapDeltaMs: raw.bestLapDeltaMs,
        // sessionDelta owns WHETHER a σ delta is earned (both sides clear the
        // gate and both σ resolve); displayedSigmaDeltaSeconds owns the NUMBER,
        // subtracting the rounded figures so the delta cannot contradict the
        // two σ printed beside it.
        sigmaDeltaSeconds:
          raw.consistencyDeltaSeconds !== null && sigma !== null && baselineSigma !== null
            ? displayedSigmaDeltaSeconds(baselineSigma, sigma)
            : null,
      };
    }

    return {
      id: session.id,
      label: sessionLabel(i),
      bestLapMs,
      countableLapCount: times.length,
      consistencySeconds: sigma !== null ? displayedSigmaSeconds(sigma) : null,
      consistencyUnavailableReason: sigma !== null ? null : consistencyReason(times.length),
      delta,
      representativeness: session.representativeness,
      representativenessNote: session.representativeness_note,
    };
  });

  const labelBySessionId = new Map(ordered.map((session, i) => [session.id, sessionLabel(i)]));

  // Input assembly only — the same-day-evidence proxy itself is
  // focusPanelGroups', inherited with its intended gap, never redefined here.
  const daySessionIds = new Set(ordered.map((session) => session.id));
  const assessedThisDayItemIds = new Set(
    input.focusItems
      .filter((item) =>
        item.focus_item_assessments.some((a) => daySessionIds.has(a.session_id))
      )
      .map((item) => item.id)
  );
  const { active, resolvedThisDay } = focusPanelGroups({
    items: input.focusItems,
    assessedThisDayItemIds,
  });

  // Every session an assessment can anchor to: this day's, plus the cross-day
  // ones the debrief fetched by id.
  const assessmentSessionsById = new Map<string, { id: string; date: string }>([
    ...ordered.map((session) => [session.id, { id: session.id, date: session.date }] as const),
    ...input.assessmentSessions.map((session) => [session.id, session] as const),
  ]);
  const originById = new Map(input.originSessions.map((origin) => [origin.id, origin]));

  const focusItems = [...active, ...resolvedThisDay].map((item) => {
    const inSessionOrder = assessmentsInSessionOrder(
      item.focus_item_assessments,
      assessmentSessionsById
    );
    // Numbered per ITEM, so "(2 of 3)" is a position in this item's own trail.
    const foreignTotal = inSessionOrder.filter(
      (assessment) => !labelBySessionId.has(assessment.session_id)
    ).length;
    let foreignSeen = 0;

    return {
      id: item.id,
      text: item.text,
      status: item.status,
      origin: originLabel(item, originById),
      assessments: inSessionOrder.map((assessment) => {
        const thisDayLabel = labelBySessionId.get(assessment.session_id);
        return {
          id: assessment.id,
          sessionId: assessment.session_id,
          sessionLabel:
            thisDayLabel ?? foreignSessionLabel((foreignSeen += 1), foreignTotal),
          judgment: assessment.judgment,
          note: assessment.note,
          createdAt: assessment.created_at,
        };
      }),
    };
  });

  // Notes read in the day's arc, not in whatever order the query returned.
  // Three keys, and the last one always decides: created_at is nullable, so two
  // undated notes on the same session tie on both of the first two and would
  // otherwise keep row order — which is exactly what this object may not depend
  // on (see the file docblock).
  const sessionOrder = new Map(ordered.map((session, i) => [session.id, i]));
  const coachingNotes = [...input.coachingNotes]
    .sort(
      (a, b) =>
        (sessionOrder.get(a.session_id) ?? ordered.length) -
          (sessionOrder.get(b.session_id) ?? ordered.length) ||
        (a.created_at ?? '').localeCompare(b.created_at ?? '') ||
        a.id.localeCompare(b.id)
    )
    .map((note) => ({
      sessionId: note.session_id,
      author: note.author,
      body: note.body,
      createdAt: note.created_at,
    }));

  return {
    day: {
      trackName: input.track.name,
      date: input.date,
      driverName: input.driver.name,
      sessionCount: sessions.length,
      notes: input.notes,
    },
    sessions,
    focusItems,
    coachingNotes,
  };
}

/**
 * Why this session cannot claim a σ, phrased from canClaimConsistency's own
 * rule. It rides in the prompt so the model reports "not claimable" instead of
 * treating the gap as an invitation.
 */
function consistencyReason(countableLapCount: number): string {
  if (countableLapCount < MIN_LAPS_FOR_INSIGHTS) {
    return `Consistency needs at least ${MIN_LAPS_FOR_INSIGHTS} countable laps; this session has ${countableLapCount}.`;
  }
  // The gate passed but σ did not resolve — too few laps survived the clean-lap
  // filter. Rare, and still a reason rather than a silent null.
  return 'Too few clean laps to compute a consistency figure.';
}

/**
 * The origin label, or null when there is nothing honest to say — the same
 * facts the focus panel reads, from the origin session's DAY.
 *
 * The day's PLAIN calendar date, not a formatted one: this string is stored in
 * a jsonb snapshot and compared for deep equality, and toLocaleDateString
 * renders in the runtime's locale and timezone. A null origin ("added outside a
 * session") and an unresolvable one both yield null; neither may be guessed at.
 */
function originLabel(
  item: DaySummaryFocusItemInput,
  originById: Map<string, DaySummaryInput['originSessions'][number]>
): string | null {
  if (item.created_after_session_id === null) return null;
  const origin = originById.get(item.created_after_session_id);
  if (!origin?.track_day) return null;
  return `from ${origin.track_day.track.name}, ${origin.track_day.date}`;
}

/**
 * The ids recorded as having informed a generation — derived from the CONTEXT
 * OBJECT, never from a parallel query. A session imported between the fetch and
 * the insert must not desynchronize the recorded ids from the snapshot they
 * claim to describe.
 */
export function informingIdsFrom(ctx: DaySummaryContext): {
  sessionIds: string[];
  assessmentIds: string[];
} {
  return {
    sessionIds: ctx.sessions.map((session) => session.id),
    assessmentIds: ctx.focusItems.flatMap((item) => item.assessments.map((a) => a.id)),
  };
}

/**
 * Which of a day's summary rows is the current one, and whether a revision is
 * in progress. The ONE answer to "what does this day's summary slot show" —
 * it looks like presentation and is actually semantics, so it lives here and
 * not in the component.
 *
 * The approved row wins whenever one exists: an old approved summary is
 * superseded only when a NEWER one is approved, so regenerating and then
 * abandoning the draft must never leave the day without a current summary. A
 * draft sitting beside an approved row is a valid, expected state — the coach
 * considering a rewrite — and surfaces as `pendingDraft`.
 *
 * Superseded rows are invisible here by construction: they are neither.
 */
export function daySummaryView<R extends { status: string }>(
  rows: R[]
): { current: R | null; pendingDraft: R | null } {
  const approved = rows.find((row) => row.status === 'approved') ?? null;
  const draft = rows.find((row) => row.status === 'draft') ?? null;
  return {
    current: approved ?? draft,
    pendingDraft: approved && draft ? draft : null,
  };
}

/**
 * Whether an approved summary has been edited since it was approved — the
 * marker behind the day page's "Edited after approval" chip.
 *
 * Post-approval edits are the coach's to make, and the marker is only honest if
 * shown: without it, a reader assumes the approved text is what was approved at
 * `approved_at`. Both instants are DB-stamped from the same `now()` at approval,
 * so a freshly approved row reads false.
 */
export function editedAfterApproval(row: {
  status: string;
  approved_at: string | null;
  updated_at: string;
}): boolean {
  if (row.status !== 'approved' || row.approved_at === null) return false;
  return new Date(row.updated_at).getTime() > new Date(row.approved_at).getTime();
}
