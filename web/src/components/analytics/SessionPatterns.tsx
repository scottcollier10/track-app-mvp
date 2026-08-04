'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Snowflake, Flame, TrendingDown, Info, LucideIcon } from 'lucide-react';
import { formatLapMs } from '@/lib/time';
import { cleanLaps } from '@/lib/analytics-v2';
import { SIGMA_DISPLAY_DECIMALS } from '@/lib/track-days';

interface Lap {
  id: string;
  lap_number: number;
  lap_time_ms: number;
}

interface SessionPatternsProps {
  laps: Lap[];
  bestLapTime: number;
  /** Session std-dev in seconds from analytics-v2 (single σ source for the page). Display only. */
  consistencySeconds: number | null;
}

interface Pattern {
  type: 'cold-tires' | 'peak-performance' | 'tire-degradation' | 'consistent';
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  laps: string;
  avgTime?: string;
}

export default function SessionPatterns({ laps, bestLapTime, consistencySeconds }: SessionPatternsProps) {
  const patterns: Pattern[] = [];

  if (laps.length < 5) {
    return null;
  }

  const lapTimes = laps.map(l => l.lap_time_ms);

  // Calculate overall average
  const overallAvg = lapTimes.reduce((sum, time) => sum + time, 0) / lapTimes.length;

  // 1. Cold Tires Detection (first 2-3 laps)
  const warmUpLaps = laps.slice(0, Math.min(3, laps.length));
  const warmUpAvg = warmUpLaps.reduce((sum, lap) => sum + lap.lap_time_ms, 0) / warmUpLaps.length;

  // If first 2-3 laps are significantly slower than best (more than 2%)
  if (warmUpAvg > bestLapTime * 1.02) {
    const slowestWarmUp = Math.max(...warmUpLaps.map(l => l.lap_time_ms));
    const improvement = ((slowestWarmUp - bestLapTime) / bestLapTime * 100).toFixed(1);

    patterns.push({
      type: 'cold-tires',
      title: 'Cold Tires Phase',
      description: `First ${warmUpLaps.length} laps were ${improvement}% slower on average as tires warmed up`,
      icon: Snowflake,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/20',
      laps: `Laps 1-${warmUpLaps.length}`,
      avgTime: formatLapMs(warmUpAvg),
    });
  }

  // 2. Peak Performance Detection (cluster of fastest laps)
  // Find the window of 3 consecutive laps with lowest average
  let bestWindow = { start: 0, avg: Infinity };
  const windowSize = Math.min(3, laps.length);

  for (let i = 0; i <= laps.length - windowSize; i++) {
    const window = laps.slice(i, i + windowSize);
    const windowAvg = window.reduce((sum, lap) => sum + lap.lap_time_ms, 0) / windowSize;

    if (windowAvg < bestWindow.avg) {
      bestWindow = { start: i, avg: windowAvg };
    }
  }

  const peakLaps = laps.slice(bestWindow.start, bestWindow.start + windowSize);
  const peakLapNumbers = peakLaps.map(l => l.lap_number);
  const peakImprovementVsAvg = ((overallAvg - bestWindow.avg) / overallAvg * 100).toFixed(1);

  patterns.push({
    type: 'peak-performance',
    title: 'Peak Performance Window',
    description: `Fastest ${windowSize} consecutive laps, ${peakImprovementVsAvg}% better than session average`,
    icon: Flame,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    laps: peakLapNumbers.length === 1
      ? `Lap ${peakLapNumbers[0]}`
      : `Laps ${peakLapNumbers[0]}-${peakLapNumbers[peakLapNumbers.length - 1]}`,
    avgTime: formatLapMs(bestWindow.avg),
  });

  // 3. Tire Degradation Detection (last 3 laps)
  if (laps.length >= 6) {
    const endLaps = laps.slice(-3);
    const endAvg = endLaps.reduce((sum, lap) => sum + lap.lap_time_ms, 0) / endLaps.length;

    // If last 3 laps are significantly slower than best (more than 2%)
    if (endAvg > bestLapTime * 1.02) {
      const degradation = ((endAvg - bestLapTime) / bestLapTime * 100).toFixed(1);

      patterns.push({
        type: 'tire-degradation',
        title: 'Tire Degradation Phase',
        description: `Final ${endLaps.length} laps showed ${degradation}% slower times, indicating tire wear`,
        icon: TrendingDown,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-950/20',
        laps: `Laps ${endLaps[0].lap_number}-${endLaps[endLaps.length - 1].lap_number}`,
        avgTime: formatLapMs(endAvg),
      });
    }
  }

  // 4. Consistency Check.
  //
  // Both halves of this come off the σ the card PRINTS. It used to trigger on a
  // population std-dev computed here over every raw lap and then report
  // analytics-v2's sample std-dev over CLEAN laps — two different statistics
  // over two different lap sets, so the card could appear because one was small
  // and go on to print the other. An out lap hid it from sessions the page's own
  // Consistency card was calling tight; a large reported σ let it call ±5.0s
  // exceptional.
  //
  // Mean over cleanLaps, not over all laps, because that is the set σ was
  // measured on: a coefficient of variation whose numerator and denominator come
  // from different samples is not a coefficient of variation. cleanLaps is
  // imported, not reimplemented — nothing here is a second definition.
  //
  // Threshold semantics move with the numerator, deliberately: a spread taken
  // after out/in laps are dropped is smaller than one taken before, so a fixed
  // 2% now admits sessions it used to reject. That is the correction, not a side
  // effect — those sessions ARE the ones the page reports a tight σ for.
  //
  // No σ, no card. A null σ means analytics-v2 found fewer than two clean laps,
  // and there is no version of this card that is honest without a number.
  const cleanLapTimes = cleanLaps(lapTimes);
  const cleanMeanSeconds =
    cleanLapTimes.length > 0
      ? cleanLapTimes.reduce((sum, time) => sum + time, 0) / cleanLapTimes.length / 1000
      : 0;

  if (
    consistencySeconds !== null &&
    cleanMeanSeconds > 0 &&
    (consistencySeconds / cleanMeanSeconds) * 100 < 2
  ) {
    patterns.push({
      type: 'consistent',
      title: 'Exceptional Consistency',
      description: `Lap times stayed within ±${consistencySeconds.toFixed(SIGMA_DISPLAY_DECIMALS)}s, showing excellent pace control throughout the session`,
      icon: Info,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      // "All laps" was true of the spread this used to trigger on and is not
      // true of the σ it reports — the Consistency card's own helper text calls
      // that "your clean lap times". Same words for the same set.
      laps: 'Clean laps',
    });
  }

  return (
    <Card>
      <CardContent>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-primary mb-4">
          Session Patterns
        </h2>

        {patterns.length === 0 ? (
          <p className="text-gray-600 dark:text-muted text-sm">
            No significant patterns detected. Need at least 5 laps for pattern analysis.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patterns.map((pattern, index) => (
              <div
                key={index}
                className={`${pattern.bgColor} p-4 rounded-lg border border-gray-200 dark:border-subtle`}
              >
                <div className="flex items-start gap-3">
                  <div className={`${pattern.color} mt-0.5`}>
                    <pattern.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm ${pattern.color} mb-1`}>
                      {pattern.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                      {pattern.description}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-white dark:bg-surface rounded text-gray-700 dark:text-gray-300 font-medium">
                        {pattern.laps}
                      </span>
                      {pattern.avgTime && (
                        <span className="px-2 py-1 bg-white dark:bg-surface rounded text-gray-700 dark:text-gray-300 font-mono">
                          {pattern.avgTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Context */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-surfaceAlt rounded-lg border border-gray-200 dark:border-subtle">
          <p className="text-xs text-gray-600 dark:text-muted">
            <strong>Pattern Analysis:</strong> Patterns are automatically detected based on lap time
            distribution. Cold tire phases typically occur in the first 2-3 laps. Peak performance
            represents your fastest consecutive lap cluster. Tire degradation is identified when final
            laps show consistent slowdown.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
