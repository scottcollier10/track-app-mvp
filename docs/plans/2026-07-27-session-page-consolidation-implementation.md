# Session Page Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. UI/layout tasks (6, 7) also use the **frontend-design** skill. Design doc: `docs/plans/2026-07-27-session-page-consolidation-design.md` — read it first; its decisions are settled, do not reopen them.

**Goal:** Merge `/sessions/[id]` and `/sessions/[id]/analysis` into one page (chart + table global, Insights|Patterns tabs) while replacing all `/100` composite metrics with honest ±seconds values from analytics-v2 (absorbs issue #25).

**Architecture:** All lib changes flow from one source of truth: `sessionConsistencySeconds` in `web/src/lib/analytics-v2.ts` (sample std-dev of clean laps, in seconds). `lib/insights.ts` re-exposes it for the page and AI prompt; `driver-progress.ts` uses it for progress summaries; the chart receives σ as a prop instead of computing its own. The merged server page computes everything once and passes down; a small client `Tabs` component holds the two lenses. `/analysis` becomes a redirect.

**Tech Stack:** Next.js 14.1 (App Router, sync `params`), React 18, Recharts, Jest 29 (+ RTL, jsdom available via docblock), TypeScript.

**Working directory:** `/Users/scottcollier/dev/track-app-mvp/.worktrees/session-consolidation/web` (branch `feat/session-page-consolidation` off main @ bd1ed27, baseline 141/141 tests green).

**Run tests with:** `npm test` (all), `npm test -- --testPathPattern=insights` (one suite). Build gate: `npm run build`.

**Constraints (from design doc):**
- Students/instructor language in new copy (never "drivers"/"coach").
- No `/100` composites anywhere when done.
- No new dependencies.
- Full `npm test` green at every commit.

---

## Task 1: `lib/insights.ts` → honest metrics (+ coaching prompt, same commit)

The coaching route is the only non-test consumer of `insights.getScoreLabel` and `drivingBehaviorScore`, so it must change in the same commit or the build breaks.

**Files:**
- Modify: `web/src/lib/insights.ts`
- Modify: `web/src/lib/__tests__/insights.test.ts`
- Modify: `web/src/app/api/coaching/generate/route.ts:12,116-117,127-128,156-158`

**Step 1: Rewrite the test file**

Replace the entire contents of `web/src/lib/__tests__/insights.test.ts` with:

```ts
/**
 * Tests for session insights calculations (honest metrics: std-dev seconds, no /100 composites)
 */

import {
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
  MIN_LAPS_FOR_INSIGHTS,
} from '../insights';

describe('MIN_LAPS_FOR_INSIGHTS', () => {
  it('is 6 — the single gate for the interpretive layer', () => {
    expect(MIN_LAPS_FOR_INSIGHTS).toBe(6);
  });
});

describe('getSessionInsightsFromMs', () => {
  describe('consistency (std-dev seconds)', () => {
    it('returns 0 for identical lap times', () => {
      const result = getSessionInsightsFromMs([90000, 90000, 90000, 90000, 90000, 90000]);
      expect(result.consistencySeconds).toBe(0);
    });

    it('returns sample std-dev in seconds for a normal 8-lap session', () => {
      const lapTimes = [92000, 91500, 90800, 91200, 90500, 91800, 90200, 90900];
      const result = getSessionInsightsFromMs(lapTimes);
      // sample std-dev of these values is ~0.63s
      expect(result.consistencySeconds).not.toBeNull();
      expect(result.consistencySeconds!).toBeGreaterThan(0.3);
      expect(result.consistencySeconds!).toBeLessThan(1.0);
    });

    it('filters outlier laps (>1.25x median) before computing spread', () => {
      // 180000 is a pit/out lap — clean-lap filter must drop it
      const withOutlier = getSessionInsightsFromMs([
        90000, 90500, 91000, 180000, 90200, 90800, 91200, 90600,
      ]);
      const without = getSessionInsightsFromMs([
        90000, 90500, 91000, 90200, 90800, 91200, 90600,
      ]);
      expect(withOutlier.consistencySeconds).toBeCloseTo(without.consistencySeconds!, 3);
    });

    it('returns null with fewer than 2 valid laps', () => {
      expect(getSessionInsightsFromMs([]).consistencySeconds).toBeNull();
      expect(getSessionInsightsFromMs([90000]).consistencySeconds).toBeNull();
    });

    it('ignores null, undefined, zero and negative values', () => {
      const result = getSessionInsightsFromMs([
        90000, null as any, 0, -100, undefined as any, 91000, 90500,
      ]);
      expect(result.consistencySeconds).not.toBeNull();
      expect(result.consistencySeconds!).toBeGreaterThan(0);
    });
  });

  describe('pace trend (unchanged behavior)', () => {
    it('detects improving pace (first 3 > last 3)', () => {
      const result = getSessionInsightsFromMs([
        95000, 94000, 93000, 92000, 91000, 90000, 91500, 90500,
      ]);
      expect(result.paceTrendLabel).toBe('improving');
      expect(result.paceTrendDetail).toContain('faster');
    });

    it('detects fading pace (first 3 < last 3)', () => {
      const result = getSessionInsightsFromMs([
        90000, 91000, 90500, 92000, 93000, 94000, 92500, 93500,
      ]);
      expect(result.paceTrendLabel).toBe('fading');
      expect(result.paceTrendDetail).toContain('slowed');
    });

    it('treats <1% delta as stable', () => {
      const result = getSessionInsightsFromMs([
        90100, 90000, 90200, 89900, 90000, 89800,
      ]);
      expect(result.paceTrendLabel).toBe('stable');
      expect(result.paceTrendDetail).toContain('stable');
    });

    it('calculates the correct time difference for improving pace', () => {
      const result = getSessionInsightsFromMs([
        95000, 94000, 93000, 92000, 91000, 90000,
      ]);
      expect(result.paceTrendDetail).toContain('3.00s');
    });

    it('reports not enough data under 6 laps', () => {
      const result = getSessionInsightsFromMs([90000, 91000, 90500, 91500, 90200]);
      expect(result.paceTrendLabel).toBe('Not enough data');
      expect(result.paceTrendDetail).toContain('at least 6 laps');
    });
  });

  it('exposes no /100 composite fields', () => {
    const result = getSessionInsightsFromMs([90000, 91000, 90500, 91500, 90200, 90700]);
    expect(result).not.toHaveProperty('consistencyScore');
    expect(result).not.toHaveProperty('drivingBehaviorScore');
  });
});

describe('INSIGHT_HELPERS', () => {
  it('has consistency and paceTrend helpers only (behavior removed)', () => {
    expect(INSIGHT_HELPERS.consistency.length).toBeGreaterThan(0);
    expect(INSIGHT_HELPERS.paceTrend.length).toBeGreaterThan(0);
    expect(INSIGHT_HELPERS).not.toHaveProperty('behavior');
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- --testPathPattern=insights`
Expected: FAIL — `MIN_LAPS_FOR_INSIGHTS` not exported, `consistencySeconds` undefined.

**Step 3: Rewrite `web/src/lib/insights.ts`**

Replace the entire file with:

```ts
/**
 * Session Insights - Centralized Analytics Helpers
 *
 * Honest metrics only: consistency is the sample std-dev of clean lap times in
 * SECONDS (from analytics-v2), never a /100 composite.
 */

import { calculatePaceTrend } from './analytics';
import { sessionConsistencySeconds } from './analytics-v2';

/** Single lap-count gate for the interpretive layer (insight tabs + AI coaching). */
export const MIN_LAPS_FOR_INSIGHTS = 6;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get session insights from millisecond lap times
 *
 * @param lapTimesMs - Array of lap times in milliseconds
 * @returns consistency (±seconds, null if <2 clean laps) and pace trend
 */
export function getSessionInsightsFromMs(lapTimesMs: number[]): {
  consistencySeconds: number | null;
  paceTrendLabel: string;
  paceTrendDetail: string;
} {
  const validLapTimes = lapTimesMs.filter(t => t != null && t > 0);

  const consistencySeconds = sessionConsistencySeconds(lapTimesMs);
  const paceTrendLabel = calculatePaceTrend(lapTimesMs);

  // Generate detailed pace trend description
  let paceTrendDetail = '';
  if (validLapTimes.length >= 6 && paceTrendLabel) {
    const first3 = average(validLapTimes.slice(0, 3));
    const last3 = average(validLapTimes.slice(-3));
    const diffMs = last3 - first3;
    const diffSec = Math.abs(diffMs / 1000);

    if (paceTrendLabel === 'improving') {
      paceTrendDetail = `You got ${diffSec.toFixed(2)}s faster from start to finish.`;
    } else if (paceTrendLabel === 'fading') {
      paceTrendDetail = `You slowed ${diffSec.toFixed(2)}s from start to finish.`;
    } else {
      paceTrendDetail = `Your pace remained stable throughout the session.`;
    }
  } else {
    paceTrendDetail = 'Not enough laps to show a trend. Pace trend needs at least 6 laps.';
  }

  return {
    consistencySeconds,
    paceTrendLabel: paceTrendLabel || 'Not enough data',
    paceTrendDetail,
  };
}

/**
 * Tooltip descriptions for each insight metric
 */
export const INSIGHT_HELPERS = {
  consistency: 'Spread of your clean lap times in seconds. Lower means tighter, more repeatable laps.',
  paceTrend: 'Compares your first 3 vs last 3 laps to show improvement or fade.',
};
```

Deleted: `getScoreLabel`, `drivingBehaviorScore`, `INSIGHT_HELPERS.behavior`, imports of `calculateConsistencyScore`/`calculateBehaviorScore`.

**Step 4: Update the coaching route**

In `web/src/app/api/coaching/generate/route.ts`:

Change line 12 from:
```ts
import { getSessionInsightsFromMs, getScoreLabel } from '@/lib/insights';
```
to:
```ts
import { getSessionInsightsFromMs } from '@/lib/insights';
```

Change lines 115-117 from:
```ts
    const insights = getSessionInsightsFromMs(lapTimesMs);
    const consistencyLabel = getScoreLabel(insights.consistencyScore);
    const behaviorLabel = getScoreLabel(insights.drivingBehaviorScore);
```
to:
```ts
    const insights = getSessionInsightsFromMs(lapTimesMs);
```

Change lines 127-129 from:
```ts
    const consistencyScore = insights.consistencyScore ?? 0;
    const behaviorScore = insights.drivingBehaviorScore ?? 0;
    const paceTrend = insights.paceTrendLabel;
```
to:
```ts
    const consistencyText =
      insights.consistencySeconds !== null
        ? `±${insights.consistencySeconds.toFixed(1)}s lap-time spread (std-dev of clean laps; lower is tighter)`
        : 'not enough clean laps to measure';
    const paceTrend = insights.paceTrendLabel;
```

Change the PERFORMANCE METRICS block (lines 155-158) from:
```
PERFORMANCE METRICS
- Consistency Score: ${consistencyScore}/100 (${consistencyLabel.label})
- Pace Trend: ${paceTrend}
- Driving Behavior: ${behaviorScore}/100 (${behaviorLabel.label})
```
to:
```
PERFORMANCE METRICS
- Consistency: ${consistencyText}
- Pace Trend: ${paceTrend}
```

**Step 5: Run tests and type-check**

Run: `npm test -- --testPathPattern=insights`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: errors ONLY in `sessions/[id]/page.tsx` (still references `drivingBehaviorScore`/`consistencyScore` — fixed in Task 7). If `npx tsc --noEmit` is too noisy to be useful here, rely on `npm test` now and the full build in Task 10; do not commit route changes that fail tests.

Note: full `npm test` must still pass — the session page is not under test, so the suite stays green.

**Step 6: Commit**

```bash
git add src/lib/insights.ts src/lib/__tests__/insights.test.ts src/app/api/coaching/generate/route.ts
git commit -m "feat(insights): consistency as std-dev seconds; drop /100 composites from insights + AI prompt"
```

---

## Task 2: `driver-progress.ts` + `driver-progress-view.tsx` → seconds

**Files:**
- Modify: `web/src/lib/queries/driver-progress.ts:8,20,185,208,297` (+ delta type)
- Modify: `web/src/components/driver-progress-view.tsx:82-98`
- Modify: `web/src/lib/queries/README.md:44` (doc drift)

**Step 1: Update `driver-progress.ts`**

Line 8, change:
```ts
import { calculateConsistencyScore, calculatePaceTrend } from '@/lib/analytics';
```
to:
```ts
import { calculatePaceTrend } from '@/lib/analytics';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
```

In the `SessionSummary` interface (line ~20), change:
```ts
  consistencyScore: number; // 0-100
```
to:
```ts
  consistencySeconds: number | null; // std-dev of clean laps, seconds (lower = tighter)
```

Find the `delta` field type in the same interface (search for `delta`) and change its `consistency: number` to `consistency: number | null`.

In `createSessionSummary` (line ~185), change:
```ts
  const consistencyScore = calculateConsistencyScore(lapTimes) || 0;
```
to:
```ts
  const consistencySeconds = sessionConsistencySeconds(lapTimes);
```
and in the returned object (line ~208) change `consistencyScore,` to `consistencySeconds,`.

In `calculateDeltas` (line ~297), change:
```ts
        consistency: session.consistencyScore - previousSession.consistencyScore
```
to:
```ts
        consistency:
          session.consistencySeconds !== null && previousSession.consistencySeconds !== null
            ? session.consistencySeconds - previousSession.consistencySeconds
            : null
```

**Step 2: Update `driver-progress-view.tsx` (lines 82-98)**

Replace the Consistency block with (note: for seconds, LOWER is better — delta colors flip vs the old score):

```tsx
      {/* Consistency */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          Consistency
        </p>
        <p className="text-xl font-semibold text-slate-200">
          {session.consistencySeconds !== null
            ? `±${session.consistencySeconds.toFixed(1)}s`
            : '—'}
        </p>
        {showDelta && session.delta && session.delta.consistency !== null && (
          <p className={`text-sm font-medium mt-1 ${
            session.delta.consistency < 0 ? 'text-green-400' : session.delta.consistency > 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {session.delta.consistency < 0 ? '↓' : session.delta.consistency > 0 ? '↑' : '→'}
            {session.delta.consistency > 0 ? '+' : ''}{session.delta.consistency.toFixed(1)}s
          </p>
        )}
      </div>
```

**Step 3: Update `README.md`**

In `web/src/lib/queries/README.md` line 44, change `consistencyScore: number; // 0-100` to `consistencySeconds: number | null; // std-dev seconds, lower = tighter`.

**Step 4: Verify**

Run: `npm test`
Expected: PASS (141+ tests — no suite covers driver-progress, but full suite must stay green).
Grep check: `git grep -n consistencyScore -- src/lib/queries src/components/driver-progress-view.tsx` → no hits.

**Step 5: Commit**

```bash
git add src/lib/queries/driver-progress.ts src/components/driver-progress-view.tsx src/lib/queries/README.md
git commit -m "feat(progress): consistency in ±seconds for progress summaries (was /100)"
```

---

## Task 3: `SessionPatterns` — seconds dialect copy

**Files:**
- Modify: `web/src/components/analytics/SessionPatterns.tsx:13-16,115-132`

**Step 1: Add the prop**

Change the props interface (lines 13-16) to:

```ts
interface SessionPatternsProps {
  laps: Lap[];
  bestLapTime: number;
  /** Session std-dev in seconds from analytics-v2 (single σ source for the page). Display only. */
  consistencySeconds: number | null;
}
```

and the signature to:
```ts
export default function SessionPatterns({ laps, bestLapTime, consistencySeconds }: SessionPatternsProps) {
```

**Step 2: Reword the Exceptional Consistency description (lines 122-132)**

Detection logic (coefficient of variation < 2%, computed inline) stays EXACTLY as is. Only the user-facing string changes:

```ts
  if (coefficientOfVariation < 2) {
    patterns.push({
      type: 'consistent',
      title: 'Exceptional Consistency',
      description:
        consistencySeconds !== null
          ? `Lap times stayed within ±${consistencySeconds.toFixed(1)}s, showing excellent pace control throughout the session`
          : 'Lap times stayed remarkably tight, showing excellent pace control throughout the session',
      icon: Info,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      laps: 'All laps',
    });
  }
```

Leave the other three patterns' copy alone (they describe % deltas between phases, not consistency). Leave the Pattern Analysis explainer footer alone — it contains no drivers/coach language and no % consistency claim.

**Step 3: Verify + commit**

`npm test` → PASS. The old `/analysis` page still calls `<SessionPatterns laps={laps} bestLapTime={bestLapTime} />` — TypeScript now requires the new prop, so ALSO update that call site in `web/src/app/sessions/[id]/analysis/page.tsx:107` to pass `consistencySeconds={null}` (temporary — this page becomes a redirect in Task 8; `null` keeps the fallback copy).

Actually, simpler and still correct: compute it there in one line since `stdDev` already exists on that page — but that's population σ. Use `consistencySeconds={null}`. Do not overthink a file that dies in Task 8.

```bash
git add src/components/analytics/SessionPatterns.tsx "src/app/sessions/[id]/analysis/page.tsx"
git commit -m "feat(patterns): consistency copy in ±seconds dialect (detection unchanged)"
```

---

## Task 4: `LapAnalysisChart` — σ from props, optional band

**Files:**
- Modify: `web/src/components/charts/LapAnalysisChart.tsx:18-31,173-187,225-228`

**Step 1: Make band data optional**

Change the interfaces (lines 18-31) to:

```ts
interface ChartDataPoint {
  lap: number;
  time: number; // in seconds
  timeMs: number;
  isBest: boolean;
  upperBand?: number;
  lowerBand?: number;
}

interface LapAnalysisChartProps {
  data: ChartDataPoint[];
  bestLapTime: number;
  /** Session std-dev in seconds (analytics-v2). Null = not enough clean laps; band hidden. */
  stdDev: number | null;
}
```

**Step 2: Render band conditionally**

Wrap the two `<Area>` elements (lines 173-187) in `{stdDev !== null && (<>...</>)}`.

Wrap the band legend item (lines 225-228, the `Consistency Band (±1σ)` div) in `{stdDev !== null && (...)}`.

Everything else (dots, tooltip, reference line, axes) unchanged. The chart itself computes NO statistics — σ and band values arrive from the page.

**Step 3: Verify + commit**

The old `/analysis` page (dies in Task 8) already passes `stdDev={stdDev / 1000}` — a `number`, assignable to `number | null`. No call-site change needed.

`npm test` → PASS. Then:

```bash
git add src/components/charts/LapAnalysisChart.tsx
git commit -m "refactor(chart): consistency band driven by analytics-v2 sigma prop; band optional"
```

---

## Task 5: `Tabs` client component (TDD)

Generic, tiny, reusable. Server page renders tab contents; this only switches visibility.

**Files:**
- Create: `web/src/components/ui/Tabs.tsx`
- Create: `web/src/components/ui/__tests__/Tabs.test.tsx`

**Step 1: Write the failing test**

Create `web/src/components/ui/__tests__/Tabs.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tabs } from '../Tabs';

const tabs = [
  { id: 'insights', label: 'Session Insights', content: <div>insights body</div> },
  { id: 'patterns', label: 'Session Patterns', content: <div>patterns body</div> },
];

describe('Tabs', () => {
  it('renders all tab labels and the first tab content by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Session Patterns' })).toBeInTheDocument();
    expect(screen.getByText('insights body')).toBeInTheDocument();
    expect(screen.queryByText('patterns body')).not.toBeInTheDocument();
  });

  it('switches content on tab click', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Session Patterns' }));
    expect(screen.getByText('patterns body')).toBeInTheDocument();
    expect(screen.queryByText('insights body')).not.toBeInTheDocument();
  });

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Session Patterns' }));
    expect(screen.getByRole('tab', { name: 'Session Patterns' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Session Insights' })).toHaveAttribute('aria-selected', 'false');
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- --testPathPattern=Tabs`
Expected: FAIL — module `../Tabs` not found. (If jest chokes on JSX/jsdom config instead, fix jest config per its error before proceeding — RTL and jest-environment-jsdom are already in devDependencies.)

**Step 3: Implement `web/src/components/ui/Tabs.tsx`**

Use the **frontend-design** skill for styling judgment; match the app's existing dark-surface design tokens (`text-primary`, `text-muted`, `border-subtle`, `accent-primary` as used in `sessions/[id]/page.tsx`). Baseline implementation:

```tsx
'use client';

import { useState, type ReactNode } from 'react';

interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabDef[];
}

export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-subtle mb-6">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-accent-primary text-primary'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div role="tabpanel" id={`tabpanel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
          {active.content}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npm test -- --testPathPattern=Tabs` → PASS, then `npm test` → all green.

**Step 5: Commit**

```bash
git add src/components/ui/Tabs.tsx src/components/ui/__tests__/Tabs.test.tsx
git commit -m "feat(ui): accessible client Tabs component for session page lenses"
```

---

## Task 6: Merged session page

Use the **frontend-design** skill. This is the big one — full rewrite of `web/src/app/sessions/[id]/page.tsx` to the validated layout: header → 4 stats → chart → table → tabs (≥6 laps) → AI coaching (≥6) → notes.

**Files:**
- Modify: `web/src/app/sessions/[id]/page.tsx` (full rewrite below)

**Step 1: Rewrite the page**

```tsx
import { getSessionWithLaps } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { notFound } from 'next/navigation';
import AddNoteForm from '@/components/ui/AddNoteForm';
import CoachNotes from '@/components/ui/CoachNotes';
import Sparkline from '@/components/analytics/Sparkline';
import Link from 'next/link';
import {
  getSessionInsightsFromMs,
  INSIGHT_HELPERS,
  MIN_LAPS_FOR_INSIGHTS,
} from '@/lib/insights';
import { cleanLaps } from '@/lib/analytics-v2';
import EmptyInsights from '@/components/analytics/EmptyInsights';
import AICoachingCard from '@/components/coaching/AICoachingCard';
import LapAnalysisChart from '@/components/charts/LapAnalysisChart';
import LapAnalysisTable from '@/components/analytics/LapAnalysisTable';
import SessionPatterns from '@/components/analytics/SessionPatterns';
import { Tabs } from '@/components/ui/Tabs';
import ShareSessionButton from '@/components/ui/ShareSessionButton';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { MapPin, ArrowLeft } from 'lucide-react';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { data: session, error } = await getSessionWithLaps(params.id);

  // Error state — keep the existing error Card block from the current file, verbatim.
  if (error) {
    /* ... keep current lines 38-63 unchanged ... */
  }

  if (!session) {
    notFound();
  }

  const laps = session.laps || [];

  // ---- One pass of honest statistics for the whole page ----
  const lapTimes = laps.map(lap => lap.lap_time_ms).filter((t): t is number => t != null && t > 0);
  const insights = getSessionInsightsFromMs(lapTimes);
  const consistencySeconds = insights.consistencySeconds;

  const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : null;
  const slowestLapMs = lapTimes.length > 0 ? Math.max(...lapTimes) : null;
  const avgLapMs = lapTimes.length > 0
    ? lapTimes.reduce((sum, t) => sum + t, 0) / lapTimes.length
    : null;

  // Band centre = clean-lap mean, width = analytics-v2 sigma (same number as the Consistency card)
  const clean = cleanLaps(lapTimes);
  const cleanMeanS = clean.length > 0
    ? clean.reduce((s, t) => s + t, 0) / clean.length / 1000
    : null;

  const chartData = laps.map((lap) => ({
    lap: lap.lap_number,
    time: lap.lap_time_ms / 1000,
    timeMs: lap.lap_time_ms,
    isBest: lap.lap_time_ms === bestLapMs,
    ...(consistencySeconds !== null && cleanMeanS !== null
      ? {
          upperBand: cleanMeanS + consistencySeconds,
          lowerBand: cleanMeanS - consistencySeconds,
        }
      : {}),
  }));

  const showInsights = laps.length >= MIN_LAPS_FOR_INSIGHTS;

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="space-y-8">
          {/* Header — keep current header block (lines 88-115) verbatim, EXCEPT:
              there is no analysis link to preserve; nothing else changes. */}

          {/* Summary Stats — now 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <MetricCard
              label="Total Time"
              value={formatDurationMs(session.total_time_ms)}
              helper="Session duration"
            />
            <MetricCard
              label="Best Lap"
              value={session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
              helper="Fastest lap time"
            />
            <MetricCard
              label="Average Lap"
              value={avgLapMs !== null ? formatLapMs(avgLapMs) : '--'}
              helper="Average across all laps"
            />
            <MetricCard
              label="Laps"
              value={laps.length.toString()}
              helper="Total lap count"
            />
          </div>

          {/* Lap Time Progression — always visible when there are laps */}
          {laps.length > 0 && bestLapMs !== null && (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-primary">Lap Time Progression</h2>
                {consistencySeconds !== null && (
                  <p className="text-sm text-muted">
                    Performance over session with ±1σ consistency band
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <LapAnalysisChart
                  data={chartData}
                  bestLapTime={bestLapMs}
                  stdDev={consistencySeconds}
                />
              </CardContent>
            </Card>
          )}

          {/* Lap Details — always visible when there are laps */}
          {laps.length > 0 && bestLapMs !== null && slowestLapMs !== null ? (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-primary">Lap Details</h2>
              </CardHeader>
              <CardContent>
                <LapAnalysisTable
                  laps={laps}
                  bestLapTime={bestLapMs}
                  slowestLapTime={slowestLapMs}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="py-8 text-center">
              <p className="text-muted">No laps recorded for this session.</p>
            </Card>
          )}

          {/* Interpretive layer: tabs, gated at MIN_LAPS_FOR_INSIGHTS */}
          {laps.length > 0 && (
            showInsights ? (
              <Tabs
                tabs={[
                  {
                    id: 'insights',
                    label: 'Session Insights',
                    content: (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Consistency Card — honest ±seconds */}
                        <Card>
                          <div className="text-xs md:text-sm text-muted uppercase tracking-wide mb-2">
                            Consistency
                          </div>
                          <div className="text-lg font-semibold mb-1 text-primary">
                            {consistencySeconds !== null
                              ? `±${consistencySeconds.toFixed(1)}s`
                              : '--'}
                          </div>
                          <div className="text-xs text-text-subtle">
                            {INSIGHT_HELPERS.consistency}
                          </div>
                        </Card>

                        {/* Pace Trend Card with Sparkline — keep current markup (lines 162-176) verbatim,
                            reading from `insights.paceTrendLabel` / `insights.paceTrendDetail`. */}
                      </div>
                    ),
                  },
                  {
                    id: 'patterns',
                    label: 'Session Patterns',
                    content: (
                      <SessionPatterns
                        laps={laps}
                        bestLapTime={bestLapMs!}
                        consistencySeconds={consistencySeconds}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyInsights lapCount={laps.length} minimumRequired={MIN_LAPS_FOR_INSIGHTS} />
            )
          )}

          {/* AI Coaching — same gate as the tabs */}
          {showInsights && (
            <AICoachingCard
              sessionId={session.id}
              initialCoaching={session.ai_coaching_summary}
            />
          )}

          {/* Instructor Notes */}
          <CoachNotes sessionId={session.id} initialNotes={session.coach_notes} />
        </div>
      </div>
    </div>
  );
}
```

Implementation notes for this task:
- The `/* keep current ... verbatim */` blocks refer to the exact existing markup in the current file — copy them over unchanged. Deleted from the old page: `LapTimeChart` import + usage, `ScoreCard` import + both `/100` cards, `getScoreLabel`-era `insights` object shape, the "View Detailed Analysis →" link, the old plain laps table.
- Verify `LapAnalysisTable`'s prop names by reading `web/src/components/analytics/LapAnalysisTable.tsx` before wiring (expected: `laps`, `bestLapTime`, `slowestLapTime` — as called by the old analysis page).
- Check whether `AddNoteForm` was actually used in the old page body; if it was only imported, drop the import.
- Layout polish (spacing, tab styling in context, 4-card grid on mobile) is where frontend-design judgment applies — but keep the section ORDER exactly as the design doc specifies.

**Step 2: Verify**

Run: `npm test` → PASS.
Run: `npm run build` → must compile (this catches the TS fallout from Tasks 1-2 being fully resolved).
Run: `npm run dev`, then manually load a session page for a demo student (6+ laps): stats show 4 cards, chart has band, table shows fastest/slowest, both tabs render, coaching card renders, no `/100` anywhere. Load/craft a <6-lap session view to confirm the single empty state replaces tabs + coaching.

**Step 3: Commit**

```bash
git add "src/app/sessions/[id]/page.tsx"
git commit -m "feat(session): merged detail+analysis page — global data, Insights|Patterns tabs, honest metrics"
```

---

## Task 7: `/analysis` → redirect

**Files:**
- Modify: `web/src/app/sessions/[id]/analysis/page.tsx` (replace entire file)

**Step 1: Replace the file contents with**

```tsx
import { redirect } from 'next/navigation';

interface PageProps {
  params: {
    id: string;
  };
}

export default function SessionAnalysisPage({ params }: PageProps) {
  redirect(`/sessions/${params.id}`);
}
```

(Next 14.1 sync `params`, matching the rest of the app. All imports from the old file go away.)

**Step 2: Verify**

Run: `npm test` → PASS. Run: `npm run build` → compiles.
Manual: `npm run dev`, hit `/sessions/<demo-session-id>/analysis` → lands on `/sessions/<id>`.

**Step 3: Commit**

```bash
git add "src/app/sessions/[id]/analysis/page.tsx"
git commit -m "feat(session): retire /analysis route — permanent redirect to merged session page"
```

---

## Task 8: Dead-code sweep

Only delete what is now import-free. Verify each with grep BEFORE deleting.

**Files:**
- Modify: `web/src/lib/analytics.ts` (keep only `calculatePaceTrend`)
- Delete: `web/src/components/ui/scores/ScoreCard.tsx`
- Delete: `web/src/components/ui/scores/__examples__/ScoreExamples.tsx`
- Modify: `web/src/components/ui/scores/index.ts` (drop ScoreCard exports)
- Delete: `web/src/lib/analytics.backup.ts` (dead backup, grep first)
- Possibly delete: `web/src/components/charts/LapTimeChart.tsx` (grep first)

**Step 1: Grep for each candidate's importers**

```bash
git grep -nE "calculateConsistency|calculateConsistencyScore|calculateDrivingBehavior|calculateBehaviorScore" -- src
git grep -n "ScoreCard" -- src
git grep -n "analytics.backup" -- src
git grep -n "LapTimeChart" -- src
```

Expected after Tasks 1-7: the analytics composites have NO importers; `ScoreCard` only in `ui/scores` itself (+ examples); `LapTimeChart` has no importers (was only the old session page — if something else imports it, KEEP it and note why in the commit message); `analytics.backup.ts` has no importers.

**Step 2: Trim `analytics.ts`**

Delete `calculateConsistency`, `calculateConsistencyScore`, `calculateDrivingBehavior`, `calculateBehaviorScore` (functions + aliases). File keeps only `calculatePaceTrend` and the header comment (update the comment — it no longer "exports both naming conventions").

**Step 3: Delete dead files, fix the barrel**

```bash
git rm src/components/ui/scores/ScoreCard.tsx src/components/ui/scores/__examples__/ScoreExamples.tsx src/lib/analytics.backup.ts
git rm src/components/charts/LapTimeChart.tsx   # only if grep showed no importers
```

In `src/components/ui/scores/index.ts` remove the `ScoreCard` / `ScoreCardProps` export lines. `lib/scores.ts` STAYS (ScoreChip depends on it).

**Step 4: Final honesty grep**

```bash
git grep -nE "/100|drivingBehaviorScore|consistencyScore" -- src
```

Expected hits: ONLY `lib/scores.ts` internals (ScoreChip's generic variant logic, if any) and non-metric uses. Zero hits in pages, components rendering session/progress data, prompts, and `lib/insights.ts`/`lib/queries/`. Investigate and fix anything else.

**Step 5: Verify + commit**

Run: `npm test` → PASS. Run: `npm run build` → compiles.

```bash
git add -A
git commit -m "chore: remove dead /100 composite analytics, ScoreCard, LapTimeChart, analytics backup"
```

---

## Task 9: Full verification + PR

**Step 1: Full gates**

```bash
npm test          # all green
npm run lint      # clean
npm run build     # compiles
```

**Step 2: Manual QA against live demo data** (6 demo students exist in prod under the instructor account; use dev against the same data source you normally do)

- Session with 6+ laps: 4 stat cards, chart with band matching the ±0.Xs card value, fastest/slowest in table, both tabs work, patterns copy says "±0.Xs" when Exceptional Consistency fires.
- Session with <6 laps (5-lap demo session if one exists, else temporary local data): chart + table still render, ONE empty state where tabs would be, no AI coaching card.
- `/sessions/<id>/analysis` redirects.
- Regenerate AI coaching on one demo session and read the output — prompt no longer mentions /100; coaching text should still read naturally (product-sensitive check from the design doc).
- Student progress view: consistency shows ±X.Xs with sensible delta arrows (down = green).

**Step 3: Push and open PR**

Use the superpowers:requesting-code-review flow first if executing subagent-driven (spec review + quality review per the design doc's process), then:

```bash
git push -u origin feat/session-page-consolidation
gh pr create --title "Merge session detail + analysis into one honest-metrics page" --body "$(cat <<'EOF'
## Summary
- Merges /sessions/[id] and /sessions/[id]/analysis into one page: chart + lap table always visible, "Session Insights" | "Session Patterns" tabs for the interpretive layer, single >=6-lap gate
- Absorbs the honest-metrics migration: consistency is now std-dev seconds (analytics-v2) everywhere — insights, AI prompt, progress summaries, chart band; all /100 composites deleted
- /sessions/[id]/analysis now permanently redirects (shared links keep working)

Design doc: docs/plans/2026-07-27-session-page-consolidation-design.md

Closes #25

## Test plan
- [ ] npm test green (full suite)
- [ ] npm run build clean
- [ ] Demo student session (6+ laps): tabs, band = card sigma, no /100 anywhere
- [ ] <6-lap session: data visible, single empty state, no coaching card
- [ ] /analysis URL redirects
- [ ] Regenerated AI coaching reads well without /100 metrics
EOF
)"
```

**Step 4: Comment on #25**

```bash
gh issue comment 25 --body "Absorbed into the session page consolidation — see docs/plans/2026-07-27-session-page-consolidation-design.md and the PR above. Will close when it merges."
```

Scott merges the PR.
