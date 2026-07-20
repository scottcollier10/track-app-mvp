import { consistencyBandState, formatConsistencySeconds } from '../consistencyBand';

describe('consistencyBandState', () => {
  it('is neutral when there are too few sessions for a baseline', () => {
    // consistencyBaseline needs >= 3 priors; fewer -> null -> neutral.
    expect(consistencyBandState([0.4, 0.5])).toBe('neutral');
  });

  it('is neutral when the latest session sits inside the personal band', () => {
    // Tight, stable history; latest is typical.
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
