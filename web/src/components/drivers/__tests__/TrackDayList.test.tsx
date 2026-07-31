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
 *  - the CUTOFF: it must drop whole days. Applied to sessions instead, it
 *    splits one, and the row then contradicts the page it links to.
 *  - the EMPTY STATE: "no days at all" and "no days in this window" look the
 *    same and mean opposite things — see the 'which empty it is' block.
 *
 * Lap fixtures are chosen so σ is hand-checkable and no lap is dropped by
 * cleanLaps (nothing near 1.25x the median):
 *   [91000, 92000] x3 -> sample sd = sqrt(6*500^2/5) = 547.7ms = 0.5s
 *   [90500] x6        -> sd 0.0s
 */
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrackDayList from '../TrackDayList';
import type { SessionWithTrackDay } from '@/data/sessions';

const WOBBLY = [91000, 92000, 91000, 92000, 91000, 92000]; // sd 0.5s
const FLAT = [90500, 90500, 90500, 90500, 90500, 90500]; // sd 0.0s

function makeSession(
  overrides: Partial<SessionWithTrackDay> & Pick<SessionWithTrackDay, 'id' | 'date'>
): SessionWithTrackDay {
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
    representativeness: null,
    assessmentCount: 0,
    ...overrides,
  };
}

function rows() {
  return screen.getAllByRole('link');
}

/**
 * The day's best lap is queried by test id, never by substring: "does the row
 * contain '--'?" also passes when the σ trend renders a dash, so it would keep
 * passing with the best-lap placeholder broken.
 */
function dayBestLap(row: HTMLElement) {
  return row.querySelector('[data-testid="day-best-lap"]');
}

/**
 * A realistic HPDE day, in the order the driver page actually receives it:
 * NEWEST FIRST. σ runs 0.5s (S1) -> 0.0s (S4) chronologically — the driver
 * tightened up over the day.
 */
const newestFirstDay: SessionWithTrackDay[] = [
  makeSession({ id: 's4', date: '2026-07-12T21:00:00Z', lapTimesMs: FLAT }),
  makeSession({ id: 's3', date: '2026-07-12T19:00:00Z', lapTimesMs: WOBBLY }),
  makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: WOBBLY }),
  makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY }),
];

/**
 * The same day, straddling midnight UTC: the last session is an evening run at
 * Road America (America/Chicago), so its timestamp lands on the NEXT UTC day
 * while it still belongs to track day 2026-07-12. A cutoff applied to sessions
 * rather than to whole days cuts this day in half.
 */
const straddlingDay: SessionWithTrackDay[] = [
  makeSession({ id: 's4', date: '2026-07-13T01:00:00Z', lapTimesMs: FLAT }), // 8pm Jul 12 local
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

  it('makes the day page\'s qualifying-session claim, not a start-to-end-of-day one', () => {
    // Same wording as the day page KPI, from one constant. Without it the pair
    // of numbers reads as first session -> last session, which it is not when
    // some sessions miss the lap gate.
    render(<TrackDayList sessions={newestFirstDay} />);

    expect(rows()[0]).toHaveTextContent('First to last qualifying session');
  });

  it('shows the fastest lap of the whole day', () => {
    render(<TrackDayList sessions={newestFirstDay} />);

    expect(dayBestLap(rows()[0])!.textContent).toBe('1:30.500'); // FLAT beats WOBBLY's 91000
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
    // And no claim about qualifying sessions when there is no figure to qualify.
    expect(rows()[0].textContent).not.toContain('First to last');
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

  it('orders two tracks on the same date by track name', () => {
    render(
      <TrackDayList
        sessions={[
          makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: WOBBLY }),
          makeSession({
            id: 's1',
            date: '2026-07-12T15:00:00Z',
            lapTimesMs: FLAT,
            track: { id: 'track-2', name: 'Blackhawk Farms', location: 'South Beloit, IL' },
            track_day: { id: 'day-2', date: '2026-07-12' },
          }),
        ]}
      />
    );

    // The dates tie, so track name decides — and it must decide, not leave the
    // two rows swapping places on the whim of Map insertion order.
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent('Blackhawk Farms');
    expect(rows()[0]).toHaveAttribute('href', '/days/day-2');
    expect(rows()[1]).toHaveTextContent('Road America');
    expect(rows()[1]).toHaveAttribute('href', '/days/day-1');
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
    // the database never drew. Both keys tie on date and track name, so the
    // order is decided by the group key — asserted directly, because "some
    // order" is what the sort exists to rule out.
    expect(rows()).toHaveLength(2);
    rows().forEach((row) => expect(row).toHaveTextContent('1 session'));
    expect(rows().map((r) => r.getAttribute('href'))).toEqual(['/days/day-1', '/sessions/s2']);
  });

  it('renders a placeholder rather than a fake best lap when a day has none', () => {
    render(
      <TrackDayList
        sessions={[makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', best_lap_ms: null })]}
      />
    );

    // Exact text on the best-lap element itself: this row also renders "--" for
    // its σ trend, so a substring check would pass with the placeholder broken.
    expect(dayBestLap(rows()[0])!.textContent).toBe('--');
    expect(rows()[0].textContent).not.toContain('±');
  });

  describe('date cutoff', () => {
    it('keeps every session of a day on the cutoff date, including ones timestamped past it', () => {
      // The cutoff is the day this track day happened on, so the whole day
      // stays — all four sessions and the full 0.5 -> 0.0 trend. Filtering
      // sessions before grouping instead would drop the ones on the near side
      // of the cutoff instant and leave this row claiming a smaller day with a
      // different trend than /days/day-1 shows.
      render(<TrackDayList sessions={straddlingDay} cutoffDate="2026-07-12" />);

      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveAttribute('href', '/days/day-1');
      expect(rows()[0]).toHaveTextContent('4 sessions');
      expect(rows()[0]).toHaveTextContent('±0.5s → ±0.0s');
    });

    it('drops the whole day when its date is before the cutoff, session timestamps notwithstanding', () => {
      // One session of this day carries a 2026-07-13 timestamp. The day is
      // 2026-07-12 and the cutoff is 2026-07-13, so the day goes — all of it.
      // A session-level filter would keep that one session and render a row for
      // a day the coach asked not to see, counting 1 session instead of 4.
      render(<TrackDayList sessions={straddlingDay} cutoffDate="2026-07-13" />);

      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByText('No track days in the selected time period.')).toBeInTheDocument();
    });

    it('keeps days on or after the cutoff and drops earlier ones', () => {
      render(
        <TrackDayList
          sessions={[
            makeSession({
              id: 's2',
              date: '2026-08-02T15:00:00Z',
              lapTimesMs: FLAT,
              track_day: { id: 'day-2', date: '2026-08-02' },
            }),
            makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY }),
          ]}
          cutoffDate="2026-08-02"
        />
      );

      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveAttribute('href', '/days/day-2');
    });

    it('applies no bound at all when there is no cutoff', () => {
      render(<TrackDayList sessions={straddlingDay} cutoffDate={null} />);

      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveTextContent('4 sessions');
    });
  });

  /**
   * The assessment badge is a plain fact — the count of assessments on the
   * day's sessions, summed straight off what each session row already carries.
   * Nothing is derived, and zero renders NOTHING: "0 assessed" would put a
   * to-do connotation on every pre-loop day.
   */
  describe('assessment badge', () => {
    it('sums assessment counts across the day\'s sessions and renders "{n} assessed"', () => {
      render(
        <TrackDayList
          sessions={[
            makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: FLAT, assessmentCount: 2 }),
            makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY, assessmentCount: 1 }),
          ]}
        />
      );

      expect(rows()[0]).toHaveTextContent('3 assessed');
    });

    it('hides the badge entirely at zero — no "0 assessed"', () => {
      render(<TrackDayList sessions={newestFirstDay} />);

      expect(rows()[0].textContent).not.toContain('assessed');
    });

    it('counts per day, not across the whole list', () => {
      render(
        <TrackDayList
          sessions={[
            makeSession({
              id: 's3',
              date: '2026-08-02T15:00:00Z',
              lapTimesMs: FLAT,
              track_day: { id: 'day-2', date: '2026-08-02' },
              assessmentCount: 2,
            }),
            makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY }),
          ]}
        />
      );

      expect(rows()[0]).toHaveTextContent('2 assessed'); // day-2, newest first
      expect(rows()[1].textContent).not.toContain('assessed'); // day-1 has none
    });
  });

  it('says so when there are no track days at all, rather than showing a bare heading', () => {
    render(<TrackDayList sessions={[]} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(/No track days yet/)).toBeInTheDocument();
  });

  /**
   * Two empties that look identical and mean opposite things: "this driver has
   * no data" and "your filter is hiding this driver's data". The default filter
   * is Last 90 Days, so any driver last on track in the autumn opens on the
   * second one — and reading it as the first is a coach concluding the app lost
   * their data. The component holds both the pre-filter and post-filter day
   * count (it groups, then drops whole days), so it can tell them apart.
   */
  describe('which empty it is', () => {
    it('reports no days at all — not an empty window — when the driver has no sessions', () => {
      // A cutoff is set, as the driver page always sets one, and it is NOT what
      // makes this list empty. Keying the message off the cutoff instead of off
      // the day count tells a brand-new driver to widen a filter that would
      // show them nothing either way.
      render(<TrackDayList sessions={[]} cutoffDate="2026-07-13" onShowAllTime={() => {}} />);

      expect(screen.getByText(/No track days yet/)).toBeInTheDocument();
      expect(screen.queryByText(/selected time period/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('names how many days sit outside the window, and offers the widening click', () => {
      const onShowAllTime = jest.fn();
      render(
        <TrackDayList
          sessions={[
            makeSession({ id: 's2', date: '2026-07-12T17:00:00Z', lapTimesMs: FLAT }),
            makeSession({
              id: 's1',
              date: '2026-06-01T15:00:00Z',
              lapTimesMs: WOBBLY,
              track_day: { id: 'day-0', date: '2026-06-01' },
            }),
          ]}
          cutoffDate="2026-08-01"
          onShowAllTime={onShowAllTime}
        />
      );

      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByText('No track days in the selected time period.')).toBeInTheDocument();
      // Two days hidden, counted after grouping: the sessions number three
      // across them, and "3 track days" would be a new wrong claim.
      expect(screen.getByText('This driver has 2 track days outside it.')).toBeInTheDocument();

      const widen = screen.getByRole('button', { name: /All Time/i });
      fireEvent.click(widen);
      expect(onShowAllTime).toHaveBeenCalledTimes(1);
    });

    it('does not auto-widen the filter it was given', () => {
      // The button asks; it does not act on its own. A component that widened
      // the window itself on mount would render rows under a "Last 90 Days"
      // button still highlighted.
      const onShowAllTime = jest.fn();
      render(
        <TrackDayList
          sessions={[makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY })]}
          cutoffDate="2026-08-01"
          onShowAllTime={onShowAllTime}
        />
      );

      expect(onShowAllTime).not.toHaveBeenCalled();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByText('This driver has 1 track day outside it.')).toBeInTheDocument();
    });

    it('still says which empty it is with no widening callback supplied', () => {
      // Standalone render: there is no filter to widen, so there is no button —
      // but the text must not fall back to implying the driver has no data.
      render(
        <TrackDayList
          sessions={[makeSession({ id: 's1', date: '2026-07-12T15:00:00Z', lapTimesMs: WOBBLY })]}
          cutoffDate="2026-08-01"
        />
      );

      expect(screen.getByText('No track days in the selected time period.')).toBeInTheDocument();
      expect(screen.getByText('This driver has 1 track day outside it.')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText(/No track days yet/)).not.toBeInTheDocument();
    });

    it('shows neither empty state when the window has days in it', () => {
      render(
        <TrackDayList sessions={straddlingDay} cutoffDate="2026-07-12" onShowAllTime={() => {}} />
      );

      expect(rows()).toHaveLength(1);
      expect(screen.queryByText(/No track days/)).not.toBeInTheDocument();
      expect(screen.queryByText(/outside it/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
