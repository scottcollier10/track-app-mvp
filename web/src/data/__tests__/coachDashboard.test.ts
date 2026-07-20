import { buildStudents } from '../coachDashboard';
import type { SessionRow } from '../coachDashboard';

/** Helper to build a SessionRow with sensible defaults. */
function row(overrides: Partial<SessionRow>): SessionRow {
  return {
    driverId: 'd1',
    driverName: 'Driver One',
    driverEmail: 'd1@example.com',
    experienceLevel: 'beginner',
    trackId: 't1',
    trackName: 'Track One',
    date: '2026-01-01',
    bestLapMs: 90000,
    lapTimesMs: [90000, 90500, 91000],
    sectorData: [null, null, null],
    ...overrides,
  };
}

/** A tight, clean session (low std-dev, no late fade). ~90s laps. */
function cleanLaps(): Array<number | null> {
  return [90000, 90100, 90050, 90080, 90020, 90060, 90040, 90070];
}

/** A session that clearly fades: last third much slower than first third. */
function fadingLaps(): Array<number | null> {
  return [90000, 90100, 90050, 90080, 90200, 91500, 91800, 92000, 92200];
}

describe('buildStudents', () => {
  it('flags a student with a clear in-session fade (non-empty flags, severity > 0)', () => {
    const rows: SessionRow[] = [
      row({
        driverId: 'faded',
        driverName: 'Faded Fred',
        date: '2026-02-01',
        bestLapMs: 90000,
        lapTimesMs: fadingLaps(),
      }),
    ];

    const [student] = buildStudents(rows);

    expect(student.driverId).toBe('faded');
    expect(student.flags.length).toBeGreaterThan(0);
    expect(student.flags.some((f) => f.kind === 'faded')).toBe(true);
    expect(student.severityScore).toBeGreaterThan(0);
  });

  it('reports baselineState "building" for a thin-data student', () => {
    const rows: SessionRow[] = [
      row({
        driverId: 'thin',
        driverName: 'Thin Tina',
        date: '2026-03-01',
        lapTimesMs: cleanLaps(),
      }),
    ];

    const [student] = buildStudents(rows);

    expect(student.driverId).toBe('thin');
    expect(student.baselineState).toBe('building');
  });

  it('marks a student ready with 4+ clean, tightening sessions and no late fade', () => {
    // 3 prior sessions with looser consistency, then a tighter latest session.
    const loose = (base: number): Array<number | null> => [
      base, base + 400, base + 100, base + 500, base + 200, base + 450,
    ];
    const tight = (base: number): Array<number | null> => [
      base, base + 40, base + 20, base + 60, base + 30, base + 50,
    ];

    const rows: SessionRow[] = [
      row({ driverId: 'ready', driverName: 'Ready Rita', date: '2026-01-01', bestLapMs: 90600, lapTimesMs: loose(90000) }),
      row({ driverId: 'ready', driverName: 'Ready Rita', date: '2026-01-08', bestLapMs: 90550, lapTimesMs: loose(89950) }),
      row({ driverId: 'ready', driverName: 'Ready Rita', date: '2026-01-15', bestLapMs: 90500, lapTimesMs: loose(89900) }),
      row({ driverId: 'ready', driverName: 'Ready Rita', date: '2026-01-22', bestLapMs: 89000, lapTimesMs: tight(88900) }),
    ];

    const [student] = buildStudents(rows);

    expect(student.driverId).toBe('ready');
    expect(student.ready).toBe(true);
    expect(student.readyWhy).not.toBeNull();
  });

  it('derives roll-up fields: last track by latest date, best/avg lap, session/lap counts', () => {
    const rows: SessionRow[] = [
      row({ driverId: 'roll', date: '2026-01-01', trackName: 'Alpha', bestLapMs: 92000, lapTimesMs: [92000, 92100] }),
      row({ driverId: 'roll', date: '2026-02-01', trackName: 'Bravo', bestLapMs: 90000, lapTimesMs: [90000, 90100, 90200] }),
    ];

    const [student] = buildStudents(rows);

    expect(student.lastTrackName).toBe('Bravo');
    expect(student.lastSessionDate).toBe('2026-02-01');
    expect(student.bestLapMs).toBe(90000); // min across sessions
    expect(student.avgBestLapMs).toBe(91000); // mean of 92000 and 90000
    expect(student.sessionCount).toBe(2);
    expect(student.totalLaps).toBe(5); // 2 + 3 positive laps
  });
});
