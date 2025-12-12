"use client";

import Link from 'next/link';
import { formatLapMs, formatDate } from '@/lib/time';
import {
  getConsistencyColor,
  getBehaviorScoreColor,
} from '@/lib/analytics';
import { SessionWithDetails } from '@/data/sessions';

interface SessionHistoryTableProps {
  sessions: SessionWithDetails[];
}

interface GroupedSession {
  date: string;
  trackName: string;
  trackId: string;
  sessions: SessionWithDetails[];
}

/**
 * Groups sessions by date and track (Event = Track + Date)
 */
function groupSessionsByEvent(
  sessions: SessionWithDetails[]
): GroupedSession[] {
  const grouped = new Map<string, GroupedSession>();

  sessions.forEach((session) => {
    const dateKey = session.date.split('T')[0]; // YYYY-MM-DD
    const trackId = session.track?.id || 'unknown';
    const key = `${dateKey}-${trackId}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: dateKey,
        trackName: session.track?.name || 'Unknown Track',
        trackId: trackId,
        sessions: [],
      });
    }

    grouped.get(key)!.sessions.push(session);
  });

  // Sort sessions within each group by date/time
  grouped.forEach((group) => {
    group.sessions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  });

  // Convert to array and sort by date (newest first)
  return Array.from(grouped.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

/**
 * Get source badge styling
 */
function getSourceBadge(source?: string): { label: string; className: string } {
  const s = source?.toLowerCase() || 'unknown';

  if (s.includes('ios') || s.includes('app')) {
    return {
      label: 'iOS App',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
  }
  if (s.includes('racechrono')) {
    return {
      label: 'RaceChrono',
      className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    };
  }
  if (s.includes('aim')) {
    return {
      label: 'AiM',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
  }
  if (s.includes('trackaddict')) {
    return {
      label: 'TrackAddict',
      className: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    };
  }

  return {
    label: source || 'Unknown',
    className: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
}

export default function SessionHistoryTable({
  sessions,
}: SessionHistoryTableProps) {
  const groupedSessions = groupSessionsByEvent(sessions);

  return (
    <div className="space-y-6">
      {groupedSessions.map((group) => (
        <div
          key={`${group.date}-${group.trackId}`}
          className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
        >
          {/* Event Header */}
          <div className="bg-gray-800/80 border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {group.trackName}
                </h3>
                <p className="text-sm text-gray-400">
                  {formatDate(group.date)} • {group.sessions.length} session
                  {group.sessions.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr className="border-b border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Laps
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Best Lap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Consistency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Behavior
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {group.sessions.map((session, index) => {
                  const sourceBadge = getSourceBadge(session.source);

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Session Number */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-white">
                          S{index + 1}
                        </span>
                      </td>

                      {/* Source Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sourceBadge.className}`}
                        >
                          {sourceBadge.label}
                        </span>
                      </td>

                      {/* Laps */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {session.lapCount}
                      </td>

                      {/* Best Lap */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-green-400">
                          {session.best_lap_ms
                            ? formatLapMs(session.best_lap_ms)
                            : '-'}
                        </span>
                      </td>

                      {/* Consistency - Placeholder for Phase 2 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">Phase 2</span>
                      </td>

                      {/* Behavior - Placeholder for Phase 2 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">Phase 2</span>
                      </td>

                      {/* GO Button */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          GO
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
