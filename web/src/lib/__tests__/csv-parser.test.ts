import { parseSessionCsv } from '../csv-parser';

const HEADER =
  'session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source';

/**
 * Papa.parse reads a File, so the bench has to hand it one. jsdom supplies
 * File/FileReader, and jest.config.js pins TZ to America/Chicago — which is the
 * whole point of asserting on session start times here rather than in UTC.
 */
function csvFile(rows: string[], header: string = HEADER): File {
  return new File([[header, ...rows].join('\n')], 'session.csv', {
    type: 'text/csv',
  });
}

describe('parseSessionCsv — session identity', () => {
  it('splits one file into a session per distinct start time', async () => {
    const result = await parseSessionCsv(
      csvFile([
        '2026-08-08,Sonoma Raceway,Jason Walker,1,93100,2026-08-08T15:30:00Z,RaceChrono',
        '2026-08-08,Sonoma Raceway,Jason Walker,2,92800,2026-08-08T15:30:00Z,RaceChrono',
        '2026-08-08,Sonoma Raceway,Jason Walker,1,91200,2026-08-08T18:00:00Z,RaceChrono',
        '2026-08-08,Sonoma Raceway,Jason Walker,2,91000,2026-08-08T18:00:00Z,RaceChrono',
      ])
    );

    expect(result.success).toBe(true);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions!.map((s) => s.laps.length)).toEqual([2, 2]);
  });
});

describe('parseSessionCsv — session start time', () => {
  it('takes the session start from the timestamp column', async () => {
    const result = await parseSessionCsv(
      csvFile([
        '2026-08-08,Sonoma Raceway,Jason Walker,1,91200,2026-08-08T15:30:00Z,RaceChrono',
      ])
    );

    expect(result.sessions![0].date).toBe('2026-08-08T15:30:00.000Z');
  });

  // The timestamp column is optional: only five headers are required, and the
  // five-column form has to keep landing on the right calendar day.
  it('falls back to noon local when there is no timestamp column', async () => {
    const result = await parseSessionCsv(
      csvFile(
        ['2026-08-08,Sonoma Raceway,Jason Walker,1,91200'],
        'session_date,track_name,driver_name,lap_number,lap_time_ms'
      )
    );

    expect(result.success).toBe(true);
    // TZ is pinned to America/Chicago (CDT, UTC-5) in jest.config.js.
    expect(result.sessions![0].date).toBe('2026-08-08T17:00:00.000Z');
  });

  it('falls back to noon local when the timestamp cell is blank', async () => {
    const result = await parseSessionCsv(
      csvFile(['2026-08-08,Sonoma Raceway,Jason Walker,1,91200,,RaceChrono'])
    );

    expect(result.success).toBe(true);
    expect(result.sessions![0].date).toBe('2026-08-08T17:00:00.000Z');
  });

  it('falls back to noon local when the timestamp is unparseable', async () => {
    const result = await parseSessionCsv(
      csvFile([
        '2026-08-08,Sonoma Raceway,Jason Walker,1,91200,not-a-date,RaceChrono',
      ])
    );

    expect(result.success).toBe(true);
    expect(result.sessions![0].date).toBe('2026-08-08T17:00:00.000Z');
  });
});
