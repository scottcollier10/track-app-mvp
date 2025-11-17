'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLapMs, formatDate } from '@/lib/time';

interface SessionListItem {
  id: string;
  date: string;
  best_lap_ms: number | null;
  track: {
    id: string;
    name: string;
    location: string | null;
  } | null;
  lapCount: number;
}

interface DriverStats {
  totalSessions: number;
  bestLapMs: number | null;
  bestLapTrack: string | null;
  favoriteTrack: {
    id: string;
    name: string;
    sessionCount: number;
  } | null;
  recentSessions: SessionListItem[];
  averageLapsPerSession: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

interface DriverStatsProps {
  driverId: string;
}

export default function DriverStats({ driverId }: DriverStatsProps) {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/drivers/${driverId}/stats`);
        if (!response.ok) {
          throw new Error('Failed to fetch driver statistics');
        }

        const data = await response.json();
        setStats(data.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    if (driverId) {
      fetchStats();
    }
  }, [driverId]);

  // Calculate time since last session
  const getTimeSinceLastSession = (lastSessionDate: string | null): string => {
    if (!lastSessionDate) return 'Never';

    const lastDate = new Date(lastSessionDate);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-gray-600 dark:text-gray-400 text-center">
          Loading statistics...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
          Error Loading Statistics
        </h3>
        <p className="text-red-700 dark:text-red-300 text-sm">
          {error.message || 'Failed to load driver statistics.'}
        </p>
      </div>
    );
  }

  // Empty state (no sessions)
  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Driver Statistics</h2>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">🏁</div>
          <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Start tracking your performance by importing your first session from
            the iOS app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview Cards */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-6">Driver Statistics</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Sessions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
              Total Sessions
            </div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {stats.totalSessions}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Last session: {getTimeSinceLastSession(stats.lastSessionDate)}
            </div>
          </div>

          {/* Best Lap */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">
              All-Time Best Lap
            </div>
            <div className="text-3xl font-bold font-mono text-green-700 dark:text-green-300">
              {stats.bestLapMs ? formatLapMs(stats.bestLapMs) : '—'}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-2">
              {stats.bestLapTrack || 'No laps recorded'}
            </div>
          </div>

          {/* Favorite Track */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">
              Favorite Track
            </div>
            <div className="text-xl font-bold text-purple-700 dark:text-purple-300 truncate">
              {stats.favoriteTrack?.name || 'None'}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              {stats.favoriteTrack
                ? `${stats.favoriteTrack.sessionCount} session${stats.favoriteTrack.sessionCount !== 1 ? 's' : ''}`
                : 'No sessions yet'}
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
              Average Laps per Session
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.averageLapsPerSession.toFixed(1)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
              Member Since
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {stats.firstSessionDate
                ? formatDate(stats.firstSessionDate)
                : 'Unknown'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      {stats.recentSessions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Recent Sessions</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Your last {stats.recentSessions.length} track sessions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Track
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Laps
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Lap
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.recentSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {formatDate(session.date)}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {session.track?.name || 'Unknown Track'}
                        </span>
                        {session.track?.location && (
                          <span className="text-sm text-gray-500">
                            {session.track.location}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                      {session.lapCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-green-600 dark:text-green-400 font-semibold">
                      {session.best_lap_ms
                        ? formatLapMs(session.best_lap_ms)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <Link
              href="/sessions"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              View all sessions →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
