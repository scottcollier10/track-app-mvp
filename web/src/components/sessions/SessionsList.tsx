"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SessionFilters, { SessionFilter, SortBy } from "./SessionFilters";
import SessionsHeader from "./SessionsHeader";
import { formatDate, formatLapMs, formatDurationMs } from "@/lib/time";
import { Card } from "@/components/ui/Card";
import { Flag } from "lucide-react";

interface Session {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

interface SessionsListProps {
  initialFilters?: SessionFilter;
}

export default function SessionsList({ initialFilters = {} }: SessionsListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<SessionFilter>(initialFilters);
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // Filter sessions by search query first
  const searchFiltered = sessions.filter((session) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const trackName = session.track?.name?.toLowerCase() || "";
    const driverName = session.driver?.name?.toLowerCase() || "";
    const dateStr = new Date(session.date).toLocaleDateString().toLowerCase();

    return (
      trackName.includes(query) ||
      driverName.includes(query) ||
      dateStr.includes(query)
    );
  });

  // Sort sessions based on sortBy value
  const sortedSessions = [...searchFiltered].sort((a, b) => {
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
        <SessionsHeader
          sessions={sortedSessions}
          totalSessions={totalSessions}
          uniqueDrivers={uniqueDrivers}
        />

        <Card>
          <SessionFilters
            onFilterChange={handleFilterChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </Card>

        <Card className="bg-status-critical/10 border-status-critical/30">
          <h3 className="text-status-critical font-semibold mb-2">
            Error Loading Sessions
          </h3>
          <p className="text-status-critical/80 text-sm">
            {error.message || "Failed to load sessions. Please try again later."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SessionsHeader
        sessions={sortedSessions}
        totalSessions={totalSessions}
        uniqueDrivers={uniqueDrivers}
      />

      {/* Filters */}
      <Card>
        <SessionFilters
          onFilterChange={handleFilterChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="py-12 text-center">
          <div className="text-muted">
            Loading sessions...
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && sortedSessions.length === 0 && (
        <Card className="py-12 text-center">
          <Flag className="w-12 h-12 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-primary mb-2">No Sessions Found</h3>
          <p className="text-muted max-w-md mx-auto text-sm">
            {searchQuery
              ? `No sessions found for '${searchQuery}'. Try different keywords.`
              : Object.keys(filters).length > 0
              ? "No sessions match your filters. Try adjusting your search criteria."
              : "Demo data unavailable. Import a session from the iOS app or add sample data to your database."}
          </p>
        </Card>
      )}

      {/* Sessions Table */}
      {!loading && sortedSessions.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surfaceAlt border-b border-subtle">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    Track
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    Driver
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                    Laps
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                    Best Lap
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {sortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-surfaceAlt/50 transition-colors"
                  >
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="text-accent-primary hover:text-accent-primary/80 text-sm"
                      >
                        {formatDate(session.date)}
                      </Link>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col">
                        {session.track?.id ? (
                          <Link
                            href={`/tracks/${session.track.id}`}
                            className="font-medium text-primary hover:text-accent-primary text-sm"
                          >
                            {session.track.name || "Unknown Track"}
                          </Link>
                        ) : (
                          <span className="font-medium text-primary text-sm">
                            {session.track?.name || "Unknown Track"}
                          </span>
                        )}
                        {session.track?.location && (
                          <span className="text-xs text-text-subtle">
                            {session.track.location}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-muted text-sm">
                      {session.driver?.name || "Unknown"}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono text-sm text-muted">
                      {session.lapCount}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono text-sm text-status-success font-semibold">
                      {session.best_lap_ms
                        ? formatLapMs(session.best_lap_ms)
                        : "—"}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono text-sm text-muted">
                      {formatDurationMs(session.total_time_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
