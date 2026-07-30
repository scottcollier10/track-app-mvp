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
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CsvImport from '../CsvImport';
import { parseSessionCsv, type ParsedSession } from '@/lib/csv-parser';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/csv-parser', () => ({ parseSessionCsv: jest.fn() }));

const mockParseSessionCsv = parseSessionCsv as jest.MockedFunction<typeof parseSessionCsv>;

/** What the ROUTE said about the session it just filed. */
interface RouteReply {
  sessionId: string;
  trackDayId: string;
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
    const taylor = screen.getByText("View Taylor Brooks's track day");
    const jamie = screen.getByText("View Jamie Rodriguez's track day");
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

    expect(screen.getByText('View track day')).toHaveAttribute('href', '/days/day-a');
    expect(screen.queryByText(/Taylor/)).not.toBeInTheDocument();
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

    expect(screen.getByText('View track day').textContent).not.toMatch(/\d/);
  });
});
