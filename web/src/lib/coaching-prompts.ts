/**
 * The two AI prompts — day summary and session coaching.
 *
 * See docs/plans/2026-08-01-ai-day-summary-design.md, decisions 5 and 7.
 *
 * Both render a DaySummaryContext and both carry the same HARD CONSTRAINT
 * block: the AI may summarize coach-directed work and may NEVER author a
 * driving instruction. That rule is enforced twice over — here in language, and
 * structurally by the context object, which contains no AI-authored text for
 * the model to launder into a new "summary".
 *
 * Everything below is rendering. No metric is computed here: the context object
 * arrives with its numbers already derived from the one definition of each.
 */
import { SIGMA_DISPLAY_DECIMALS, isCountableLap } from '@/lib/track-days';
import { formatLapMs } from '@/lib/time';
import type { DaySummaryContext } from '@/lib/day-summaries';

/** One definition, both routes. */
export const AI_MODEL = 'claude-sonnet-4-6';

/**
 * The rule, in the model's own instructions.
 *
 * Line breaks here are load-bearing: the contract strings the tests pin
 * ("NEVER author new driving instructions", the canonical smuggled
 * prescription, the empty-source phrasing) must each stay on ONE line, or a
 * rewrap silently removes the instruction while the block still looks right.
 */
const HARD_CONSTRAINT = `HARD CONSTRAINT
You may summarize coach-directed work: focus items, the coach's own assessments,
coach notes, and session data. You may NEVER author new driving instructions,
readiness or run-group decisions, setup changes, or safety recommendations.
Observations are claims about what happened, verifiable against the data
("laps 8-11 degraded to ±2.1s"). Prescriptions are claims about what the driver
should do ("carry more speed through 5") — never write them. Beware disguised
prescriptions: "the data suggests earlier braking would help" is a prescription
and is forbidden.

If a source is empty, state it plainly. For example:
"No coaching records exist for this day." Never pad or invent.`;

/**
 * Empty markers. Every source states its own emptiness rather than vanishing,
 * and every marker is a string that appears NOWHERE ELSE in the prompt.
 *
 * NO_COACH_NOTES used to be the identical sentence the HARD CONSTRAINT block
 * quotes as its example of empty-means-empty. The empty day is one of the two
 * canonical model failure modes (design decision 5), and an assertion for it
 * that the constraint block satisfies on its own is coverage that reads as
 * coverage while passing with the whole section deleted. The constraint block
 * keeps the pinned phrasing; the marker says the same thing in its own words,
 * so asserting it means what it looks like it means.
 */
const NO_SESSIONS = 'No sessions are recorded for this day.';
const NO_FOCUS_ITEMS = 'No focus items were in play on this day.';
const NO_COACH_NOTES = 'No coach session notes were recorded for this day.';
const NO_DAY_NOTES = 'No day notes were recorded.';
const NO_ELIGIBLE_ITEMS = 'No focus items are in play for this session.';
const NO_COUNTABLE_LAPS = 'No countable laps are recorded for this session.';

/**
 * A driver-profile field the app does not have — no profile row, or the query
 * for it failed.
 *
 * The one marker that is NOT unique on its own, because it renders as the value
 * half of a labelled line: "Experience level: not recorded" and "Sessions
 * completed: not recorded" are each unique, and an assertion names the whole
 * line for exactly that reason.
 *
 * It exists because the alternative was a default. The prompt header promises
 * everything below it is recorded session data or something the coach wrote, so
 * telling the model an unknown driver is "intermediate" with 0 sessions
 * completed is a fabricated fact — and it is the kind that reads as a real one:
 * a driver with 40 sessions rendered as "Sessions completed: 0" invites the
 * model to frame the whole day as a beginner's.
 */
const NOT_RECORDED = 'not recorded';

/**
 * What a coaching note's session is called when the context resolved no name
 * for it. Reachable only if a note was fetched for a session outside the day it
 * is being rendered with — a fetch bug, not a data state — so it names the gap
 * instead of borrowing a "Session N" that belongs to a different session.
 */
const SESSION_OUTSIDE_THIS_DAY = 'a session outside this day';

/** Signed lap delta in seconds. Zero is unsigned: an identical lap is not "slower". */
function signedLapDelta(ms: number): string {
  return `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(3)}s`;
}

/** Signed σ delta, at the resolution σ is displayed at and never finer. */
function signedSigmaDelta(seconds: number): string {
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(SIGMA_DISPLAY_DECIMALS)}s`;
}

function sigma(seconds: number): string {
  return `±${seconds.toFixed(SIGMA_DISPLAY_DECIMALS)}s`;
}

/**
 * How a prompt names a session — and the ONE place a session's position
 * relative to the focal session is decided.
 *
 * Decision 7 forbids grading the focal session with hindsight it did not have,
 * and the marker is the whole mechanism: it is what makes a later session
 * legible as "subsequently" context rather than as something the focal session
 * already knew. THREE renderers print a session's name — the session blocks,
 * the assessment history under FOCUS ITEMS, the coach notes — and the
 * assessment history is the one that matters most, because a later session's
 * judgment ("Session 3: improved") sitting unmarked under "what THIS session's
 * data shows against the item's assessment history" is hindsight presented as
 * evidence. Marking one renderer and not the others is how that happens, so
 * none of them owns the decision.
 *
 * `nameOutsideThisDay` is what to call an id that is not one of this day's
 * sessions: for an assessment, the name the core already resolved (a cross-day
 * session, which carries no marker because it has no place in this day's arc).
 * This day's numbering is never borrowed for it.
 */
type SessionLabeler = (sessionId: string, nameOutsideThisDay: string) => string;

/** The marker wording itself, in one place. Empty when nothing is in focus. */
function marker(index: number, focalIndex: number | null): string {
  if (focalIndex === null) return '';
  if (index === focalIndex) return ' (THIS SESSION)';
  return index > focalIndex ? ' (after this session)' : '';
}

/** `focalIndex` null in the day summary, where no session is in focus. */
function sessionLabelerFor(ctx: DaySummaryContext, focalIndex: number | null): SessionLabeler {
  const indexById = new Map(ctx.sessions.map((session, i) => [session.id, i]));
  return (sessionId, nameOutsideThisDay) => {
    const index = indexById.get(sessionId);
    if (index === undefined) return nameOutsideThisDay;
    return `${ctx.sessions[index].label}${marker(index, focalIndex)}`;
  };
}

/**
 * One session's block. `name` is the labeler's — it carries the focal marker in
 * the session prompt and is bare "Session N" in the day summary.
 */
function renderSession(
  session: DaySummaryContext['sessions'][number],
  name: string
): string {
  const head = [
    `${name} — `,
    session.bestLapMs !== null
      ? `best lap ${formatLapMs(session.bestLapMs)}`
      : 'best lap not recorded',
    `, ${session.countableLapCount} countable laps`,
    session.consistencySeconds !== null ? `, consistency ${sigma(session.consistencySeconds)}` : '',
  ].join('');

  const lines = [head];

  // The reason rides along so the model reports "not claimable" instead of
  // treating a missing number as an invitation to invent one.
  if (session.consistencyUnavailableReason !== null) {
    lines.push(`  Consistency: not claimable. ${session.consistencyUnavailableReason}`);
  }

  if (session.delta === null) {
    lines.push('  No earlier comparable session to measure against.');
  } else {
    const parts = [
      session.delta.bestLapDeltaMs !== null
        ? `best lap ${signedLapDelta(session.delta.bestLapDeltaMs)}`
        : 'best lap not comparable',
      session.delta.sigmaDeltaSeconds !== null
        ? `consistency ${signedSigmaDelta(session.delta.sigmaDeltaSeconds)}`
        : 'consistency not comparable',
    ];
    lines.push(`  vs ${session.delta.vsLabel}: ${parts.join(', ')}`);
  }

  if (session.representativeness !== null) {
    lines.push(
      `  Context: ${session.representativeness}${
        session.representativenessNote !== null ? ` — ${session.representativenessNote}` : ''
      }`
    );
  }

  return lines.join('\n');
}

function renderSessions(ctx: DaySummaryContext, labelFor: SessionLabeler): string {
  if (ctx.sessions.length === 0) return NO_SESSIONS;
  return ctx.sessions
    .map((session) => renderSession(session, labelFor(session.id, session.label)))
    .join('\n');
}

function renderFocusItems(
  items: DaySummaryContext['focusItems'],
  emptyMarker: string,
  labelFor: SessionLabeler
): string {
  if (items.length === 0) return emptyMarker;
  return items
    .map((item) => {
      const head = `- "${item.text}" (${item.status})${item.origin !== null ? ` — ${item.origin}` : ''}`;
      // Full cross-day history, uncapped: a 15-assessment item is narrative,
      // not a size problem.
      const history =
        item.assessments.length === 0
          ? ['  No assessments recorded for this item.']
          : item.assessments.map(
              // A sub-bullet, not an indented line: a bare indent continues the
              // item's own bullet and the history reads as one run-on claim.
              //
              // Through the labeler, so a judgment given at a LATER session
              // arrives marked. This section asks what the focal session's data
              // shows against the item's history; an unmarked "Session 3:
              // improved" here is a verdict from the future reading as evidence
              // the focal session already had.
              (a) =>
                `  - ${labelFor(a.sessionId, a.sessionLabel)}: ${a.judgment}${
                  a.note !== null ? ` — "${a.note}"` : ''
                }`
            );
      return [head, ...history].join('\n');
    })
    .join('\n');
}

function renderCoachingNotes(ctx: DaySummaryContext, labelFor: SessionLabeler): string {
  if (ctx.coachingNotes.length === 0) return NO_COACH_NOTES;
  return ctx.coachingNotes
    .map(
      (note) =>
        `- ${labelFor(note.sessionId, SESSION_OUTSIDE_THIS_DAY)} (${note.author}): ${note.body}`
    )
    .join('\n');
}

function renderDay(ctx: DaySummaryContext): string {
  return [
    'DAY',
    `Driver: ${ctx.day.driverName}`,
    `Track: ${ctx.day.trackName}`,
    `Date: ${ctx.day.date}`,
    `Sessions: ${ctx.day.sessionCount}`,
  ].join('\n');
}

function renderDayNotes(ctx: DaySummaryContext): string {
  return ctx.day.notes ?? NO_DAY_NOTES;
}

/**
 * The coach-approved day summary prompt. Renders the context object and asks
 * for the five settled sections.
 */
export function buildDaySummaryPrompt(ctx: DaySummaryContext): string {
  // No session is in focus, so no session is "later than" anything: the day
  // summary describes the whole day at once.
  const labelFor = sessionLabelerFor(ctx, null);

  return `You are writing a coach-facing summary of one HPDE track day. Everything you
are given below is either recorded session data or something the coach wrote.

${HARD_CONSTRAINT}

${renderDay(ctx)}

SESSIONS
${renderSessions(ctx, labelFor)}

FOCUS ITEMS IN PLAY
${renderFocusItems(ctx.focusItems, NO_FOCUS_ITEMS, labelFor)}

COACH SESSION NOTES
${renderCoachingNotes(ctx, labelFor)}

DAY NOTES
${renderDayNotes(ctx)}

Write exactly five sections:

## Day overview
How the day progressed, grounded in the metrics above.

## Coaching progression
The narrative the focus items and the coach's own assessments tell.

## Important context
Anything that limits interpretation: context flags, coach notes.

## Strengths demonstrated
Only what the data or the coach's own observations support.

## Carry-forward
ONLY restate active focus items and explicit coach notes. If none exist, say so.
`;
}

/**
 * The session-coaching prompt: the same day context, one session in focus.
 *
 * `eligibleItemIds` is computed by the route with focusItemsForSession (the
 * same function the session page's evidence banner uses), so the rule that an
 * item never evidences against its own origin session arrives by reuse. This
 * builder renders that decision and does not second-guess it.
 */
export function buildSessionCoachingPrompt(args: {
  ctx: DaySummaryContext;
  focalSessionId: string;
  eligibleItemIds: Set<string>;
  /**
   * The focal session's lap ROWS — filtered and formatted here, once.
   *
   * The ONLY raw data that reaches this file. Everything else arrives already
   * derived on the context object, so this parameter is where the next "just
   * add a fade figure to the prompt" change will try to land and where a
   * recomputation would creep back in — a metric derived here is a second
   * definition of a number the day page already prints.
   *
   * It is also the one thing the prompt renders that never enters
   * `prompt_context`: session coaching has no provenance row (design decision
   * 7), so the lap table is unrecorded. Acceptable only while that stays true —
   * the PR that gives session coaching a provenance row inherits the question
   * of how this gets snapshotted with it.
   */
  focalLaps: Array<{ lap_number: number; lap_time_ms: number | null }>;
  /**
   * The driver's profile row, or null when there is none / the read failed.
   * Nullable field by field as well, because the columns are: the route passes
   * what it has and NEVER a default. See NOT_RECORDED.
   */
  driverProfile: { experienceLevel: string | null; totalSessions: number | null } | null;
}): string {
  const { ctx, focalSessionId, eligibleItemIds, focalLaps, driverProfile } = args;

  const focalIndex = ctx.sessions.findIndex((session) => session.id === focalSessionId);
  // Fail loud. With no focal session nothing is marked "(THIS SESSION)", no lap
  // is marked "(best)", and the header still promises a prompt about ONE
  // session — so the model picks one, and the route returns it as a 200. A
  // focal session missing from its own day's context is corrupt input, not a
  // supported state (the same posture localDateForTimezone takes on an
  // unparseable timestamp).
  if (focalIndex === -1) {
    throw new Error(
      `buildSessionCoachingPrompt: focal session ${focalSessionId} is not in the day context`
    );
  }
  const focal = ctx.sessions[focalIndex];
  const labelFor = sessionLabelerFor(ctx, focalIndex);

  // Countable laps only, via the app's one lap predicate: a raw row renders
  // "Lap 3: 0:00.000" and invites the model to cite a phantom lap in
  // coach-visible text. Lap numbers stay AS RECORDED — a coach's "lap 5" must
  // still be lap 5 when an earlier lap was uncountable.
  const countable = focalLaps.filter(isCountableLap);
  // The FIRST lap matching the session's best, not every one: two laps run to
  // the same millisecond would otherwise both be "(best)", which reads as two
  // best laps. The stored best_lap_ms is the one asked — csv-parser computes it
  // as Math.min over UNFILTERED times, so when the stored best is not among the
  // countable rows nothing here is marked. That is deliberate: recomputing the
  // minimum over `countable` would make this file a second definition of "best
  // lap" and let the lap table disagree with the session header above it.
  const bestLapIndex = countable.findIndex((lap) => lap.lap_time_ms === focal.bestLapMs);
  const lapTable =
    countable.length === 0
      ? NO_COUNTABLE_LAPS
      : countable
          .map(
            (lap, i) =>
              `Lap ${lap.lap_number}: ${formatLapMs(lap.lap_time_ms)}${
                i === bestLapIndex ? ' (best)' : ''
              }`
          )
          .join('\n');

  const eligibleItems = ctx.focusItems.filter((item) => eligibleItemIds.has(item.id));

  return `You are writing coach-facing observations about ONE session of an HPDE track day.
Everything you are given below is either recorded session data or something the
coach wrote.

${HARD_CONSTRAINT}

Frame this session against the sessions that came before it. Later sessions in
the day, if present, are "subsequently" context only:
never judge this session with hindsight it did not have.

DRIVER
Name: ${ctx.day.driverName}
Experience level: ${driverProfile?.experienceLevel ?? NOT_RECORDED}
Sessions completed: ${driverProfile?.totalSessions ?? NOT_RECORDED}

${renderDay(ctx)}

SESSIONS
${renderSessions(ctx, labelFor)}

FOCAL SESSION LAPS (countable laps only, lap numbers as recorded)
${lapTable}

FOCUS ITEMS IN EVIDENCE FOR THIS SESSION
${renderFocusItems(eligibleItems, NO_ELIGIBLE_ITEMS, labelFor)}

COACH SESSION NOTES
${renderCoachingNotes(ctx, labelFor)}

DAY NOTES
${renderDayNotes(ctx)}

Write exactly three sections:

## Session in the day's arc
Deltas against the named baseline. Respect the context flags: a
traffic-compromised run is framed, not scolded.

## Evidence on focus items
Per item, what this session's data shows against its assessment history. If no
items are in play, say so.

## Patterns worth the coach's attention
Verifiable data claims only.
`;
}
