/**
 * @jest-environment jsdom
 *
 * TrackDayList is the driver page's day list. Three things here are silent when
 * wrong, so all three get tests:
 *  - the GROUPING: N sessions of one day must collapse to one row, keyed on the
 *    track day the database made, not a second definition of "day".
 *  - the σ trend DIRECTION: /api/sessions returns newest-first, and a reversed
 *    trend still renders as two plausible numbers — it would tell a driver who
 *    tightened up all day that they got looser.
 *  - the DATE: track_days.date is a plain track-local calendar date. Rendering
 *    the session timestamp instead puts this row one day off from the day page
 *    it links to. Jest pins TZ=America/Chicago so that bug is visible.
 *
 * Lap fixtures are chosen so σ is hand-checkable and no lap is dropped by
 * cleanLaps (nothing near 1.25x the median):
 *   [91000, 92000] x3 -> sample sd = sqrt(6*500^2/5) = 547.7ms = 0.5s
 *   [90500] x6        -> sd 0.0s
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrackDayList from '../TrackDayList';
import type { SessionWithDetails } from '@/data/sessions';

const WOBBLY = [91000, 92000, 91000, 92000, 91000, 92000]; // sd 0.5s
const FLAT = [90500, 90500, 90500, 90500, 90500, 90500]; // sd 0.0s

function makeSession(
  overrides: Partial<SessionWithDetails> & Pick<SessionWithDetails, 'id' | 'date'>
): SessionWithDetails {
  const lapTimesMs = overrides.lapTimesMs ?? [];
  return {
    total_time_ms: lapTimesMs.reduce((sum, t) => sum + t, 0),
    best_lap_ms: lapTimesMs.length ? Math.min(...lapTimesMs) : null,
    source: 'csv',
    driver: { id: 'driver-1', name: 'Sam Reyes', email: 'sam@example.com' },
    track: { id: 'track-1', name: 'Road America', location: 'Elkhart Lake, WI' },
    lapCount: lapTimesMs.length,
    lapTimesMs,
    track_day: { id: 'day-1', date: '2026-07-12' },
    ...overrides,
  };
}

function rows() {
  return screen.getAllByRole('link');
}

/**
 * A realistic HPDE day, in the order the driver page actually receives it:
 * NEWEST FIRST. σ runs 0.5s (S1) -> 0.0s (S4) chronologically — the driver
 * tightened up over the day.
 */
const newestFirstDay: SessionWithDetails[] = [
  makeSession({ id: 's4', date: '2026-07-12T21:00:00Z', lapTimesMs: FLAT }),
  makeSession({ id: 's3', date: '2026-07-12T19:00:00Z', lapTimesMs: WOBBLY }),
  makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: WOBBLY }),
  makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY }),
];

describe('TrackDayList', () => {
  it('collapses every session sharing a track day into one row linking to the day', () => {
    render(<TrackDayList sessions={newestFirstDay} />);

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAttribute('href', '/days/day-1');
    expect(rows()[0]).toHaveTextContent('4 sessions');
    expect(rows()[0]).toHaveTextContent('Road America');
  });

  it('reports the σ trend chronologically even though sessions arrive newest-first', () => {
    render(<TrackDayList sessions={newestFirstDay} />);

    // Chronologically σ went 0.5 -> 0.0. Fed newest-first, a component that
    // trusted caller order would print "±0.0s → ±0.5s" — the same two numbers,
    // the opposite story.
    expect(rows()[0]).toHaveTextContent('±0.5s → ±0.0s');
    expect(rows()[0].textContent).not.toContain('±0.0s → ±0.5s');
  });

  it('shows the fastest lap of the whole day', () => {
    render(<TrackDayList sessions={newestFirstDay} />);

    expect(rows()[0]).toHaveTextContent('1:30.500'); // FLAT beats WOBBLY's 91000
  });

  it("labels the row with the track day's calendar date, not the session timestamp", () => {
    // 03:30Z on Jul 12 is Jul 11 at 22:30 in Chicago, where these tests run.
    // The track day says Jul 12, and so must the row — otherwise this list and
    // the day page one click away disagree about what day it is.
    render(
      <TrackDayList
        sessions={[
          makeSession({
            id: 's1',
            date: '2026-07-12T03:30:00Z',
            lapTimesMs: WOBBLY,
            track_day: { id: 'day-1', date: '2026-07-12' },
          }),
        ]}
      />
    );

    expect(rows()[0]).toHaveTextContent('Jul 12, 2026');
    expect(rows()[0].textContent).not.toContain('Jul 11');
  });

  it('makes no consistency claim for a one-session day, and says why', () => {
    render(
      <TrackDayList sessions={[makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY })]} />
    );

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('1 session');
    expect(rows()[0].textContent).not.toContain('→');
    expect(rows()[0]).toHaveTextContent('Needs two sessions of 6+ laps');
  });

  it('makes no consistency claim when only one session clears the lap gate', () => {
    render(
      <TrackDayList
        sessions={[
          makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: WOBBLY }),
          makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: [93000, 92500, 93200] }),
        ]}
      />
    );

    expect(rows()[0]).toHaveTextContent('2 sessions');
    expect(rows()[0].textContent).not.toContain('±');
    expect(rows()[0]).toHaveTextContent('Needs two sessions of 6+ laps');
  });

  it('lists days newest first, one row per day', () => {
    render(
      <TrackDayList
        sessions={[
          makeSession({
            id: 's3',
            date: '2026-08-02T15:00:00Z',
            lapTimesMs: FLAT,
            track_day: { id: 'day-2', date: '2026-08-02' },
          }),
          makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: WOBBLY }),
          makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: FLAT }),
        ]}
      />
    );

    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveAttribute('href', '/days/day-2');
    expect(rows()[0]).toHaveTextContent('Aug 2, 2026');
    expect(rows()[1]).toHaveAttribute('href', '/days/day-1');
    expect(rows()[1]).toHaveTextContent('Jul 12, 2026');
  });

  it('still groups sessions with no track day, linking to the earliest session', () => {
    // Shouldn't exist after the backfill. If it does, the row is degraded, not
    // missing: it groups on a derived date+track key and drops to the session.
    render(
      <TrackDayList
        sessions={[
          makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: FLAT, track_day: null }),
          makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY, track_day: null }),
        ]}
      />
    );

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAttribute('href', '/sessions/s1');
    expect(rows()[0]).toHaveTextContent('2 sessions');
    expect(rows()[0]).toHaveTextContent('Jul 12, 2026');
    expect(rows()[0]).toHaveTextContent('±0.5s → ±0.0s');
  });

  it('keeps an orphan day separate from a real one at the same track and date', () => {
    render(
      <TrackDayList
        sessions={[
          makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: FLAT, track_day: null }),
          makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY }),
        ]}
      />
    );

    // Two rows, not one merged row that would claim a σ trend across a boundary
    // the database never drew.
    expect(rows()).toHaveLength(2);
    rows().forEach((row) => expect(row).toHaveTextContent('1 session'));
    expect(rows().map((r) => r.getAttribute('href')).sort()).toEqual([
      '/days/day-1',
      '/sessions/s2',
    ]);
  });

  it('renders a placeholder rather than a fake best lap when a day has none', () => {
    render(
      <TrackDayList
        sessions={[makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', best_lap_ms: null })]}
      />
    );

    expect(rows()[0]).toHaveTextContent('--');
    expect(rows()[0].textContent).not.toContain('±');
  });
});
