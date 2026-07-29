/**
 * @jest-environment node
 *
 * formatTrackDate exists for one reason: track_days.date is a PLAIN track-local
 * calendar date with no instant attached, and `new Date('2026-07-28')` parses it
 * as UTC midnight. Rendered in any timezone west of UTC that prints the day
 * BEFORE the one the driver was at the track.
 *
 * Timezone determinism: jest.config.js pins TZ=America/Chicago in the real
 * process before workers fork. It has to live there and not here — assigning
 * process.env.TZ inside a test file mutates jest's private copy of the env, so
 * Node never calls tzset and the pin silently does nothing (measured: with the
 * assignment in this file, `TZ=UTC npx jest` still ran at UTC).
 *
 * Chicago and not UTC on purpose: at UTC the bug is invisible, so the guard
 * would pass vacuously. formatDate's misbehaviour is asserted here too, so if
 * the pin ever stops taking effect this file fails loudly instead of quietly
 * proving nothing.
 */
import { formatDate, formatTrackDate } from '@/lib/time';

describe('formatTrackDate', () => {
  it('renders a plain YYYY-MM-DD as that same calendar day', () => {
    expect(formatTrackDate('2026-07-28')).toBe('Jul 28, 2026');
  });

  it('does not shift a date backwards west of UTC — the bug formatDate has', () => {
    // The guard. formatDate goes through new Date(string) -> UTC midnight and
    // loses a day here; formatTrackDate builds from parts and cannot.
    expect(formatDate('2026-07-28')).toBe('Jul 27, 2026');
    expect(formatTrackDate('2026-07-28')).toBe('Jul 28, 2026');
  });

  it('holds across a year boundary', () => {
    expect(formatTrackDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('keeps the "Mon D, YYYY" shape formatDate produces', () => {
    // Nothing on the day page may shift visually — only the day it lands on.
    expect(formatTrackDate('2024-01-15')).toBe('Jan 15, 2024');
    expect(formatDate('2024-01-15T12:00:00Z')).toBe('Jan 15, 2024');
  });
});
