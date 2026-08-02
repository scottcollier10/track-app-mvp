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

/** Empty markers. Every source states its own emptiness rather than vanishing. */
const NO_SESSIONS = 'No sessions are recorded for this day.';
const NO_FOCUS_ITEMS = 'No focus items were in play on this day.';
const NO_COACH_NOTES = 'No coaching records exist for this day.';
const NO_DAY_NOTES = 'No day notes were recorded.';
const NO_ELIGIBLE_ITEMS = 'No focus items are in play for this session.';
const NO_COUNTABLE_LAPS = 'No countable laps are recorded for this session.';

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
 * One session's block. `marker` places the focal session in the session
 * prompt's day arc; the day summary passes none.
 */
function renderSession(
  session: DaySummaryContext['sessions'][number],
  marker: string
): string {
  const head = [
    `${session.label}${marker} — `,
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

function renderSessions(ctx: DaySummaryContext, markerFor: (index: number) => string): string {
  if (ctx.sessions.length === 0) return NO_SESSIONS;
  return ctx.sessions.map((session, i) => renderSession(session, markerFor(i))).join('\n');
}

function renderFocusItems(
  items: DaySummaryContext['focusItems'],
  emptyMarker: string
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
              (a) =>
                `  - ${a.sessionLabel}: ${a.judgment}${a.note !== null ? ` — "${a.note}"` : ''}`
            );
      return [head, ...history].join('\n');
    })
    .join('\n');
}

function renderCoachingNotes(ctx: DaySummaryContext): string {
  if (ctx.coachingNotes.length === 0) return NO_COACH_NOTES;
  const labels = new Map(ctx.sessions.map((session) => [session.id, session.label]));
  return ctx.coachingNotes
    .map(
      (note) =>
        `- ${labels.get(note.sessionId) ?? 'Unknown session'} (${note.author}): ${note.body}`
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
  return `You are writing a coach-facing summary of one HPDE track day. Everything you
are given below is either recorded session data or something the coach wrote.

${HARD_CONSTRAINT}

${renderDay(ctx)}

SESSIONS
${renderSessions(ctx, () => '')}

FOCUS ITEMS IN PLAY
${renderFocusItems(ctx.focusItems, NO_FOCUS_ITEMS)}

COACH SESSION NOTES
${renderCoachingNotes(ctx)}

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
  /** The focal session's lap ROWS — filtered and formatted here, once. */
  focalLaps: Array<{ lap_number: number; lap_time_ms: number | null }>;
  driverProfile: { experienceLevel: string; totalSessions: number };
}): string {
  const { ctx, focalSessionId, eligibleItemIds, focalLaps, driverProfile } = args;

  const focalIndex = ctx.sessions.findIndex((session) => session.id === focalSessionId);
  const focal = focalIndex === -1 ? null : ctx.sessions[focalIndex];

  // Later sessions are marked as such so the model can hold them as
  // "subsequently" context and not grade the focal session with hindsight.
  const markerFor = (index: number) =>
    index === focalIndex
      ? ' (THIS SESSION)'
      : focalIndex !== -1 && index > focalIndex
        ? ' (after this session)'
        : '';

  // Countable laps only, via the app's one lap predicate: a raw row renders
  // "Lap 3: 0:00.000" and invites the model to cite a phantom lap in
  // coach-visible text. Lap numbers stay AS RECORDED — a coach's "lap 5" must
  // still be lap 5 when an earlier lap was uncountable.
  const countable = focalLaps.filter(isCountableLap);
  const lapTable =
    countable.length === 0
      ? NO_COUNTABLE_LAPS
      : countable
          .map(
            (lap) =>
              `Lap ${lap.lap_number}: ${formatLapMs(lap.lap_time_ms as number)}${
                focal?.bestLapMs === lap.lap_time_ms ? ' (best)' : ''
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
Experience level: ${driverProfile.experienceLevel}
Sessions completed: ${driverProfile.totalSessions}

${renderDay(ctx)}

SESSIONS
${renderSessions(ctx, markerFor)}

FOCAL SESSION LAPS (countable laps only, lap numbers as recorded)
${lapTable}

FOCUS ITEMS IN EVIDENCE FOR THIS SESSION
${renderFocusItems(eligibleItems, NO_ELIGIBLE_ITEMS)}

COACH SESSION NOTES
${renderCoachingNotes(ctx)}

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
