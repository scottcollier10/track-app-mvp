/**
 * @jest-environment jsdom
 *
 * The session-coaching card, after the observation-only rewrite.
 *
 * Two things here fail SILENTLY when wrong, which is why they are pinned:
 *
 *  1. The section heading's colour. Every heading renders — the card looks
 *     fine — but an unrecognised one used to take `text-muted` while its own
 *     body copy takes `text-primary/90`, so the heading printed DIMMER than the
 *     paragraph beneath it. All three headings the prompt now asks for were
 *     unrecognised, so the current contract's output was the greyed-out case.
 *
 *  2. The error branch. The card used to decide what a failure MEANS by
 *     substring-matching the route's prose, so a data-integrity 500 whose
 *     wording contained "not found" reached the coach as the benign, retryable
 *     "Session or laps not found". Renaming the route's string fixed that
 *     collision and not the coupling; the branch reads a CODE now, and these
 *     tests drive it with a 500 that still contains the old substring so a
 *     revert to prose-matching fails here.
 *
 * Legacy rows are covered too. `sessions.ai_coaching_summary` is one overwritten
 * column with no migration behind it, so text written under the old
 * prescriptive contract is still in the database and must still render as it
 * did.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AICoachingCard from '../AICoachingCard';
import { CoachViewProvider } from '@/context/coach-view';
import { COACHING_ERROR } from '@/lib/coaching-errors';

/** The three sections buildSessionCoachingPrompt asks for, as the model emits them. */
const OBSERVATION_TEXT = [
  "## Session in the day's arc",
  'Best lap 0.8s quicker than Session 1.',
  '',
  '## Evidence on focus items',
  '- "Brake earlier for 5": lap times steadied through the middle stint.',
  '',
  "## Patterns worth the coach's attention",
  'Laps 8-11 degraded to ±2.1s.',
].join('\n');

/** A row written under the contract the rewrite removed. Still in the column. */
const LEGACY_TEXT = [
  '## Strengths',
  'Consistent through the esses.',
  '',
  '## Areas for Improvement',
  'Trail braking into 5.',
  '',
  '## Goals for Next Session',
  'Carry more speed through 5.',
].join('\n');

function renderCard(initialCoaching: string | null = null) {
  return render(
    <CoachViewProvider>
      <AICoachingCard sessionId="s-1" initialCoaching={initialCoaching} />
    </CoachViewProvider>
  );
}

/** The <h3> whose text contains `title`. Its icon is the svg inside it. */
function heading(title: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name: new RegExp(title) });
}

function headingClasses(title: string): string {
  return heading(title).className;
}

/** lucide names its own svg (`lucide lucide-target`), so the icon is assertable. */
function headingIcon(title: string): string {
  return heading(title).querySelector('svg')?.getAttribute('class') ?? '';
}

function jsonResponse(body: unknown, status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AICoachingCard section headings', () => {
  it('never renders a heading dimmer than its own body copy', () => {
    // The body is text-primary/90. text-muted (the old fallback) is dimmer than
    // that; text-primary is not. Asserted for all three of the current
    // contract's headings, because all three fell through the old colour map.
    renderCard(OBSERVATION_TEXT);

    for (const title of [
      "Session in the day's arc",
      'Evidence on focus items',
      "Patterns worth the coach's attention",
    ]) {
      expect(headingClasses(title)).toContain('text-primary');
      expect(headingClasses(title)).not.toContain('text-muted');
    }
  });

  it('gives each observation section its own icon', () => {
    // The colour is deliberately the same for all three, so the icon is the
    // only thing telling a scanning coach which section is which. Without it
    // the entries in SECTION_STYLES would be indistinguishable from the
    // fallback and could be deleted with nothing noticing.
    renderCard(OBSERVATION_TEXT);

    expect(headingIcon("Session in the day's arc")).toContain('lucide-trending-up');
    expect(headingIcon('Evidence on focus items')).toContain('lucide-target');
    expect(headingIcon("Patterns worth the coach's attention")).toContain('lucide-search');
  });

  it('renders a heading nobody mapped at full brightness anyway', () => {
    // The fallback, exercised directly. Every heading the current contract
    // produces is in the map, so a `text-muted` default would sit there looking
    // harmless until the prompt gains a section or an old row turns up with a
    // heading nobody listed — which is exactly how this bug shipped.
    renderCard('## Something nobody mapped\nA sentence under it.');

    expect(headingClasses('Something nobody mapped')).toContain('text-primary');
    expect(headingClasses('Something nobody mapped')).not.toContain('text-muted');
    // And says so with an icon no mapped section uses, so a mapped entry that
    // only restated the fallback would be visibly redundant.
    expect(headingIcon('Something nobody mapped')).toContain('lucide-file-text');
  });

  it('does not tint an observation section good or bad', () => {
    // Status colours grade. "Evidence on focus items" reports what the data
    // shows; green or amber on it is the card authoring a verdict the model was
    // forbidden to write.
    renderCard(OBSERVATION_TEXT);

    expect(headingClasses('Evidence on focus items')).not.toContain('text-status');
    expect(headingClasses("Patterns worth the coach's attention")).not.toContain('text-status');
  });

  it('still colours the legacy prescriptive headings on rows already written', () => {
    renderCard(LEGACY_TEXT);

    expect(headingClasses('Strengths')).toContain('text-status-success');
    expect(headingClasses('Areas for Improvement')).toContain('text-status-warn');
    expect(headingClasses('Goals for Next Session')).toContain('text-status-info');
  });
});

describe('AICoachingCard empty state', () => {
  it('promises observations, not the goals the contract forbids', () => {
    renderCard(null);

    expect(screen.getByText(/coach-facing observations/)).toBeInTheDocument();
    expect(screen.queryByText(/actionable goals/)).not.toBeInTheDocument();
  });
});

describe('AICoachingCard error branching', () => {
  async function generateAndReadError(body: unknown, status: number): Promise<string> {
    global.fetch = jest.fn(async () => jsonResponse(body, status)) as unknown as typeof fetch;

    renderCard(null);
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI Coaching' }));

    await waitFor(() => expect(screen.getByText('Error')).toBeInTheDocument());
    // The <p> next to the "Error" label.
    return screen.getByText('Error').nextElementSibling?.textContent ?? '';
  }

  it('reports a coded not-found as a benign missing-data message', async () => {
    const message = await generateAndReadError(
      { success: false, error: 'No laps found for this session', code: COACHING_ERROR.notFound },
      404
    );

    expect(message).toBe('Session or laps not found');
  });

  it('reports a coded missing key as a configuration problem', async () => {
    const message = await generateAndReadError(
      {
        success: false,
        error: 'ANTHROPIC_API_KEY not configured. Please add your API key to .env.local',
        code: COACHING_ERROR.apiKeyMissing,
      },
      500
    );

    expect(message).toContain('requires API key configuration');
  });

  it('does not read a data-integrity 500 as a missing session, whatever it says', async () => {
    // The route's corruption 500 as it was ORIGINALLY worded — the wording that
    // caused the bug. It carries no code, so the card must pass its sentence
    // through rather than translating it into something a coach can retry past.
    const message = await generateAndReadError(
      { success: false, error: 'Track day not found for this session — data integrity issue' },
      500
    );

    expect(message).toBe('Track day not found for this session — data integrity issue');
    expect(message).not.toBe('Session or laps not found');
  });

  it('does not read an uncoded failure mentioning an API key as a missing key', async () => {
    const message = await generateAndReadError(
      { success: false, error: 'Anthropic API error: your API key does not have access' },
      500
    );

    expect(message).toBe('Anthropic API error: your API key does not have access');
    expect(message).not.toContain('requires API key configuration');
  });
});
