'use client';

import { formatLapMs } from '@/lib/time';
import { Award, AlertCircle } from 'lucide-react';

interface Lap {
  id: string;
  lap_number: number;
  lap_time_ms: number;
}

interface LapAnalysisTableProps {
  laps: Lap[];
  bestLapTime: number;
  slowestLapTime: number;
}

export default function LapAnalysisTable({
  laps,
  bestLapTime,
  slowestLapTime,
}: LapAnalysisTableProps) {
  // Calculate deltas and prepare table data
  const tableData = laps.map((lap) => {
    const deltaMs = lap.lap_time_ms - bestLapTime;
    const deltaSeconds = (deltaMs / 1000).toFixed(3);
    const deltaFormatted = deltaMs === 0 ? '—' : `+${deltaSeconds}s`;

    // Determine row styling
    let rowClass = 'bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surfaceAlt';
    let deltaClass = 'text-gray-600 dark:text-muted';
    let icon = null;

    if (lap.lap_time_ms === bestLapTime) {
      rowClass = 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30';
      deltaClass = 'text-green-600 dark:text-green-400 font-semibold';
      icon = <Award className="w-4 h-4 text-green-600 dark:text-green-400" />;
    } else if (lap.lap_time_ms === slowestLapTime) {
      rowClass = 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30';
      deltaClass = 'text-red-600 dark:text-red-400 font-semibold';
      icon = <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }

    return {
      ...lap,
      deltaFormatted,
      deltaMs,
      rowClass,
      deltaClass,
      icon,
    };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-surfaceAlt border-b border-gray-200 dark:border-subtle">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-primary uppercase tracking-wider">
              Lap
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-primary uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-primary uppercase tracking-wider">
              Delta
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-primary uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-subtle">
          {tableData.map((lap) => (
            <tr key={lap.id} className={`${lap.rowClass} transition-colors`}>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-semibold text-gray-900 dark:text-primary">
                  {lap.lap_number}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono text-gray-900 dark:text-primary font-medium">
                  {formatLapMs(lap.lap_time_ms)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`font-mono ${lap.deltaClass}`}>
                  {lap.deltaFormatted}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {lap.icon}
                  {lap.lap_time_ms === bestLapTime && (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      Best
                    </span>
                  )}
                  {lap.lap_time_ms === slowestLapTime && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      Slowest
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary footer */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-surfaceAlt rounded-lg border border-gray-200 dark:border-subtle">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-muted">Total Laps</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-primary">
              {laps.length}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-muted">Best Lap</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400 font-mono">
              {formatLapMs(bestLapTime)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-muted">Slowest Lap</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400 font-mono">
              {formatLapMs(slowestLapTime)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
