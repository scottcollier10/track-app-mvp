/**
 * @jest-environment jsdom
 *
 * The strip is presentational, but it owns the two honesty-critical wirings on
 * the day page: the >=MIN_LAPS_FOR_INSIGHTS gate on any σ claim, and the
 * session-to-session delta. Both are silent when wrong — a σ printed for a
 * 3-lap session still looks like a number — so they get tests.
 *
 * Lap fixtures are chosen so σ is hand-checkable and no lap is dropped by
 * cleanLaps (nothing is anywhere near 1.25x the median):
 *   [91000, 92000] x3 -> mean 91500, sample sd = sqrt(6*500^2/5) = 547.7ms = 0.5s
 *   [90500] x6        -> sd 0.0s
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionProgressionStrip from '../SessionProgressionStrip';
import type { SessionWithLapTimes } from '@/lib/types';

function makeSession(
  id: string,
  bestLapMs: number | null,
  lapTimesMs: number[]
): SessionWithLapTimes {
  return {
    id,
    best_lap_ms: bestLapMs,
    date: '2026-07-28T14:00:00Z',
    driver_id: 'driver-1',
    track_id: 'track-1',
    track_day_id: 'day-1',
    total_time_ms: lapTimesMs.reduce((s, t) => s + t, 0),
    ai_coaching_summary: null,
    coach_notes: null,
    created_at: null,
    notes: null,
    representativeness: null,
    representativeness_note: null,
    source: 'csv',
    laps: lapTimesMs.map((lap_time_ms, i) => ({ lap_number: i + 1, lap_time_ms })),
  };
}

const WOBBLY = [91000, 92000, 91000, 92000, 91000, 92000]; // sd 0.5s
const FLAT = [90500, 90500, 90500, 90500, 90500, 90500]; // sd 0.0s
const SLOW_WOBBLY = [92000, 93000, 92000, 93000, 92000, 93000]; // sd 0.5s

/** A realistic HPDE day: 4 sessions, the first a short 3-lap out-and-in. */
const day: SessionWithLapTimes[] = [
  makeSession('session-1', 92500, [93000, 92500, 93200]),
  makeSession('session-2', 91000, WOBBLY),
  makeSession('session-3', 90500, FLAT),
  makeSession('session-4', 92000, SLOW_WOBBLY),
];

function cards() {
  return screen.getAllByRole('link');
}

/**
 * Delta chips are queried by test id, never by substring. "does card 1 contain
 * '('?" is not the same question as "does card 1 render a delta": it passes for
 * the wrong reason today and would miss a regressed negative delta, which
 * renders as "1:32.500-1.500s" with no parenthesis at all.
 */
function bestLapDelta(card: HTMLElement) {
  return card.querySelector('[data-testid="best-lap-delta"]');
}
function sigmaDelta(card: HTMLElement) {
  return card.querySelector('[data-testid="sigma-delta"]');
}

describe('SessionProgressionStrip', () => {
  it('numbers sessions in the order given and links each to its session page', () => {
    render(<SessionProgressionStrip sessions={day} />);

    expect(cards()).toHaveLength(4);
    cards().forEach((card, i) => {
      expect(card).toHaveTextContent(`Session ${i + 1}`);
      expect(card).toHaveAttribute('href', `/sessions/session-${i + 1}`);
    });
  });

  it('makes NO consistency claim for a session under the lap gate', () => {
    render(<SessionProgressionStrip sessions={day} />);

    // 3 laps: not a small σ, no σ at all.
    expect(cards()[0].textContent).not.toContain('±');
    expect(cards()[0]).toHaveTextContent('Too few laps for a consistency figure');
    expect(cards()[0]).toHaveTextContent('3 laps');
  });

  it('shows σ from sessionConsistencySeconds once the lap gate is cleared', () => {
    render(<SessionProgressionStrip sessions={day} />);

    expect(cards()[1]).toHaveTextContent('±0.5s');
    expect(cards()[2]).toHaveTextContent('±0.0s');
    expect(cards()[3]).toHaveTextContent('±0.5s');
  });

  it('shows no delta on the first session, and signed best-lap deltas after it', () => {
    render(<SessionProgressionStrip sessions={day} />);

    // Nothing to compare against: no chip at all, in either direction.
    expect(bestLapDelta(cards()[0])).toBeNull();

    expect(cards()[1]).toHaveTextContent('-1.500s'); // 91000 - 92500
    expect(cards()[2]).toHaveTextContent('-0.500s'); // 90500 - 91000
    expect(cards()[3]).toHaveTextContent('+1.500s'); // 92000 - 90500
  });

  it('colours a faster lap as success and a slower one as warn', () => {
    const { container } = render(<SessionProgressionStrip sessions={day} />);

    expect(container.querySelector('.text-status-success')).toHaveTextContent('-1.500s');
    expect(container.querySelector('.text-status-warn')).toHaveTextContent('+1.500s');
  });

  it('shows a σ delta only when BOTH sessions clear the lap gate', () => {
    render(<SessionProgressionStrip sessions={day} />);

    // Session 2 follows a 3-lap session, so there is no σ pair to compare.
    expect(sigmaDelta(cards()[1])).toBeNull();
    expect(sigmaDelta(cards()[2])).toHaveTextContent('(-0.5s)'); // 0.0 - 0.5
    expect(sigmaDelta(cards()[3])).toHaveTextContent('(+0.5s)'); // 0.5 - 0.0
  });

  it('derives the σ delta from the ROUNDED σ values it prints, not the raw ones', () => {
    // Four σ that all render "±0.6s" but differ in the third decimal:
    //   0.6491, 0.5510, 0.6397, 0.6200 (alternating-pair fixtures, sd = d/2 * sqrt(1.2))
    // Off the RAW values the deltas read -0.1s, +0.1s and -0.0s — three chips
    // contradicting the identical σ printed right beside them, one of them a
    // signed zero. Off the rounded values every delta is an honest 0.0s.
    const pair = (d: number) => [91000, 91000 + d, 91000, 91000 + d, 91000, 91000 + d];
    render(
      <SessionProgressionStrip
        sessions={[
          makeSession('session-1', 91000, pair(1185)), // σ 0.6491
          makeSession('session-2', 91000, pair(1006)), // σ 0.5510, raw Δ -0.1
          makeSession('session-3', 91000, pair(1168)), // σ 0.6397, raw Δ +0.1
          makeSession('session-4', 91000, pair(1132)), // σ 0.6200, raw Δ -0.0
        ]}
      />
    );

    cards().forEach((card) => expect(card).toHaveTextContent('±0.6s'));
    expect(sigmaDelta(cards()[0])).toBeNull();
    [1, 2, 3].forEach((i) => expect(sigmaDelta(cards()[i])).toHaveTextContent('(0.0s)'));

    // No sign of any kind on an unchanged σ — least of all a minus.
    [1, 2, 3].forEach((i) => {
      expect(sigmaDelta(cards()[i])!.textContent).not.toContain('-');
      expect(sigmaDelta(cards()[i])!.textContent).not.toContain('+');
    });
  });

  it('treats an identical best lap as neither faster nor slower', () => {
    const { container } = render(
      <SessionProgressionStrip
        sessions={[makeSession('session-1', 91000, WOBBLY), makeSession('session-2', 91000, FLAT)]}
      />
    );

    // A tie is not a loss: no + sign, and none of the warn colour.
    expect(bestLapDelta(cards()[1])).toHaveTextContent('0.000s');
    expect(bestLapDelta(cards()[1])!.textContent).not.toContain('+');
    expect(container.querySelector('.text-status-warn')).toBeNull();
  });

  it('renders a single-session day with no deltas', () => {
    render(<SessionProgressionStrip sessions={[makeSession('session-1', 91000, WOBBLY)]} />);

    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent('Session 1');
    expect(cards()[0]).toHaveTextContent('1:31.000');
    expect(cards()[0]).toHaveTextContent('±0.5s');
    expect(bestLapDelta(cards()[0])).toBeNull();
    expect(sigmaDelta(cards()[0])).toBeNull();
  });

  it('renders a placeholder rather than a fake best lap when there is none', () => {
    render(<SessionProgressionStrip sessions={[makeSession('session-1', null, [])]} />);

    expect(cards()[0]).toHaveTextContent('--');
    expect(cards()[0]).toHaveTextContent('0 laps');
    expect(cards()[0].textContent).not.toContain('±');
  });

  it('treats a 0 best lap as no best lap, like the day KPI beside it', () => {
    // dayBestLapMs requires > 0 and the session page uses a truthy check, so a
    // !== null guard here was the one place a 0 rendered as "0:00.000".
    render(<SessionProgressionStrip sessions={[makeSession('session-1', 0, WOBBLY)]} />);

    expect(cards()[0]).toHaveTextContent('--');
    expect(cards()[0].textContent).not.toContain('0:00.000');
  });

  /**
   * A 0 lap time reaches the database (csv-parser only rejects a lap time that
   * fails parseInt; nothing downstream checks positivity), and this card used to
   * be the site that computed σ INCLUDING it while the driver page dropped the
   * session from its trend and the session page claimed a satisfied 6-lap gate
   * over 5 laps. All three now count validLapTimesMs, so all three refuse.
   */
  it('makes no consistency claim for six laps when one of them is a 0', () => {
    const sixLapsOneZero = [91000, 0, 92000, 91000, 92000, 91000];
    render(
      <SessionProgressionStrip
        sessions={[
          makeSession('session-1', 91000, sixLapsOneZero),
          makeSession('session-2', 91000, FLAT),
        ]}
      />
    );

    // Five countable laps, so no σ — and therefore no σ pair for card 2 either.
    expect(cards()[0].textContent).not.toContain('±');
    expect(cards()[0]).toHaveTextContent('Too few laps for a consistency figure');
    expect(sigmaDelta(cards()[1])).toBeNull();

    // The lap count still reports the ROWS recorded, which is the same figure
    // the session page's "Laps" card shows one click away.
    expect(cards()[0]).toHaveTextContent('6 laps');
  });
});
