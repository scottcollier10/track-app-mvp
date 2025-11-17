"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SessionFilters, { SessionFilter, SortBy } from "./SessionFilters";
import SessionsSubtitle from "@/components/ui/SessionsSubtitle";
import { formatDate, formatLapMs, formatDurationMs } from "@/lib/time";

interface Session {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

export default function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<SessionFilter>({});
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");

  // Fetch sessions whenever filters change
  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        setError(null);

        // Build query params
        const params = new URLSearchParams();
        if (filters.trackId) params.set("trackId", filters.trackId);
        if (filters.driverId) params.set("driverId", filters.driverId);
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);

        const queryString = params.toString();
        const url = `/api/sessions${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch sessions");
        }

        const data = await response.json();
        setSessions(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [filters]);

  const handleFilterChange = (newFilters: SessionFilter) => {
    setFilters(newFilters);
  };

  const handleSortChange = (newSortBy: SortBy) => {
    setSortBy(newSortBy);
  };

  // Sort sessions based on sortBy value
  const sortedSessions = [...sessions].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case "date-asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "best-lap-asc":
        // Handle null best_lap_ms - put nulls at the end
        if (a.best_lap_ms === null) return 1;
        if (b.best_lap_ms === null) return -1;
        return a.best_lap_ms - b.best_lap_ms;
      case "best-lap-desc":
        // Handle null best_lap_ms - put nulls at the end
        if (a.best_lap_ms === null) return 1;
        if (b.best_lap_ms === null) return -1;
        return b.best_lap_ms - a.best_lap_ms;
      case "laps-desc":
        return b.lapCount - a.lapCount;
      case "laps-asc":
        return a.lapCount - b.lapCount;
      default:
        return 0;
    }
  });

  // Derived counts for subtitle
  const totalSessions = sessions.length;
  const uniqueDrivers = new Set(
    sessions.map((s) => s.driver?.name || "Unknown")
  ).size;

  // Error state
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Browse all track sessions
          </p>
        </div>

        <SessionFilters
          onFilterChange={handleFilterChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
        />

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Sessions
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message || "Failed to load sessions. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <SessionsSubtitle
          totalSessions={totalSessions}
          uniqueDrivers={uniqueDrivers}
        />
      </div>

      {/* Filters */}
      <SessionFilters
        onFilterChange={handleFilterChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
      />

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-gray-600 dark:text-gray-400">
            Loading sessions...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-4">🏁</div>
          <h3 className="text-xl font-semibold mb-2">No Sessions Found</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {Object.keys(filters).length > 0
              ? "No sessions match your filters. Try adjusting your search criteria."
              : "Demo data unavailable. Import a session from the iOS app or add sample data to your database."}
          </p>
        </div>
      )}

      {/* Sessions Table */}
      {!loading && sessions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Laps
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Lap
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedSessions.map((session) => (
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
                          {session.track?.name || "Unknown Track"}
                        </span>
                        {session.track?.location && (
                          <span className="text-sm text-gray-500">
                            {session.track.location}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {session.driver?.name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                      {session.lapCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-green-600 dark:text-green-400 font-semibold">
                      {session.best_lap_ms
                        ? formatLapMs(session.best_lap_ms)
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600 dark:text-gray-400">
                      {formatDurationMs(session.total_time_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
