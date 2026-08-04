/**
 * The session page's evidence banner — facts plus present tense, never
 * reconstruction. Two visibly separate groups whose LABELS are settled by the
 * design doc (do not "improve" them):
 *
 *  - "Reviewed in this session" — items with an assessment AT this session, a
 *    hard fact. The judgment given here is shown, and a since-resolved item
 *    shows its CURRENT status beside the review: the review happened, and
 *    pretending the item is still active would be its own lie.
 *  - "Focus items" — plainly present tense: currently-active items that were
 *    in play coming into this session, minus the already-reviewed.
 *
 * Grouping comes from focusItemsForSession (@/lib/track-days) — the same one
 * definition the debrief sheet reads, so the sheet and this banner cannot
 * show a coach two different lists of what the driver was working on. This
 * component only assembles the lib's inputs from the embeds.
 *
 * INTENDED GAP, do not "fix": an item that was historically active at this
 * session but has since been paused/dropped/achieved, with no assessment
 * here, appears in NEITHER group. "Reviewed" has no fact to report and
 * "Focus items" is present tense. Reconstructing "was active then" needs the
 * transition log the design doc rejected.
 *
 * No hooks, no writes — deliberately a server-renderable pure component.
 */
import {
  FOCUS_STATUS_LABELS,
  JUDGMENT_LABELS,
  assessedAtSession,
  focusItemsForSession,
} from '@/lib/track-days';
import type { AssessmentJudgment, FocusItemStatus, FocusItemWithAssessments } from '@/lib/types';

export default function EvidenceBanner({
  focusItems,
  session,
  originSessions,
  dayDate,
  trackTimezone,
}: {
  /** The driver's focus items with their full assessment history. */
  focusItems: FocusItemWithAssessments[];
  /** THIS session — id for assessment matching, date for origin ordering. */
  session: { id: string; date: string };
  /** id+date of the items' origin sessions — possibly from other days. */
  originSessions: Array<{ id: string; date: string }>;
  /** track_days.date — a plain track-local calendar date. */
  dayDate: string;
  trackTimezone: string | null;
}) {
  const { reviewed, inPlay } = focusItemsForSession({
    items: focusItems,
    assessedItemIds: assessedAtSession(focusItems, session.id),
    session,
    originSessions: new Map(originSessions.map((origin) => [origin.id, origin])),
    dayDate,
    trackTimezone,
  });

  // The lib returns the full tagged union (an item can be in both groups);
  // the presentation split is the caller's: reviewed wins, the rest stays
  // present-tense.
  const reviewedIds = new Set(reviewed.map((item) => item.id));
  const stillInPlay = inPlay.filter((item) => !reviewedIds.has(item.id));

  // Nothing to report is nothing rendered — an empty banner frame would imply
  // the loop ran and found nothing, which is a claim, not a fact.
  if (reviewed.length === 0 && stillInPlay.length === 0) return null;

  const judgmentAt = (item: FocusItemWithAssessments) =>
    item.focus_item_assessments.find((a) => a.session_id === session.id) ?? null;

  return (
    <section
      aria-label="Focus item evidence"
      className="space-y-3 rounded-lg border border-subtle bg-surface p-4"
    >
      {reviewed.length > 0 && (
        <div className="space-y-1" data-testid="evidence-reviewed">
          <h2 className="text-sm font-semibold text-primary">Reviewed in this session</h2>
          <ul className="space-y-1">
            {reviewed.map((item) => {
              const assessment = judgmentAt(item);
              return (
                <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="text-primary">{item.text}</span>
                  {assessment && (
                    <span className="text-muted">
                      {JUDGMENT_LABELS[assessment.judgment as AssessmentJudgment] ??
                        assessment.judgment}
                    </span>
                  )}
                  {/* Current status only when the item has moved on — an
                      active item's review needs no caption. */}
                  {item.status !== 'active' && (
                    <span className="text-xs text-text-subtle">
                      {FOCUS_STATUS_LABELS[item.status as FocusItemStatus] ?? item.status}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {stillInPlay.length > 0 && (
        <div className="space-y-1" data-testid="evidence-in-play">
          <h2 className="text-sm font-semibold text-primary">Focus items</h2>
          <ul className="space-y-1">
            {stillInPlay.map((item) => (
              <li key={item.id} className="text-sm text-primary">
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
