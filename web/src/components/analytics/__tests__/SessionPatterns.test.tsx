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

/**
 * The same six behind an out lap. 120000 is above 1.25x the 90060ms median, so
 * cleanLaps drops it and the σ the page reports is the tight six's — while a
 * spread computed over all seven is enormous.
 */
const OUT_LAP_THEN_TIGHT_6 = [120000, ...TIGHT_6];

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

  it('withholds the card when the σ it would print is not tight, however tight the raw laps look', () => {
    // A lever, not a scenario. The page derives σ from these same laps and would
    // pass ~0.04s here, never 5 — no real session produces this prop pair, and
    // the old gate could not have printed a σ this large either. Decoupling the
    // two inputs is the point: six laps a tenth apart clear any spread computed
    // from `laps`, so restoring the old gate puts the card back up and prints
    // ±5.0s under "Exceptional Consistency". That is what makes this assertion
    // kill the restore, and it is the only way to show the trigger reads the
    // reported σ rather than the raw laps.
    render(
      <SessionPatterns laps={lapRows(TIGHT_6)} bestLapTime={90000} consistencySeconds={5} />
    );

    expect(screen.queryByText('Exceptional Consistency')).not.toBeInTheDocument();
  });

  it('shows the card when the reported σ is tight, even though the raw laps are not', () => {
    // The other direction. One out lap wrecks a spread taken over every lap, so
    // the card stayed hidden for a session the Consistency card one tab away was
    // calling ±0.4s. cleanLaps is what the reported σ was measured over, so it is
    // what the trigger has to be measured over too.
    render(
      <SessionPatterns
        laps={lapRows(OUT_LAP_THEN_TIGHT_6)}
        bestLapTime={90000}
        consistencySeconds={0.4}
      />
    );

    expect(screen.getByText('Exceptional Consistency')).toBeInTheDocument();
    expect(screen.getByText(/±0\.4s/)).toBeInTheDocument();
    // And the chip names the set the number came from. This fixture is exactly
    // the case where "All laps" would be a lie: the out lap is in the card's
    // scope by that wording and in none of its arithmetic.
    expect(screen.getByText('Clean laps')).toBeInTheDocument();
  });

  it('measures the σ against the clean-lap mean, not the all-lap mean', () => {
    // The denominator is load-bearing on its own, and only a session near the
    // threshold can show it. Clean mean here is 90.0517s and the all-lap mean is
    // 94.33s, so a σ of 1.85s is 2.05% of the set σ was measured over and 1.96%
    // of the set it was not. The first is over the line, so no card.
    //
    // An out lap makes the average lap look slower, and dividing by it makes any
    // spread look proportionally smaller — the card would be handed out for
    // untidiness elsewhere in the session.
    render(
      <SessionPatterns
        laps={lapRows(OUT_LAP_THEN_TIGHT_6)}
        bestLapTime={90000}
        consistencySeconds={1.85}
      />
    );

    expect(screen.queryByText('Exceptional Consistency')).not.toBeInTheDocument();
  });

  it('has no card at all when there is no σ to report', () => {
    // A null σ means analytics-v2 found fewer than two clean laps. There is
    // nothing to be exceptional about and nothing to print, so the card is
    // absent rather than present with prose standing in for the number.
    render(
      <SessionPatterns laps={lapRows(TIGHT_6)} bestLapTime={90000} consistencySeconds={null} />
    );

    expect(screen.queryByText('Exceptional Consistency')).not.toBeInTheDocument();
  });
});
