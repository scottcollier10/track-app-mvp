'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatLapTime } from '@/lib/utils/formatters';

interface LapTimeChartProps {
  laps: Array<{
    lap_number: number;
    lap_time_ms: number;
  }>;
}

export default function LapTimeChart({ laps }: LapTimeChartProps) {
  // Transform data for chart
  const chartData = laps.map((lap) => ({
    lap: lap.lap_number,
    time: lap.lap_time_ms / 1000, // Convert to seconds for display
    timeMs: lap.lap_time_ms,
  }));

  // Find min/max for Y-axis domain
  const times = chartData.map((d) => d.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const padding = (maxTime - minTime) * 0.1; // 10% padding

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
          <XAxis
            dataKey="lap"
            label={{ value: 'Lap Number', position: 'insideBottom', offset: -5 }}
            className="text-sm"
          />
          <YAxis
            domain={[minTime - padding, maxTime + padding]}
            tickFormatter={(value) => value.toFixed(1)}
            label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }}
            className="text-sm"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold">Lap {data.lap}</p>
                    <p className="text-track-green font-mono">
                      {formatLapTime(data.timeMs)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="time"
            stroke="rgb(51, 204, 102)"
            strokeWidth={2}
            dot={{ fill: 'rgb(51, 204, 102)', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
