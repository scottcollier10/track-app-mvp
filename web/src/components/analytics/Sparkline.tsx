'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];        // Array of lap times in ms
  height?: number;       // Default 40px
  color?: string;        // Default "#10b981" (green)
  className?: string;
}

export default function Sparkline({
  data,
  height = 40,
  color = '#10b981',
  className = '',
}: SparklineProps) {
  // Transform data into format Recharts expects
  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
