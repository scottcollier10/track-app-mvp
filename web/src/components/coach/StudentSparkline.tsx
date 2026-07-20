'use client';

import type React from 'react';
import {
  LineChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  YAxis,
} from 'recharts';

interface StudentSparklineProps {
  /** Session best-lap times in ms, chronological. Lower is better. */
  points: number[];
  /** Optional personal-baseline band to shade behind the trend line. */
  baseline?: { mean: number; upper: number; lower: number };
  width?: number;
  height?: number;
}

/**
 * Compact trend of a student's session best-lap times (ms). Lower is faster,
 * so the line is plotted faithfully (no inversion). Hidden axes, a single dot
 * on the most-recent point, and an optional shaded baseline band.
 */
export function StudentSparkline({
  points,
  baseline,
  width = 64,
  height = 20,
}: StudentSparklineProps) {
  // Need at least two points to draw a meaningful line.
  if (!points || points.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-slate-600"
        aria-hidden="true"
      >
        <span>—</span>
      </div>
    );
  }

  const chartData = points.map((value, index) => ({ index, value }));
  const lastIndex = chartData.length - 1;

  // Render a dot only on the most-recent point; hide all others.
  const renderDot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    key?: string;
  }): React.ReactElement<SVGElement> => {
    const { cx, cy, index, key } = props;
    if (index !== lastIndex || cx === undefined || cy === undefined) {
      return <g key={key} />;
    }
    return (
      <circle key={key} cx={cx} cy={cy} r={2} fill="#e2e8f0" stroke="none" />
    );
  };

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          {baseline && (
            <ReferenceArea
              y1={baseline.lower}
              y2={baseline.upper}
              fill="#38bdf8"
              fillOpacity={0.12}
              stroke="none"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#94a3b8"
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={renderDot}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
