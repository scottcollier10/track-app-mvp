/**
 * The lap primitives every other module measures against: the thresholds, and
 * the one question that comes before all of them — "is this a lap at all?".
 *
 * THE LEAF. This file imports nothing, on purpose. `isCountableLapMs` lived in
 * track-days.ts, which imports sessionConsistencySeconds from analytics-v2, so
 * analytics-v2 could not import the predicate back without closing a module
 * cycle — and an import cycle is how a second copy of the test gets written
 * instead. Everything can reach a leaf, so everything does.
 *
 * Thresholds: calibrate on real pilot data; never inline these.
 */
export const CLEAN_LAP_MAX_MULTIPLE = 1.25; // drop laps slower than 1.25x session median (out/in/pit/traffic)
export const MIN_CLEAN_LAPS_FOR_FADE = 6;   // fade needs >=6 clean laps
export const FADE_THRESHOLD_S = 0.5;        // last-third slower than first-third by >0.5s => faded
export const MIN_PRIOR_SESSIONS_FOR_BASELINE = 3; // consistency baseline needs >=3 prior sessions
export const BASELINE_SIGMA = 2;            // control-chart limit = mean +/- 2*sigma
export const BASELINE_MIN_DELTA_S = 0.1;    // ignore breakouts smaller than 0.1s (guards sigma~0)
export const PB_REGRESSION_PCT = 0.01;      // session best >1% slower than track PB => regressed
export const READINESS_MIN_SESSIONS = 4;    // readiness needs >=4 clean sessions in current tier
export const SPARKLINE_WINDOW = 8;          // last N session-bests shown in row sparklines

/**
 * THE one definition of a countable lap, at the VALUE level: is this
 * milliseconds figure a lap at all?
 *
 * The sites that delegate: the row predicate (isCountableLap in track-days),
 * dayBestLapMs, sessionDelta's best-lap guard, the prior-track-bests filter in
 * evaluateStudent, the coach dashboard's best/avg/lap counts, the import
 * screen's flag list, the insight layer's pace-trend gate, the peak window in
 * data/driverProgress — so "is this a lap" has one answer whichever shape those
 * callers hold it in.
 *
 * Read that as a list of delegators, not as a census of the predicate. These
 * still ask it inline; all predate the collapse and all are left alone on
 * purpose:
 *   - isRegressedVsTrackPB (analytics-v2) re-asks `> 0` on the prior-bests list
 *     evaluateStudent already filtered, and on its sessionBestMs argument —
 *     which is why the entry above names the caller and not this function.
 *   - gapToIdealSeconds (analytics-v2), on its fastest-lap argument.
 *   - the driver-progress API route's personal-best scan, which asks the WEAKER
 *     `!== null`, so a stored 0 survives into Math.min and prints as a phantom
 *     PB before `> 0` is re-asked further down. That is a live bug and wants its
 *     own change, not a rename.
 *   - ProgressTimeline's PB highlight, on a computed summary's bestLap rather
 *     than on a lap row.
 *
 * A stored `sessions.best_lap_ms` is one of those shapes: csv-parser computes it
 * as Math.min over UNFILTERED times, so a session whose only rows are zeros
 * stores a 0 best lap, and every screen that prints it has to ask the same
 * question the σ gate asked.
 *
 * This is a narrower question than cleanLaps() answers — "is this a lap at all",
 * not "is this a representative lap" — so the two sets are deliberately
 * different and neither replaces the other.
 */
export function isCountableLapMs(lapTimeMs: number | null): lapTimeMs is number {
  return lapTimeMs !== null && lapTimeMs > 0;
}
