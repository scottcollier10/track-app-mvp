import { consistencyBandState, formatConsistencySeconds } from '../consistencyBand';

describe('consistencyBandState', () => {
  it('is neutral when there are too few PRIORS for a baseline', () => {
    // Baseline is priors-only: the latest value is excluded before building the band.
    // consistencyBaseline needs >= 3 priors, so 3 total (2 priors + latest) is still
    // too few and stays neutral — the effective minimum is now 4 total sessions.
    expect(consistencyBandState([0.4, 0.5, 0.6])).toBe('neutral');
  });

  it('builds a band once there are 3 priors plus the latest (4 total)', () => {
    // 3 tight priors define the band; a clear blow-out on the 4th flags worse.
    // Proves the boundary is 4 total, not 3 — and that a real breakout is caught.
    expect(consistencyBandState([0.4, 0.4, 0.4, 1.2])).toBe('worse');
  });

  it('is neutral when the latest session sits inside the personal band', () => {
    // Tight, stable history; latest is typical. 4 priors + latest.
    expect(consistencyBandState([0.4, 0.42, 0.41, 0.4, 0.41])).toBe('neutral');
  });

  it('flags worse when the latest session breaks above the upper limit', () => {
    // Steady ~0.4s then a clear blow-out.
    expect(
      consistencyBandState([0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 1.2])
    ).toBe('worse');
  });

  it('flags better when the latest session drops below the lower limit', () => {
    // Loose ~0.9s history then a tight session.
    expect(
      consistencyBandState([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.2])
    ).toBe('better');
  });

  it('ignores nulls in the series', () => {
    expect(
      consistencyBandState([null, 0.4, 0.4, null, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 1.2])
    ).toBe('worse');
  });
});

describe('formatConsistencySeconds', () => {
  it('formats to one decimal with an s suffix', () => {
    expect(formatConsistencySeconds(0.42)).toBe('0.4s');
    expect(formatConsistencySeconds(1)).toBe('1.0s');
  });
});
