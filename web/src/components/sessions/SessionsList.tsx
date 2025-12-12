'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLapMs, formatDurationMs, formatDateTime } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { SourceBadge } from '@/components/ui/SourceBadge';
import SessionFilters, { SessionFilter, SortBy } from './SessionFilters';
import ExportButton from './ExportButton';

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
  filters?: SessionFilter;
}

export default function SessionsList({ filters: initialFilters }: SessionsListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filter and search state
  const [filters, setFilters] = useState<SessionFilter>(initialFilters || {});
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);

  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters?.trackId) params.set('trackId', filters.trackId);
        if (filters?.driverId) params.set('driverId', filters.driverId);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        if (sortBy) params.set('sortBy', sortBy);

        const response = await fetch(`/api/sessions?${params}`);
        if (!response.ok) throw new Error('Failed to fetch sessions');

        const data = await response.json();
        // Handle both response formats: { data: [...] } or [...]
        setSessions(data.data || data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [filters, sortBy]);

  // Apply client-side search filtering
  useEffect(() => {
    if (!searchQuery) {
      setFilteredSessions(sessions);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sessions.filter(session => {
      const trackName = session.track?.name?.toLowerCase() || '';
      const trackLocation = session.track?.location?.toLowerCase() || '';
      const driverName = formatDriverName(session.driver?.name || '').toLowerCase();
      const date = formatDateTime(session.date).toLowerCase();

      return trackName.includes(query) ||
             trackLocation.includes(query) ||
             driverName.includes(query) ||
             date.includes(query);
    });

    setFilteredSessions(filtered);
  }, [sessions, searchQuery]);

  // Skeleton Loading Components
  const TableRowSkeleton = () => (
    <tr className="hover:bg-gray-800/50 transition-colors animate-pulse">
      <td className="py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-24"></div>
      </td>
      <td className="py-4">
        <div className="flex items-center gap-2">
          <div>
            <div className="h-4 bg-gray-700 rounded w-32 mb-1"></div>
            <div className="h-3 bg-gray-700 rounded w-20"></div>
          </div>
          <div className="h-5 bg-gray-700 rounded w-16"></div>
        </div>
      </td>
      <td className="py-4">
        <div className="h-4 bg-gray-700 rounded w-28"></div>
      </td>
      <td className="py-4 text-right">
        <div className="h-4 bg-gray-700 rounded w-8 ml-auto"></div>
      </td>
      <td className="py-4 text-right">
        <div className="h-4 bg-gray-700 rounded w-16 ml-auto"></div>
      </td>
      <td className="py-4 text-right">
        <div className="h-4 bg-gray-700 rounded w-20 ml-auto"></div>
      </td>
      <td className="py-4 text-right">
        <div className="h-5 bg-gray-700 rounded w-16 ml-auto"></div>
      </td>
    </tr>
  );

  const CardSkeleton = () => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-32 mb-1"></div>
          <div className="h-3 bg-gray-700 rounded w-20"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-700 rounded w-16"></div>
          <div className="h-3 bg-gray-700 rounded w-16"></div>
        </div>
      </div>

      <div className="h-4 bg-gray-700 rounded w-28 mb-3"></div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="h-3 bg-gray-700 rounded w-8 mb-1"></div>
          <div className="h-4 bg-gray-700 rounded w-6"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-12 mb-1"></div>
          <div className="h-4 bg-gray-700 rounded w-16"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-1"></div>
          <div className="h-4 bg-gray-700 rounded w-20"></div>
        </div>
      </div>
    </div>
  );

  // Mobile Card Component
  const SessionCard = ({ session }: { session: Session }) => (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-gray-100 mb-1">
            {session.track?.name || 'Unknown Track'}
          </div>
          <div className="text-sm text-gray-400">
            {session.track?.location}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.source && <SourceBadge source={session.source} size="sm" />}
          <div className="text-sm text-red-400">
            {formatDateTime(session.date)}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-300 mb-3">
        {formatDriverName(session.driver?.name || 'Unknown Driver')}
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Laps</div>
          <div className="text-gray-300">{session.lapCount}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Best Lap</div>
          <div className="font-mono">
            {session.best_lap_ms ? (
              <span className="text-green-400">{formatLapMs(session.best_lap_ms)}</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Time</div>
          <div className="font-mono text-gray-300">{formatDurationMs(session.total_time_ms)}</div>
        </div>
      </div>
    </Link>
  );

  if (loading) {
    return (
      <>
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="h-9 bg-gray-700 rounded w-32 animate-pulse"></div>
            <div className="h-5 bg-gray-700 rounded w-48 mt-2 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-700 rounded w-32 animate-pulse"></div>
        </div>

        <div className="bg-slate-900/80 rounded-lg shadow-[0_22px_50px_rgba(15,23,42,0.9)] p-6">
          {/* Mobile Filter Toggle Skeleton */}
          <div className="lg:hidden mb-4">
            <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
          </div>

          {/* Filters Panel Skeleton */}
          <div className="mb-6">
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <div className="h-8 bg-gray-700 rounded w-40 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-4 bg-gray-700 rounded w-16 mb-2 animate-pulse"></div>
                    <div className="h-10 bg-gray-700 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content Skeletons */}
          <>
            {/* Desktop Table Skeleton */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-sm text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Track</th>
                    <th className="pb-3 font-medium">Driver</th>
                    <th className="pb-3 font-medium text-right">Laps</th>
                    <th className="pb-3 font-medium text-right">Best Lap</th>
                    <th className="pb-3 font-medium text-right">Total Time</th>
                    <th className="pb-3 font-medium text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Skeleton */}
            <div className="md:hidden space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Sessions</h1>
            <p className="text-gray-400 mt-1">Error loading sessions</p>
          </div>
        </div>
        <div className="bg-slate-900/80 rounded-lg shadow-[0_22px_50px_rgba(15,23,42,0.9)] p-6">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header with Export Button - NO background, hero burst shows through */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Sessions</h1>
          <p className="text-gray-400 mt-1">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
            {filteredSessions.length !== sessions.length && ` of ${sessions.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            sessions={filteredSessions}
            disabled={loading || filteredSessions.length === 0}
          />
        </div>
      </div>

      {/* Filters + Table - Dark background container */}
      <div className="bg-slate-900/80 rounded-lg shadow-[0_22px_50px_rgba(15,23,42,0.9)] p-6">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center justify-between text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <span>Filters</span>
            <svg
              className={`w-5 h-5 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Filters Panel */}
        <div className={`${isFiltersOpen ? 'block' : 'hidden'} lg:block mb-6`}>
          <SessionFilters
            onFilterChange={setFilters}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Sessions List/Grid */}
        {filteredSessions.length === 0 ? (
          <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-8 text-center">
            <p className="text-gray-400">
              {sessions.length === 0
                ? 'No sessions found.'
                : 'No sessions match your current filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-sm text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Track</th>
                    <th className="pb-3 font-medium">Driver</th>
                    <th className="pb-3 font-medium text-right">Laps</th>
                    <th className="pb-3 font-medium text-right">Best Lap</th>
                    <th className="pb-3 font-medium text-right">Total Time</th>
                    <th className="pb-3 font-medium text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredSessions.map((session) => (
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
                        <div>
                          <div className="font-medium text-gray-100">
                            {session.track?.name || 'Unknown Track'}
                          </div>
                          <div className="text-sm text-gray-400">
                            {session.track?.location}
                          </div>
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
                      <td className="py-4 text-right">
                        {session.source ? (
                          <SourceBadge source={session.source} size="sm" />
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (shown on mobile/tablet) */}
            <div className="md:hidden space-y-4">
              {filteredSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
