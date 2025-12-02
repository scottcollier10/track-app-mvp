'use client';

/**
 * CSV Preview Component
 * Shows parsed session data in a table
 */

import { ParsedSession } from '@/lib/csv-parser';
import { formatLapTime } from '@/lib/utils/formatters';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface CsvPreviewProps {
  sessions: ParsedSession[];
  warnings?: string[];
}

export default function CsvPreview({ sessions, warnings }: CsvPreviewProps) {
  const totalLaps = sessions.reduce((sum, s) => sum + s.laps.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Sessions</p>
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Total Laps</p>
              <p className="text-2xl font-bold text-white">{totalLaps}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Drivers</p>
              <p className="text-2xl font-bold text-white">
                {new Set(sessions.map((s) => s.driverName)).size}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-400">Warnings</p>
              {warnings.map((warning, index) => (
                <p key={index} className="text-sm text-yellow-300">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Preview</h3>

        {sessions.map((session, index) => (
          <Card key={index} className="bg-neutral-800/50">
            <div className="space-y-4">
              {/* Session Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-medium text-white">
                    {session.trackName}
                  </h4>
                  <p className="text-sm text-neutral-400 mt-1">
                    {session.driverName} • {new Date(session.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-400">Best Lap</p>
                  <p className="text-lg font-bold text-orange-500">
                    {formatLapTime(session.bestLapMs)}
                  </p>
                </div>
              </div>

              {/* Laps Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      <th className="text-left py-2 px-2 text-neutral-400 font-medium">
                        Lap
                      </th>
                      <th className="text-right py-2 px-2 text-neutral-400 font-medium">
                        Time
                      </th>
                      <th className="text-right py-2 px-2 text-neutral-400 font-medium">
                        Delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.laps.slice(0, 5).map((lap) => {
                      const delta = lap.lapTimeMs - session.bestLapMs;
                      const isBest = lap.lapTimeMs === session.bestLapMs;

                      return (
                        <tr
                          key={lap.lapNumber}
                          className="border-b border-neutral-800 last:border-0"
                        >
                          <td className="py-2 px-2 text-white">
                            {lap.lapNumber}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono ${
                              isBest ? 'text-orange-500 font-bold' : 'text-white'
                            }`}
                          >
                            {formatLapTime(lap.lapTimeMs)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono text-sm ${
                              isBest
                                ? 'text-green-500'
                                : delta > 0
                                ? 'text-red-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {isBest ? '✓ Best' : `+${(delta / 1000).toFixed(3)}s`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {session.laps.length > 5 && (
                  <p className="text-xs text-neutral-500 text-center mt-3">
                    + {session.laps.length - 5} more laps
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
