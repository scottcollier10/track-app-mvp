/** Lap-cleaning + flag thresholds. Calibrate on real pilot data; never inline these. */
export const CLEAN_LAP_MAX_MULTIPLE = 1.25; // drop laps slower than 1.25x session median (out/in/pit/traffic)
export const MIN_CLEAN_LAPS_FOR_FADE = 6;   // fade needs >=6 clean laps
export const FADE_THRESHOLD_S = 0.5;        // last-third slower than first-third by >0.5s => faded
export const MIN_PRIOR_SESSIONS_FOR_BASELINE = 3; // consistency baseline needs >=3 prior sessions
export const BASELINE_SIGMA = 2;            // control-chart limit = mean +/- 2*sigma
export const BASELINE_MIN_DELTA_S = 0.1;    // ignore breakouts smaller than 0.1s (guards sigma~0)
export const PB_REGRESSION_PCT = 0.01;      // session best >1% slower than track PB => regressed
export const READINESS_MIN_SESSIONS = 4;    // readiness needs >=4 clean sessions in current tier
export const SPARKLINE_WINDOW = 8;          // last N session-bests shown in row sparklines
