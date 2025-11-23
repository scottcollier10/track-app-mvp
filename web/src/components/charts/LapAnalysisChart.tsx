'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  Dot,
} from 'recharts';
import { formatLapMs } from '@/lib/time';

interface ChartDataPoint {
  lap: number;
  time: number; // in seconds
  timeMs: number;
  isBest: boolean;
  upperBand: number;
  lowerBand: number;
}

interface LapAnalysisChartProps {
  data: ChartDataPoint[];
  bestLapTime: number;
  stdDev: number;
}

export default function LapAnalysisChart({ data, bestLapTime, stdDev }: LapAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No lap data available
      </div>
    );
  }

  // Calculate chart bounds with some padding
  const allTimes = data.map(d => d.time);
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const padding = (maxTime - minTime) * 0.1 || 1;

  // Custom dot to highlight best lap
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;

    if (payload.isBest) {
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#22C55E"
            stroke="#fff"
            strokeWidth={2}
          />
          <circle
            cx={cx}
            cy={cy}
            r={8}
            fill="none"
            stroke="#22C55E"
            strokeWidth={2}
            opacity={0.5}
          />
        </g>
      );
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#3B82F6"
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const deltaMs = data.timeMs - bestLapTime;
    const deltaSign = deltaMs > 0 ? '+' : '';
    const deltaSeconds = (deltaMs / 1000).toFixed(3);

    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Lap {data.lap}
        </p>
        <div className="space-y-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Time: <span className="font-mono font-semibold">{formatLapMs(data.timeMs)}</span>
          </p>
          {data.isBest ? (
            <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
              ★ Best Lap
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Delta: <span className="font-mono">{deltaSign}{deltaSeconds}s</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
        >
          <defs>
            <linearGradient id="consistencyBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-300 dark:stroke-gray-700"
            opacity={0.5}
          />

          <XAxis
            dataKey="lap"
            label={{
              value: 'Lap Number',
              position: 'insideBottom',
              offset: -10,
              className: 'fill-gray-600 dark:fill-gray-400',
            }}
            className="text-xs fill-gray-600 dark:fill-gray-400"
            tick={{ fill: 'currentColor' }}
          />

          <YAxis
            domain={[minTime - padding, maxTime + padding]}
            label={{
              value: 'Lap Time (seconds)',
              angle: -90,
              position: 'insideLeft',
              className: 'fill-gray-600 dark:fill-gray-400',
            }}
            className="text-xs fill-gray-600 dark:fill-gray-400"
            tick={{ fill: 'currentColor' }}
            tickFormatter={(value) => value.toFixed(1)}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Consistency Band (±1 standard deviation) */}
          <Area
            type="monotone"
            dataKey="upperBand"
            stroke="none"
            fill="url(#consistencyBand)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="lowerBand"
            stroke="none"
            fill="url(#consistencyBand)"
            fillOpacity={1}
          />

          {/* Best lap reference line */}
          <ReferenceLine
            y={bestLapTime / 1000}
            stroke="#22C55E"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: 'Best',
              position: 'right',
              fill: '#22C55E',
              fontSize: 12,
            }}
          />

          {/* Main lap time line */}
          <Line
            type="monotone"
            dataKey="time"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Best Lap</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Lap Time</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-blue-500 bg-opacity-20 rounded"></div>
          <span>Consistency Band (±1σ)</span>
        </div>
      </div>
    </div>
  );
}
