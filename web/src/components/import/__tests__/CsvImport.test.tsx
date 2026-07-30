/**
 * @jest-environment jsdom
 *
 * The import success panel's track-day links.
 *
 * One thing here is silent when wrong: the chip's driver name. A track day is
 * keyed on (driver, track, date), so the chip cannot name the WRONG driver —
 * but it can name the right driver with the wrong STRING. The CSV's name column
 * and `drivers.name` are two spellings of one person: the import route names a
 * driver it creates from the email local part, and an existing driver's row can
 * have been named differently long before this file was uploaded. /days/[id]
 * renders `drivers.name`, so a chip labelled from the CSV sends a coach to a
 * page that calls the driver something else.
 *
 * The fix is that the label comes off the route's response. These tests drive
 * the component with a response that DISAGREES with the CSV, so re-attaching
 * the CSV name in the import loop fails here rather than shipping.
 *
 * The other thing under test is WHERE the panel sends the coach: the day, not a
 * session. The day is the navigation hub and a session is one click deeper from
 * it, so a primary action pointing at /sessions/... is a regression even though
 * it would be a working link.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CsvImport from '../CsvImport';
import { parseSessionCsv, type ParsedSession } from '@/lib/csv-parser';

jest.mock('@/lib/csv-parser', () => ({ parseSessionCsv: jest.fn() }));

const mockParseSessionCsv = parseSessionCsv as jest.MockedFunction<typeof parseSessionCsv>;

/** What the ROUTE said about the session it just filed. */
interface RouteReply {
  sessionId: string;
  /** Optional ONLY so the fallback test can model a route that stopped sending it. */
  trackDayId?: string;
  /** drivers.name — deliberately not the CSV's driver_name in these fixtures. */
  driverName: string;
}

function parsedSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    driverEmail: 'taylor.brooks@trackapp.demo',
    // The spelling in the FILE. Nothing on the success panel may come from here.
    driverName: 'BROOKS, T. (car 42)',
    trackName: 'Road America',
    date: '2026-07-12T12:00:00.000Z',
    totalTimeMs: 182000,
    bestLapMs: 90500,
    source: 'RaceChrono',
    laps: [
      { lapNumber: 1, lapTimeMs: 91500 },
      { lapNumber: 2, lapTimeMs: 90500 },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/**
 * Stubs the two endpoints the import loop calls. The import-session reply is
 * chosen by the payload's driverEmail, so each CSV row gets its own answer.
 */
function stubFetch(repliesByEmail: Record<string, RouteReply>, status = 201) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/tracks')) {
      return jsonResponse({ tracks: [{ id: 'track-1', name: 'Road America' }] }, 200);
    }
    if (url === '/api/import-session') {
      const payload = JSON.parse(String(init?.body)) as { driverEmail: string };
      return jsonResponse(repliesByEmail[payload.driverEmail], status);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** Every link the success panel offers, as [href, accessible text] pairs. */
function panelLinks(): Array<[string | null, string]> {
  return screen
    .getAllByRole('link')
    .map((a) => [a.getAttribute('href'), a.textContent ?? ''] as [string | null, string]);
}

/** Upload a file, wait for the preview, then click Import. */
async function runImport(sessions: ParsedSession[]) {
  mockParseSessionCsv.mockResolvedValue({ success: true, sessions, warnings: [] });

  const { container } = render(<CsvImport />);

  const input = container.querySelector('#csv-upload') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['lap,data'], 'laps.csv', { type: 'text/csv' })] },
  });

  fireEvent.click(await screen.findByText('Import Sessions'));
  await waitFor(() => expect(screen.getByText('Import Complete!')).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CsvImport success panel — track day links', () => {
  it("labels each day with the DB driver name, not the CSV's", async () => {
    // Two drivers at one event are two track days (days are per driver), which
    // is the case that prints names at all.
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
      'jamie.rodriguez@trackapp.demo': {
        sessionId: 'session-2',
        trackDayId: 'day-b',
        driverName: 'jamie rodriguez',
      },
    });

    await runImport([
      parsedSession(),
      parsedSession({
        driverEmail: 'jamie.rodriguez@trackapp.demo',
        driverName: 'RODRIGUEZ, J. (car 7)',
      }),
    ]);

    // formatDriverName over drivers.name — the exact string /days/[id] renders.
    const taylor = screen.getByRole('link', { name: "View Taylor Brooks's track day" });
    const jamie = screen.getByRole('link', { name: "View Jamie Rodriguez's track day" });
    expect(taylor).toHaveAttribute('href', '/days/day-a');
    expect(jamie).toHaveAttribute('href', '/days/day-b');

    // Nothing on this panel is spelled the way the file spelled it.
    expect(screen.queryByText(/BROOKS, T\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/RODRIGUEZ, J\./)).not.toBeInTheDocument();
  });

  it('labels the 207 partial-laps path from the DB name too', async () => {
    // A 207 created the session and its day, so it gets a link — and it must be
    // sourced identically to the 201's, or one rarer branch spells the driver
    // the file's way while the other spells it the database's way.
    stubFetch(
      {
        'taylor.brooks@trackapp.demo': {
          sessionId: 'session-1',
          trackDayId: 'day-a',
          driverName: 'taylor.brooks',
        },
        'jamie.rodriguez@trackapp.demo': {
          sessionId: 'session-2',
          trackDayId: 'day-b',
          driverName: 'jamie rodriguez',
        },
      },
      207
    );

    await runImport([
      parsedSession(),
      parsedSession({
        driverEmail: 'jamie.rodriguez@trackapp.demo',
        driverName: 'RODRIGUEZ, J. (car 7)',
      }),
    ]);

    expect(screen.getByText("View Taylor Brooks's track day")).toHaveAttribute(
      'href',
      '/days/day-a'
    );
    expect(screen.getByText("View Jamie Rodriguez's track day")).toHaveAttribute(
      'href',
      '/days/day-b'
    );
  });

  it('names nobody when the whole file landed in one day', async () => {
    // The common case. One link needs no distinguishing label, and the day page
    // it opens shows whose day it is.
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
    });

    await runImport([parsedSession(), parsedSession({ bestLapMs: 90100 })]);

    expect(screen.getByRole('link', { name: 'View track day' })).toHaveAttribute(
      'href',
      '/days/day-a'
    );
    expect(screen.queryByText(/Taylor/)).not.toBeInTheDocument();
  });

  it('counts only laps a 201 confirmed, and says the total leaves a 207 out', async () => {
    // The 207 body says the session and its day exist; it does NOT say how many
    // of that session's laps landed. Counting the two laps submitted would make
    // this the one figure on the panel that reports what was SENT.
    stubFetch(
      {
        'taylor.brooks@trackapp.demo': {
          sessionId: 'session-1',
          trackDayId: 'day-a',
          driverName: 'taylor.brooks',
        },
      },
      207
    );

    await runImport([parsedSession()]);

    expect(screen.getByText(/Imported/)).toHaveTextContent('0 laps');
    expect(
      screen.getByText(/Lap count excludes 1 session\(s\) whose laps failed to import/)
    ).toBeInTheDocument();
  });

  it('counts the laps of a clean 201 and adds no caveat', async () => {
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
    });

    // Two sessions of two laps each; the route inserts every lap it was sent on
    // a 201, so submitted and stored are the same number here.
    await runImport([parsedSession(), parsedSession({ bestLapMs: 90100 })]);

    expect(screen.getByText(/Imported/)).toHaveTextContent('4 laps');
    expect(screen.queryByText(/Lap count excludes/)).not.toBeInTheDocument();
  });

  it('does not print a DATE next to a day link', async () => {
    // Deliberate: the only date the client has is the CSV parse, anchored at
    // noon in the SERVER's zone, while /days/[id] renders the authoritative
    // track-local date. Printing it risks this panel saying "Jul 11" and the
    // page it links to saying "Jul 12".
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
    });

    await runImport([parsedSession()]);

    expect(screen.getByRole('link', { name: 'View track day' }).textContent).not.toMatch(/\d/);
  });
});

describe('CsvImport success panel — where the confirmation lands', () => {
  it('makes the DAY the primary action after a one-day import', async () => {
    // The day is the navigation hub; the session is one click deeper from it.
    // A primary button to /sessions/<first imported id> also picked that session
    // by CSV row order, which is not chronological.
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
    });

    await runImport([parsedSession(), parsedSession({ bestLapMs: 90100 })]);

    const primary = screen.getByRole('link', { name: 'View track day' });
    expect(primary).toHaveAttribute('href', '/days/day-a');
    // A real link (middle-click / open-in-new-tab), carrying the app's primary
    // Button rather than this file's chip styling.
    expect(primary.tagName).toBe('A');
    expect(primary.querySelector('button')).toBeInTheDocument();

    // Nothing on the panel routes to a session, and the old plural-but-singular
    // "View Sessions" button is gone.
    expect(screen.queryByText('View Sessions')).not.toBeInTheDocument();
    expect(panelLinks().map(([href]) => href)).toEqual(['/days/day-a']);
  });

  it('leaves the per-day chips as the navigation when the file spans days', async () => {
    // No single day to promote here, so nothing is promoted: picking one would
    // mean picking by CSV row order.
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        trackDayId: 'day-a',
        driverName: 'taylor.brooks',
      },
      'jamie.rodriguez@trackapp.demo': {
        sessionId: 'session-2',
        trackDayId: 'day-b',
        driverName: 'jamie rodriguez',
      },
    });

    await runImport([
      parsedSession(),
      parsedSession({
        driverEmail: 'jamie.rodriguez@trackapp.demo',
        driverName: 'RODRIGUEZ, J. (car 7)',
      }),
    ]);

    expect(
      screen.getByText('These sessions landed in 2 track days')
    ).toBeInTheDocument();
    expect(panelLinks()).toEqual([
      ['/days/day-a', "View Taylor Brooks's track day"],
      ['/days/day-b', "View Jamie Rodriguez's track day"],
    ]);
    expect(screen.queryByText('View Sessions')).not.toBeInTheDocument();
  });

  it('still offers a way forward when the route returned no track day', async () => {
    // Shouldn't happen — every imported session has a day. But a success panel
    // with no link out is a dead end, so the session stays as the fallback.
    stubFetch({
      'taylor.brooks@trackapp.demo': {
        sessionId: 'session-1',
        driverName: 'taylor.brooks',
      },
    });

    await runImport([parsedSession()]);

    expect(screen.getByRole('link', { name: 'View session' })).toHaveAttribute(
      'href',
      '/sessions/session-1'
    );
    // Never a link to /days/undefined, which looks fine until it is clicked.
    expect(panelLinks().map(([href]) => href)).toEqual(['/sessions/session-1']);
  });
});
