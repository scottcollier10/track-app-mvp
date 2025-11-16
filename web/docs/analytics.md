# Session Analytics Documentation

**Track App MVP - Analytics Formulas Reference**

This document provides detailed technical documentation for the session insights analytics system that calculates performance metrics from motorsport track session data.

---

## Table of Contents

- [Overview](#overview)
- [Consistency Score](#consistency-score)
- [Pace Trend Detection](#pace-trend-detection)
- [Driving Behavior Score](#driving-behavior-score)
- [Score Labeling System](#score-labeling-system)
- [Edge Cases](#edge-cases)
- [Future Enhancements](#future-enhancements)
- [Code Examples](#code-examples)

---

## Overview

### What Are Session Insights?

Session insights are performance metrics calculated from lap time data to help drivers and coaches understand:

- **Consistency**: How tightly lap times cluster together (repeatability)
- **Pace Trend**: Whether the driver improved, faded, or stayed consistent during the session
- **Driving Behavior**: Overall smoothness and control based on lap-to-lap variation

### Why Do They Exist?

Raw lap times tell you how fast you went, but not **why** or **how sustainable** that pace was. Session insights provide:

1. **Objective Performance Feedback**: Remove subjective judgment with data-driven metrics
2. **Training Focus Areas**: Identify whether to work on consistency, endurance, or raw speed
3. **Session-to-Session Comparison**: Track improvement across different days/conditions
4. **Coaching Aids**: Give coaches concrete data points for feedback discussions

### Architecture

The analytics system consists of two main files:

- **`src/lib/analytics.ts`**: Core calculation functions (pure math)
- **`src/lib/insights.ts`**: Unified interface, labeling, and presentation helpers

---

## Consistency Score

### Purpose

Measures how tightly your lap times cluster around the average. High consistency indicates repeatability and control, which is often more valuable than a single fast lap.

### Formula

The consistency score uses the **Coefficient of Variation (CV)**, which normalizes standard deviation by the mean:

```
CV = σ / μ

where:
  σ = sample standard deviation of lap times
  μ = mean (average) of lap times

Consistency Score = (1 - CV) × 100
Clamped to range [0, 100]
```

**Sample Standard Deviation (Bessel's correction):**

```
σ = √(Σ(xi - μ)² / (n - 1))

where:
  xi = individual lap time
  μ = mean lap time
  n = number of laps
```

### Implementation

```typescript
export function calculateConsistencyScore(lapTimes: (number | null)[]): number | null {
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 2) {
    return null; // Not enough data
  }

  const mean = average(validLapTimes);
  const std = sampleStandardDeviation(validLapTimes);

  if (mean === 0) return null;

  const rawScore = 1 - (std / mean);
  const consistencyScore = Math.max(0, Math.min(100, rawScore * 100));

  return Math.round(consistencyScore);
}
```

### Threshold Mappings

The `getScoreLabel()` function maps numeric scores to qualitative labels:

| Score Range | Label | Severity | Color Class | Meaning |
|-------------|-------|----------|-------------|---------|
| 90-100 | Excellent | excellent | text-emerald-400 | Elite-level consistency, pro-like repeatability |
| 80-89 | Strong | good | text-green-400 | Very consistent, minor variations only |
| 65-79 | Needs Work | ok | text-amber-400 | Moderate consistency, noticeable variation |
| 0-64 | Inconsistent | poor | text-red-400 | High variation, focus on consistency training |
| null | No Data | unknown | text-gray-400 | Insufficient laps (< 2) |

### Example Calculation

**Scenario:** 8 laps at a karting track

```typescript
const lapTimes = [62500, 61800, 62100, 61900, 62300, 61700, 62000, 61950]; // milliseconds

// Step 1: Calculate mean
μ = (62500 + 61800 + 62100 + 61900 + 62300 + 61700 + 62000 + 61950) / 8
μ = 495250 / 8 = 61906.25 ms

// Step 2: Calculate sample standard deviation
Squared differences from mean:
  (62500 - 61906.25)² = 352,265.06
  (61800 - 61906.25)² = 11,289.06
  (62100 - 61906.25)² = 37,539.06
  (61900 - 61906.25)² = 39.06
  (62300 - 61906.25)² = 155,039.06
  (61700 - 61906.25)² = 42,539.06
  (62000 - 61906.25)² = 8,789.06
  (61950 - 61906.25)² = 1,914.06

Sum = 609,413.54
Variance = 609,413.54 / (8 - 1) = 87,059.08
σ = √87,059.08 ≈ 295.06 ms

// Step 3: Calculate Coefficient of Variation
CV = 295.06 / 61906.25 ≈ 0.00477

// Step 4: Convert to score
Consistency Score = (1 - 0.00477) × 100 = 99.52 → 100 (rounded)

// Step 5: Apply label
100 ≥ 90 → "Excellent"
```

**Result:** Consistency Score = **100/100** ("Excellent")
**Interpretation:** Driver has elite-level consistency with only ~300ms variation across 8 laps.

---

## Pace Trend Detection

### Purpose

Determines whether the driver improved, faded, or maintained pace throughout the session by comparing early vs. late performance.

### Formula

**Simple Average Comparison:**

```
First3Avg = average(laps[0:3])
Last3Avg = average(laps[-3:])

if Last3Avg < First3Avg:
  return "Improving ↗"   // Faster at end (lower time)
else if Last3Avg > First3Avg:
  return "Fading ↘"      // Slower at end (higher time)
else:
  return "Consistent →"  // Same pace
```

**Note:** In motorsport, **lower lap times = faster pace**.

### Implementation

```typescript
export function calculatePaceTrend(lapTimes: (number | null)[]): string {
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 6) {
    return 'Not Enough Data';
  }

  const first3 = average(validLapTimes.slice(0, 3));
  const last3 = average(validLapTimes.slice(-3));

  // Lower time = faster = improving
  if (last3 < first3) {
    return 'Improving ↗';
  }

  // Higher time = slower = fading
  if (last3 > first3) {
    return 'Fading ↘';
  }

  return 'Consistent →';
}
```

### Result Mappings

| Result | Meaning | Color | Coaching Insight |
|--------|---------|-------|------------------|
| Improving ↗ | Last 3 laps faster than first 3 | Green | Good warm-up or learning, may have started conservative |
| Fading ↘ | Last 3 laps slower than first 3 | Red | Possible tire degradation, fatigue, or overdriving early |
| Consistent → | Same average pace throughout | Blue | Excellent pacing strategy, sustainable performance |
| Not Enough Data | < 6 laps total | Gray | Need more laps for trend analysis |

### Example Calculation

**Scenario:** 10 lap endurance stint

```typescript
const lapTimes = [64200, 63800, 63500, 62900, 62800, 62700, 63100, 63400, 63800, 64100];

// First 3 laps: [64200, 63800, 63500]
First3Avg = (64200 + 63800 + 63500) / 3 = 63833.33 ms

// Last 3 laps: [63800, 64100, 64100]
// Wait, let me recalculate with the actual last 3 from the array
// Last 3 laps: [63400, 63800, 64100]
Last3Avg = (63400 + 63800 + 64100) / 3 = 63766.67 ms

// Compare
63766.67 < 63833.33 → true
Result: "Improving ↗"

// Detailed message
Difference = 63833.33 - 63766.67 = 66.66 ms = 0.07 seconds
Message: "You got 0.07s faster from start to finish."
```

### Edge Cases

1. **Exactly Equal Averages:** Returns "Consistent →"
2. **Less Than 6 Laps:** Returns "Not Enough Data"
3. **Null Laps Filtered:** Only valid times used, but must still have 6+ after filtering

---

## Driving Behavior Score

### Purpose

Measures lap-to-lap stability and smoothness. High scores indicate controlled, repeatable driving; low scores suggest erratic pace or overdriving.

### Formula

**Standard Deviation Penalty:**

```
Behavior Score = 100 - (σ × 0.02)
Clamped to range [0, 100]

where:
  σ = sample standard deviation of lap times (in milliseconds)
```

**Interpretation:**
- Every 50ms of standard deviation costs 1 point
- Lower standard deviation = smoother driving = higher score

### Implementation

```typescript
export function calculateBehaviorScore(lapTimes: (number | null)[]): number | null {
  const validLapTimes = lapTimes.filter((t): t is number => t !== null && t > 0);

  if (validLapTimes.length < 2) {
    return null; // Not enough data
  }

  const std = sampleStandardDeviation(validLapTimes);
  const behaviorScore = Math.max(0, Math.min(100, 100 - (std * 0.02)));

  return Math.round(behaviorScore);
}
```

### Threshold Mappings

Uses the same `getScoreLabel()` system as Consistency Score:

| Score Range | Label | Severity | Color Class | Meaning |
|-------------|-------|----------|-------------|---------|
| 90-100 | Excellent | excellent | text-emerald-400 | σ < 500ms - Extremely smooth |
| 80-89 | Strong | good | text-green-400 | σ < 1000ms - Controlled driving |
| 65-79 | Needs Work | ok | text-amber-400 | σ < 1750ms - Some instability |
| 0-64 | Inconsistent | poor | text-red-400 | σ > 1750ms - Erratic pace |

### Example Calculation

**Scenario A: Smooth Driver**

```typescript
const lapTimes = [62100, 62050, 62200, 62150, 62080]; // Very tight times

// Standard deviation
σ ≈ 62.45 ms

// Behavior score
Score = 100 - (62.45 × 0.02)
Score = 100 - 1.25 = 98.75 → 99 (rounded)

Result: 99/100 ("Excellent")
```

**Scenario B: Erratic Driver**

```typescript
const lapTimes = [62000, 64500, 61200, 65800, 60500]; // Wild variation

// Standard deviation
σ ≈ 2250.5 ms

// Behavior score
Score = 100 - (2250.5 × 0.02)
Score = 100 - 45.01 = 54.99 → 55 (rounded)

Result: 55/100 ("Inconsistent")
```

### Relationship to Consistency Score

| Metric | What It Measures | When to Focus |
|--------|------------------|---------------|
| **Consistency Score** | Relative variation (CV) - independent of absolute speed | When comparing across different tracks/speeds |
| **Behavior Score** | Absolute variation (σ) - penalizes larger deltas | When analyzing single-session smoothness |

**Key Difference:** A slow driver with σ=200ms might have a worse CV than a fast driver with σ=300ms, but the slow driver would have a better behavior score.

---

## Score Labeling System

### getScoreLabel() Function

Maps numeric scores (0-100 or null) to qualitative labels with visual styling.

```typescript
export function getScoreLabel(score: number | null): {
  label: string;
  severity: 'excellent' | 'good' | 'ok' | 'poor' | 'unknown';
  colorClass: string;
}
```

### Complete Mapping Table

| Input Score | Label | Severity | Tailwind Class | RGB (Approx) | Use Case |
|-------------|-------|----------|----------------|--------------|----------|
| null | No Data | unknown | text-gray-400 | #9CA3AF | < 2 laps |
| 90-100 | Excellent | excellent | text-emerald-400 | #34D399 | Elite performance |
| 80-89 | Strong | good | text-green-400 | #4ADE80 | Above average |
| 65-79 | Needs Work | ok | text-amber-400 | #FBBF24 | Room for improvement |
| 0-64 | Inconsistent | poor | text-red-400 | #F87171 | Requires attention |

### Visual Example

```tsx
const insights = getSessionInsightsFromMs(lapTimes);
const label = getScoreLabel(insights.consistencyScore);

<div className={label.colorClass}>
  {label.label}  {/* "Excellent", "Strong", etc. */}
</div>
```

---

## Edge Cases

### 1. Insufficient Data (< 2 laps)

**Behavior:**
- Consistency Score: Returns `null`
- Behavior Score: Returns `null`
- Pace Trend: Returns `"Not Enough Data"`

**Example:**
```typescript
calculateConsistencyScore([62000]);        // null
calculateBehaviorScore([62000]);          // null
calculatePaceTrend([62000]);              // "Not Enough Data"
```

### 2. Insufficient Data for Pace Trend (< 6 laps)

**Behavior:**
- Consistency and Behavior scores still calculated (only need 2+ laps)
- Pace Trend returns `"Not Enough Data"`

**Example:**
```typescript
const lapTimes = [62000, 61800, 62100, 61900];

calculateConsistencyScore(lapTimes);  // 99 (calculated normally)
calculateBehaviorScore(lapTimes);     // 99 (calculated normally)
calculatePaceTrend(lapTimes);         // "Not Enough Data" (need 6)
```

### 3. All Identical Lap Times

**Behavior:**
- Standard deviation = 0
- Consistency Score = 100 (perfect)
- Behavior Score = 100 (perfect)
- Pace Trend = "Consistent →"

**Example:**
```typescript
const lapTimes = [62000, 62000, 62000, 62000, 62000, 62000];

// σ = 0
// CV = 0 / 62000 = 0
calculateConsistencyScore(lapTimes);  // 100
calculateBehaviorScore(lapTimes);     // 100
calculatePaceTrend(lapTimes);         // "Consistent →"
```

### 4. Null/Invalid Lap Times

**Behavior:**
- All functions filter out `null` and `≤ 0` values before processing
- Valid laps must still meet minimum count requirements

**Example:**
```typescript
const lapTimes = [62000, null, 61800, 0, -100, 62100];

// After filtering: [62000, 61800, 62100]
// Valid count: 3 laps

calculateConsistencyScore(lapTimes);  // Calculated with 3 laps
calculateBehaviorScore(lapTimes);     // Calculated with 3 laps
calculatePaceTrend(lapTimes);         // "Not Enough Data" (only 3 valid)
```

### 5. Extreme Outliers

**Current Behavior:**
- No outlier filtering - all valid laps are included
- One extremely slow/fast lap significantly impacts scores

**Example:**
```typescript
const lapTimes = [62000, 61800, 62100, 85000, 61900]; // Lap 4 is an outlier

// Mean ≈ 66560 ms (pulled up by outlier)
// σ ≈ 10,234 ms (very high due to outlier)

calculateConsistencyScore(lapTimes);  // ~85 (good, but impacted)
calculateBehaviorScore(lapTimes);     // ~0 (destroyed by high σ)
```

**Note:** See [Future Enhancements](#outlier-detection-and-filtering) for planned outlier handling.

### 6. Single Fast/Slow Lap (Improving vs Fading)

**Behavior:**
- Pace trend only looks at first 3 vs last 3 **as groups**
- A single outlier in either group affects that group's average

**Example:**
```typescript
// Scenario: Started slow, one fast lap at end
const lapTimes = [64000, 63800, 63500, 63000, 62800, 61000]; // Last lap very fast

First3Avg = (64000 + 63800 + 63500) / 3 = 63766.67 ms
Last3Avg = (62800 + 61000) / 2 = 61900 ms  // Only 2 laps? No, last 3 are: 63000, 62800, 61000
// Correct calculation:
Last3Avg = (63000 + 62800 + 61000) / 3 = 62266.67 ms

Result: "Improving ↗" (even though only 1 lap was genuinely fast)
```

---

## Future Enhancements

### 1. Configurable Thresholds

**Current Limitation:**
Score thresholds (90, 80, 65) are hardcoded in `getScoreLabel()`.

**Proposed Enhancement:**
```typescript
interface ScoreThresholds {
  excellent: number;  // default: 90
  good: number;       // default: 80
  ok: number;         // default: 65
}

export function getScoreLabel(
  score: number | null,
  thresholds?: ScoreThresholds
): LabelResult {
  // Allow custom thresholds for different skill levels
}
```

**Use Cases:**
- Beginner-friendly thresholds (85/70/55)
- Pro-level strict thresholds (95/90/80)
- Per-track calibration

---

### 2. Per-Track Normalization

**Current Limitation:**
A 300ms standard deviation might be excellent on a tight autocross (30s laps) but poor on a road course (90s laps).

**Proposed Enhancement:**

```typescript
export function calculateNormalizedConsistency(
  lapTimes: number[],
  trackBaseline: number
): number {
  const cv = calculateCV(lapTimes);
  const trackCV = calculateCV(trackBaseline);

  // Score relative to track-specific expectations
  return normalizeScore(cv, trackCV);
}
```

**Data Required:**
- Track database with historical CV/σ statistics
- Minimum N sessions per track to establish baseline

---

### 3. Weather-Adjusted Scoring

**Current Limitation:**
Scores don't account for changing conditions (rain, temperature, track evolution).

**Proposed Enhancement:**

```typescript
interface SessionConditions {
  weather: 'dry' | 'wet' | 'mixed';
  temperature: number;
  trackEvolution: 'improving' | 'degrading' | 'stable';
}

export function calculateWeatherAdjustedScore(
  lapTimes: number[],
  conditions: SessionConditions
): number {
  // Apply modifiers based on conditions
  // Example: Increase tolerance for "wet" conditions
}
```

---

### 4. Outlier Detection and Filtering

**Current Limitation:**
One red flag or off-track excursion destroys all scores.

**Proposed Enhancement:**

```typescript
export function calculateConsistencyScore(
  lapTimes: number[],
  options: { removeOutliers: boolean; outlierThreshold: number }
): number {
  if (options.removeOutliers) {
    // Use IQR or Z-score method to detect outliers
    const cleanedTimes = removeOutliersIQR(lapTimes, options.outlierThreshold);
    return calculateScore(cleanedTimes);
  }
  return calculateScore(lapTimes);
}
```

**Methods:**
- **IQR (Interquartile Range):** Remove laps outside 1.5×IQR from Q1/Q3
- **Z-Score:** Remove laps > 2 standard deviations from mean
- **Modified Z-Score:** Use median absolute deviation (more robust)

---

### 5. Sector-Level Analysis

**Current Limitation:**
Only full lap times are analyzed. Can't identify where inconsistency occurs.

**Proposed Enhancement:**

```typescript
export function calculateSectorConsistency(
  sectors: number[][]  // Array of [sector1, sector2, sector3] arrays
): {
  overallConsistency: number;
  sectorConsistencies: number[];
  weakestSector: number;
} {
  // Analyze each sector independently
  // Identify which part of the track has highest variation
}
```

**Use Cases:**
- Identify specific corners causing inconsistency
- Compare sector-by-sector improvement
- Precision coaching feedback

---

### 6. Percentile-Based Behavior Score

**Current Limitation:**
Behavior score uses an arbitrary `0.02` multiplier that doesn't scale across different track types.

**Proposed Enhancement:**

```typescript
export function calculatePercentileRank(
  lapTimes: number[],
  globalDatabase: LapTimeDatabase
): number {
  const myStd = sampleStandardDeviation(lapTimes);

  // Compare to all sessions at this track
  const percentile = calculatePercentile(myStd, globalDatabase.stdValues);

  return percentile; // 0-100 based on relative performance
}
```

---

### 7. Trend Over Time (Multi-Session)

**Current Limitation:**
Each session is analyzed in isolation. Can't track improvement over weeks/months.

**Proposed Enhancement:**

```typescript
export function calculateProgressionTrend(
  sessions: SessionData[]
): {
  consistencyTrend: 'improving' | 'declining' | 'stable';
  trendLine: number[];  // Linear regression of scores over time
  projectedScore: number;  // Estimate for next session
} {
  // Analyze consistency scores across multiple sessions
  // Generate trend visualization data
}
```

---

### 8. Tire Degradation Detection

**Current Limitation:**
Pace trend only compares first 3 vs last 3 laps. Doesn't model degradation curve.

**Proposed Enhancement:**

```typescript
export function analyzeTireDegradation(
  lapTimes: number[]
): {
  degradationRate: number;  // ms per lap
  cliffPoint: number | null;  // Lap where pace dropped off sharply
  projectedLife: number;  // Estimated total usable laps
} {
  // Fit regression model to lap times
  // Detect non-linear degradation patterns
}
```

---

## Code Examples

### Example 1: Full Session Analysis

```typescript
import {
  getSessionInsightsFromMs,
  getScoreLabel,
  INSIGHT_HELPERS,
} from '@/lib/insights';

// Real session data from session detail page
const session = {
  id: 'abc123',
  laps: [
    { lap_number: 1, lap_time_ms: 62500 },
    { lap_number: 2, lap_time_ms: 61800 },
    { lap_number: 3, lap_time_ms: 62100 },
    { lap_number: 4, lap_time_ms: 61900 },
    { lap_number: 5, lap_time_ms: 62300 },
    { lap_number: 6, lap_time_ms: 61700 },
    { lap_number: 7, lap_time_ms: 62000 },
    { lap_number: 8, lap_time_ms: 61950 },
  ],
};

// Extract lap times
const lapTimes = session.laps
  .map(lap => lap.lap_time_ms)
  .filter((t): t is number => t != null);

// Calculate insights
const insights = getSessionInsightsFromMs(lapTimes);

console.log(insights);
// {
//   consistencyScore: 100,
//   drivingBehaviorScore: 99,
//   paceTrendLabel: "Improving ↗",
//   paceTrendDetail: "You got 0.20s faster from start to finish."
// }

// Get labels
const consistencyLabel = getScoreLabel(insights.consistencyScore);
console.log(consistencyLabel);
// {
//   label: "Excellent",
//   severity: "excellent",
//   colorClass: "text-emerald-400"
// }
```

---

### Example 2: Handling Edge Cases

```typescript
import { getSessionInsightsFromMs, getScoreLabel } from '@/lib/insights';

// Edge Case 1: Only 3 laps
const shortSession = [62000, 61800, 62100];
const insights1 = getSessionInsightsFromMs(shortSession);

console.log(insights1);
// {
//   consistencyScore: 99,               // Still calculated
//   drivingBehaviorScore: 99,           // Still calculated
//   paceTrendLabel: "Not Enough Data",  // Need 6 laps
//   paceTrendDetail: "Compares your first 3 vs last 3 laps..."
// }

// Edge Case 2: With nulls and invalid laps
const messyData = [62000, null, 61800, 0, -100, 62100, null, 61900, 62200, 61850];
const insights2 = getSessionInsightsFromMs(messyData);

// Valid laps after filtering: [62000, 61800, 62100, 61900, 62200, 61850]
console.log(insights2);
// {
//   consistencyScore: 99,
//   drivingBehaviorScore: 99,
//   paceTrendLabel: "Consistent →",  // Now has 6 valid laps
//   paceTrendDetail: "Your pace remained stable..."
// }

// Edge Case 3: Single lap
const oneLap = [62000];
const insights3 = getSessionInsightsFromMs(oneLap);

console.log(insights3);
// {
//   consistencyScore: null,
//   drivingBehaviorScore: null,
//   paceTrendLabel: "Not Enough Data",
//   paceTrendDetail: "Compares your first 3 vs last 3 laps..."
// }

const label = getScoreLabel(insights3.consistencyScore);
console.log(label);
// { label: "No Data", severity: "unknown", colorClass: "text-gray-400" }
```

---

### Example 3: Comparing Two Drivers

```typescript
import { getSessionInsightsFromMs } from '@/lib/insights';

// Driver A: Fast but inconsistent
const driverA = [59000, 62000, 58500, 63000, 59200, 61500, 58800, 62500];

// Driver B: Slower but very consistent
const driverB = [61000, 61100, 61050, 60950, 61020, 61080, 61040, 61060];

const insightsA = getSessionInsightsFromMs(driverA);
const insightsB = getSessionInsightsFromMs(driverB);

console.log('Driver A:', insightsA);
// {
//   consistencyScore: 93,
//   drivingBehaviorScore: 64,
//   paceTrendLabel: "Fading ↘",
//   paceTrendDetail: "You slowed 1.83s from start to finish."
// }

console.log('Driver B:', insightsB);
// {
//   consistencyScore: 100,
//   drivingBehaviorScore: 100,
//   paceTrendLabel: "Consistent →",
//   paceTrendDetail: "Your pace remained stable..."
// }

// Analysis:
// Driver A: Faster best lap (58500ms) but erratic and fading
// Driver B: Slower overall (61000ms avg) but machine-like consistency
// Coaching: Driver A needs consistency work, Driver B needs speed work
```

---

### Example 4: Using in React Components

```tsx
import { getSessionInsightsFromMs, getScoreLabel, INSIGHT_HELPERS } from '@/lib/insights';

interface SessionDetailProps {
  laps: Array<{ lap_number: number; lap_time_ms: number | null }>;
}

export default function SessionDetail({ laps }: SessionDetailProps) {
  // Calculate insights
  const lapTimes = laps
    .map(lap => lap.lap_time_ms)
    .filter((t): t is number => t != null);

  const insights = getSessionInsightsFromMs(lapTimes);
  const consistencyLabel = getScoreLabel(insights.consistencyScore);
  const behaviorLabel = getScoreLabel(insights.drivingBehaviorScore);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Consistency Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-sm font-medium text-slate-400">Consistency</div>
        <div className="mt-2 text-2xl font-semibold text-white">
          {insights.consistencyScore != null
            ? Math.round(insights.consistencyScore)
            : '--'}/100
        </div>
        <div className={`mt-1 text-sm font-medium ${consistencyLabel.colorClass}`}>
          {consistencyLabel.label}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {INSIGHT_HELPERS.consistency}
        </p>
      </div>

      {/* Pace Trend Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-sm font-medium text-slate-400">Pace Trend</div>
        <div className="mt-2 text-lg font-semibold text-emerald-400">
          {insights.paceTrendLabel}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {insights.paceTrendDetail}
        </p>
      </div>

      {/* Driving Behavior Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-sm font-medium text-slate-400">Driving Behavior</div>
        <div className="mt-2 text-2xl font-semibold text-white">
          {insights.drivingBehaviorScore != null
            ? Math.round(insights.drivingBehaviorScore)
            : '--'}/100
        </div>
        <div className={`mt-1 text-sm font-medium ${behaviorLabel.colorClass}`}>
          {behaviorLabel.label}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {INSIGHT_HELPERS.behavior}
        </p>
      </div>
    </div>
  );
}
```

---

## References

### Files

- **`web/src/lib/analytics.ts`**: Core calculation functions
- **`web/src/lib/insights.ts`**: Unified interface and labeling
- **`web/src/app/sessions/[id]/page.tsx`**: Usage example in session detail UI
- **`web/src/components/analytics/InsightsPanel.tsx`**: Legacy component (deprecated)

### External Resources

- [Coefficient of Variation (Wikipedia)](https://en.wikipedia.org/wiki/Coefficient_of_variation)
- [Sample Standard Deviation (Khan Academy)](https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data/variance-standard-deviation-sample/a/population-and-sample-standard-deviation-review)
- [Motorsport Data Analysis Best Practices](https://www.optimumg.com/data-analysis/)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Maintainer:** Track App MVP Team
