/**
 * @jest-environment jsdom
 *
 * The Consistency pattern card is the one place in this component that prints a
 * number it did not compute: σ arrives as a prop, from the same analytics-v2
 * call that feeds the session page's Consistency card. Everything that keeps the
 * two cards agreeing therefore lives outside this file's arithmetic, and is
 * silent when it breaks — a σ rendered to a different precision, or a card that
 * appears on one criterion and reports another, both just look like numbers.
 *
 * Lap fixtures are chosen so nothing is near 1.25x the median unless it is meant
 * to be dropped:
 *   TIGHT_6 -> mean 90051.67ms, no lap anywhere near the cleanLaps limit.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionPatterns from '../SessionPatterns';

/** Six laps inside a tenth of a second of each other. */
const TIGHT_6 = [90000, 90100, 90050, 90080, 90020, 90060];

function lapRows(timesMs: number[]) {
  return timesMs.map((lap_time_ms, i) => ({
    id: `lap-${i + 1}`,
    lap_number: i + 1,
    lap_time_ms,
  }));
}

describe('SessionPatterns — the Consistency card', () => {
  it('prints σ to the app-wide sigma precision, not a precision of its own', async () => {
    // Behaviour-identical to the `.toFixed(1)` this replaced, because
    // SIGMA_DISPLAY_DECIMALS is 1. What the assertion pins is the COUPLING: the
    // falsification for it is to change SIGMA_DISPLAY_DECIMALS and watch this
    // fail, which a hard-coded 1 would not. The session page prints the same
    // number through the same constant one tab away, so a card reading ±0.46s
    // beside a card reading ±0.5s is the failure being prevented.
    render(
      <SessionPatterns laps={lapRows(TIGHT_6)} bestLapTime={90000} consistencySeconds={0.456} />
    );

    expect(await screen.findByText(/±0\.5s/)).toBeInTheDocument();
  });
});
