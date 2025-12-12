'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { EventMetrics } from '@/data/driverProgress';
import { formatDateShort, msToSeconds, formatLapMs } from '@/lib/time';

interface ProgressChartsProps {
  events: EventMetrics[];
  trackName: string;
  seasonTarget?: number; // Target lap time in ms (optional)
}

export default function ProgressCharts({ events, trackName, seasonTarget }: ProgressChartsProps) {
  // Responsive chart height
  const [chartHeight, setChartHeight] = useState(300);

  useEffect(() => {
    const updateHeight = () => {
      setChartHeight(window.innerWidth < 768 ? 250 : 300);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  // Transform data for charts
  const chartData = events.map((event) => ({
    date: formatDateShort(event.date),
    lapTime: event.bestLapMs ? msToSeconds(event.bestLapMs) : null,
    lapTimeMs: event.bestLapMs,
    consistency: event.consistency,
  }));

  // Filter out events without data for each chart
  const lapTimeData = chartData.filter((d) => d.lapTime !== null);
  const consistencyData = chartData.filter((d) => d.consistency !== null);

  // Custom tooltip for lap time chart
  const LapTimeTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 shadow-lg">
        <p className="text-sm font-semibold text-slate-50 mb-1">{data.date}</p>
        {data.lapTimeMs && (
          <p className="text-sm text-emerald-400 font-mono">{formatLapMs(data.lapTimeMs)}</p>
        )}
      </div>
    );
  };

  // Custom tooltip for consistency chart
  const ConsistencyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 shadow-lg">
        <p className="text-sm font-semibold text-slate-50 mb-1">{data.date}</p>
        {data.consistency !== null && (
          <p className="text-sm text-sky-400 font-semibold">{data.consistency}/100</p>
        )}
      </div>
    );
  };

  // Format Y-axis for lap times
  const formatLapTimeAxis = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Chart 1: Best Lap by Event */}
      {lapTimeData.length > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Best Lap by Event • {trackName}
          </h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={lapTimeData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
                domain={['auto', 'auto']}
                reversed={true}
                tickFormatter={formatLapTimeAxis}
              />
              <Tooltip content={<LapTimeTooltip />} />
              <Line
                type="monotone"
                dataKey="lapTime"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              {seasonTarget && (
                <ReferenceLine
                  y={msToSeconds(seasonTarget)}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{
                    value: 'Season Target',
                    position: 'right',
                    fill: '#94a3b8',
                    fontSize: 12,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart 2: Consistency Score by Event */}
      {consistencyData.length > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Consistency Score by Event
          </h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={consistencyData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
                domain={[70, 100]}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip content={<ConsistencyTooltip />} />
              <Line
                type="monotone"
                dataKey="consistency"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: '#0ea5e9', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* No data message */}
      {lapTimeData.length === 0 && consistencyData.length === 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
          <p className="text-slate-400">No progression data available for charts.</p>
        </div>
      )}
    </div>
  );
}
