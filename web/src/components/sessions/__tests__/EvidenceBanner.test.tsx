/**
 * @jest-environment jsdom
 *
 * The evidence banner reports facts plus present tense, never reconstruction:
 *
 *  - "Reviewed in this session" — assessments AT this session (hard facts),
 *    judgment shown, current status shown when the item has since resolved.
 *  - "Focus items" — plainly present-tense: active items in play coming in,
 *    minus the already-reviewed.
 *
 * Both labels are settled by the design doc; a test pins the exact strings.
 * The INTENDED GAP is pinned too: an item historically active at this session
 * but since resolved, with no assessment here, appears in neither group — the
 * banner does not reconstruct historical status.
 *
 * Grouping comes from focusItemsForSession (the lib). This suite exercises the
 * banner's presentation of the union, not the eligibility rules themselves —
 * those are pinned in lib/__tests__/track-days.test.ts.
 */
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import EvidenceBanner from '../EvidenceBanner';
import type { FocusItemWithAssessments } from '@/lib/types';

const SESSION = { id: 's2', date: '2026-07-12T20:00:00Z' };
const DAY_DATE = '2026-07-12';
const TIMEZONE = 'America/Chicago';
const ORIGINS = [
  { id: 's1', date: '2026-07-12T15:00:00Z' },
  { id: 's2', date: '2026-07-12T20:00:00Z' },
];

function makeItem(
  id: string,
  text: string,
  overrides: Partial<FocusItemWithAssessments> = {}
): FocusItemWithAssessments {
  return {
    id,
    driver_id: 'driver-1',
    text,
    status: 'active',
    // Well before the day, so the null-origin date rule keeps it in play.
    created_at: '2026-07-01T12:00:00Z',
    created_after_session_id: null,
    updated_at: '2026-07-01T12:00:00Z',
    focus_item_assessments: [],
    ...overrides,
  };
}

function assessmentAt(id: string, focusItemId: string, sessionId: string, judgment: string) {
  return {
    id,
    focus_item_id: focusItemId,
    session_id: sessionId,
    judgment,
    note: null,
    created_at: '2026-07-12T21:00:00Z',
    updated_at: '2026-07-12T21:00:00Z',
  };
}

function renderBanner(focusItems: FocusItemWithAssessments[]) {
  return render(
    <EvidenceBanner
      focusItems={focusItems}
      session={SESSION}
      originSessions={ORIGINS}
      dayDate={DAY_DATE}
      trackTimezone={TIMEZONE}
    />
  );
}

describe('EvidenceBanner', () => {
  it('renders nothing at all when both groups are empty', () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses exactly the settled labels: "Reviewed in this session" and "Focus items"', () => {
    renderBanner([
      makeItem('fi-1', 'Brake later into T5', {
        focus_item_assessments: [assessmentAt('a-1', 'fi-1', 's2', 'improved')],
      }),
      makeItem('fi-2', 'Look through the corner'),
    ]);

    expect(screen.getByText('Reviewed in this session')).toBeInTheDocument();
    expect(screen.getByText('Focus items')).toBeInTheDocument();
  });

  it('shows the judgment given at THIS session on a reviewed item', () => {
    renderBanner([
      makeItem('fi-1', 'Brake later into T5', {
        focus_item_assessments: [
          // An assessment at another session must not leak in as this one's.
          assessmentAt('a-0', 'fi-1', 's1', 'regressed'),
          assessmentAt('a-1', 'fi-1', 's2', 'improved'),
        ],
      }),
    ]);

    const reviewed = screen.getByTestId('evidence-reviewed');
    expect(within(reviewed).getByText('Brake later into T5')).toBeInTheDocument();
    expect(within(reviewed).getByText(/Improved/)).toBeInTheDocument();
    expect(within(reviewed).queryByText(/Regressed/)).not.toBeInTheDocument();
  });

  it('shows the CURRENT status on a since-resolved reviewed item — the review still shows honestly', () => {
    renderBanner([
      makeItem('fi-1', 'Smooth throttle out of T3', {
        status: 'achieved',
        focus_item_assessments: [assessmentAt('a-1', 'fi-1', 's2', 'improved')],
      }),
    ]);

    const reviewed = screen.getByTestId('evidence-reviewed');
    expect(within(reviewed).getByText(/Improved/)).toBeInTheDocument();
    expect(within(reviewed).getByText(/Achieved/)).toBeInTheDocument();
  });

  it('adds no status caption to a still-active reviewed item', () => {
    renderBanner([
      makeItem('fi-1', 'Brake later into T5', {
        focus_item_assessments: [assessmentAt('a-1', 'fi-1', 's2', 'improved')],
      }),
    ]);

    expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
  });

  it('lists an item reviewed here AND still in play once, under Reviewed only', () => {
    renderBanner([
      makeItem('fi-1', 'Brake later into T5', {
        focus_item_assessments: [assessmentAt('a-1', 'fi-1', 's2', 'improved')],
      }),
    ]);

    expect(screen.getAllByText('Brake later into T5')).toHaveLength(1);
    expect(screen.queryByText('Focus items')).not.toBeInTheDocument();
  });

  it('INTENDED GAP: an item historically active here but since resolved, unassessed here, appears in NEITHER group', () => {
    // It was genuinely active during s2, then the coach achieved it days later
    // without ever assessing it at s2. "Reviewed" has no assessment fact to
    // report, and "Focus items" is present tense — the item is not active NOW.
    // The banner reports evidence; it does not reconstruct history. With only
    // this item, both groups are empty and the banner renders nothing.
    const { container } = renderBanner([
      makeItem('fi-1', 'Trail brake into T9', { status: 'achieved' }),
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps an item originated AFTER this session out of the present-tense group', () => {
    renderBanner([
      // Coaching output OF s2 — in play from the NEXT session on, so it is not
      // evidence about this one.
      makeItem('fi-1', 'Wider entry into T1', { created_after_session_id: 's2' }),
      makeItem('fi-2', 'Look through the corner'),
    ]);

    const focusNow = screen.getByTestId('evidence-in-play');
    expect(within(focusNow).getByText('Look through the corner')).toBeInTheDocument();
    expect(screen.queryByText('Wider entry into T1')).not.toBeInTheDocument();
  });
});
