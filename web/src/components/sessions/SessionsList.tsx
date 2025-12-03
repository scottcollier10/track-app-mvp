'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLapMs, formatDurationMs, formatDateTime } from '@/lib/time';
import { SourceBadge } from '@/components/ui/SourceBadge';

interface Session {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  source?: string;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

interface SessionsListProps {
  filters?: {
    trackId?: string;
    driverId?: string;
    startDate?: string;
    endDate?: string;
  };
  sortBy?: string;
}

/**
 * Format driver name from email format to proper case
 */
function formatDriverName(name: string): string {
  if (!name) return '';
  
  // If name already has capital letters, assume it's formatted
  if (name !== name.toLowerCase()) {
    return name;
  }
  
  // Split on dots or spaces, capitalize each word
  return name
    .split(/[.\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function SessionsList({ filters, sortBy }: SessionsListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (filters?.trackId) params.set('trackId', filters.trackId);
        if (filters?.driverId) params.set('driverId', filters.driverId);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        if (sortBy) params.set('sortBy', sortBy);

        const response = await fetch(`/api/sessions?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle both array and wrapped response formats
        if (Array.isArray(data)) {
          setSessions(data);
        } else if (data.data && Array.isArray(data.data)) {
          setSessions(data.data);
        } else if (data.sessions && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        } else {
          console.error('Unexpected API response format:', data);
          throw new Error('API returned unexpected data format');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
        setSessions([]); // Ensure sessions is always an array
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [filters, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
        <p className="text-red-400 font-medium mb-2">Error loading sessions</p>
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-8 text-center">
        <p className="text-gray-400">No sessions found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700 text-left text-sm text-gray-400 uppercase tracking-wider">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Track</th>
            <th className="pb-3 font-medium">Driver</th>
            <th className="pb-3 font-medium text-right">Laps</th>
            <th className="pb-3 font-medium text-right">Best Lap</th>
            <th className="pb-3 font-medium text-right">Total Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sessions.map((session) => (
            <tr
              key={session.id}
              className="hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-4 text-sm">
                <Link
                  href={`/sessions/${session.id}`}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  {formatDateTime(session.date)}
                </Link>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="font-medium text-gray-100">
                      {session.track?.name || 'Unknown Track'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {session.track?.location}
                    </div>
                  </div>
                  {session.source && <SourceBadge source={session.source} size="sm" />}
                </div>
              </td>
              <td className="py-4 text-gray-300">
                {formatDriverName(session.driver?.name || 'Unknown Driver')}
              </td>
              <td className="py-4 text-right text-gray-300">
                {session.lapCount}
              </td>
              <td className="py-4 text-right">
                {session.best_lap_ms ? (
                  <span className="text-green-400 font-mono">
                    {formatLapMs(session.best_lap_ms)}
                  </span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>
              <td className="py-4 text-right text-gray-300 font-mono">
                {formatDurationMs(session.total_time_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
