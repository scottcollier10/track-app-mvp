"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Timer, TrendingUp, Activity, AlertCircle } from "lucide-react";
import DriverComparisonTable from "@/components/coach/DriverComparisonTable";
import CoachFilters, { CoachFilter } from "@/components/coach/CoachFilters";
import { formatLapMs, formatDate } from "@/lib/time";
import { getAllSessions, SessionWithDetails } from "@/data/sessions";
import { getDrivers, Driver } from "@/data/drivers";

// Demo coach ID - in production this would come from auth context
const DEMO_COACH_ID = "c1111111-1111-1111-1111-111111111111";

interface DriverWithStats {
  id: string;
  name: string;
  email: string;
  totalSessions: number;
  totalLaps: number;
  bestLapMs: number | null;
  bestLapTrack: string | null;
  improvementMs: number | null;
  lastSessionDate: string | null;
}

interface DriverTrackStats {
  driverId: string;
  driverName: string;
  trackId: string;
  trackName: string;
  sessionCount: number;
  bestLapMs: number | null;
  avgBestLapMs: number | null;
  totalLaps: number;
  lastSessionDate: string | null;
}

export default function CoachDashboardPage() {
  const [drivers, setDrivers] = useState<DriverWithStats[]>([]);
  const [comparison, setComparison] = useState<DriverTrackStats[]>([]);
  const [tracks, setTracks] = useState<Array<{ id: string; name: string }>>([]);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CoachFilter>({});

  // Mobile state
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Fetch drivers and sessions data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch all sessions and drivers using data layer
        const [sessionsResult, driversResult] = await Promise.all([
          getAllSessions(),
          getDrivers()
        ]);

        if (sessionsResult.error) {
          throw new Error(sessionsResult.error.message);
        }
        if (driversResult.error) {
          throw new Error(driversResult.error.message);
        }

        const sessions = sessionsResult.data || [];
        const allDrivers = driversResult.data || [];

        // Calculate driver stats from sessions
        const driverStats = allDrivers.map(driver => {
          const driverSessions = sessions.filter(s => s.driver?.id === driver.id);
          const totalSessions = driverSessions.length;
          const totalLaps = driverSessions.reduce((sum, s) => sum + s.lapCount, 0);

          // Find best lap
          const bestLapSession = driverSessions.reduce((best, current) => {
            if (!best?.best_lap_ms || (current.best_lap_ms && current.best_lap_ms < best.best_lap_ms)) {
              return current;
            }
            return best;
          }, null as SessionWithDetails | null);

          // Calculate improvement (compare first and last session best laps)
          const sortedSessions = driverSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const firstSession = sortedSessions[0];
          const lastSession = sortedSessions[sortedSessions.length - 1];
          let improvementMs = null;
          if (firstSession?.best_lap_ms && lastSession?.best_lap_ms && firstSession.id !== lastSession.id) {
            improvementMs = lastSession.best_lap_ms - firstSession.best_lap_ms;
          }

          return {
            ...driver,
            totalSessions,
            totalLaps,
            bestLapMs: bestLapSession?.best_lap_ms || null,
            bestLapTrack: bestLapSession?.track?.name || null,
            improvementMs,
            lastSessionDate: sortedSessions[sortedSessions.length - 1]?.date || null
          };
        });

        setDrivers(driverStats);
        setCoachName("Demo Coach"); // In production, get from auth context
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch comparison data based on filters
  useEffect(() => {
    async function fetchComparison() {
      try {
        setLoading(true);

        // Use data layer to get filtered sessions
        const sessionFilters = {
          trackId: filters.trackId,
          startDate: filters.startDate,
          endDate: filters.endDate
        };

        const sessionsResult = await getAllSessions(sessionFilters);
        if (sessionsResult.error) {
          throw new Error(sessionsResult.error.message);
        }

        const sessions = sessionsResult.data || [];

        // Transform sessions into comparison format
        const comparisonData: DriverTrackStats[] = sessions.map(session => ({
          driverId: session.driver?.id || '',
          driverName: session.driver?.name || 'Unknown',
          trackId: session.track?.id || '',
          trackName: session.track?.name || 'Unknown',
          sessionCount: 1, // Each session represents one session
          bestLapMs: session.best_lap_ms,
          avgBestLapMs: session.best_lap_ms, // For single session, best = avg
          totalLaps: session.lapCount,
          lastSessionDate: session.date
        }));

        // Get unique tracks for filter dropdown
        const uniqueTracks = Array.from(
          new Set(sessions.map(s => s.track?.id).filter(Boolean))
        ).map(trackId => {
          const session = sessions.find(s => s.track?.id === trackId);
          return {
            id: trackId!,
            name: session?.track?.name || 'Unknown'
          };
        });

        setComparison(comparisonData);
        setTracks(uniqueTracks);
      } catch (err) {
        console.error("Error fetching comparison:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchComparison();
  }, [filters]);

  // Calculate aggregate stats
  const totalDrivers = drivers.length;
  const totalSessions = drivers.reduce((sum, d) => sum + d.totalSessions, 0);
  const totalLaps = drivers.reduce((sum, d) => sum + d.totalLaps, 0);

  // Find overall best lap
  let overallBestLap: number | null = null;
  let overallBestDriver: string | null = null;
  for (const driver of drivers) {
    if (driver.bestLapMs && (overallBestLap === null || driver.bestLapMs < overallBestLap)) {
      overallBestLap = driver.bestLapMs;
      overallBestDriver = driver.name;
    }
  }

  // Count improved drivers (negative improvement means faster)
  const improvedDrivers = drivers.filter(
    (d) => d.improvementMs !== null && d.improvementMs < 0
  ).length;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Coach Dashboard</h1>
            <p className="text-gray-400 mt-2">
              Multi-driver comparison and performance tracking
            </p>
          </div>

          <div className="mt-8 rounded-lg bg-red-500/10 border border-red-500/20 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-200 font-semibold mb-1">
                  Error Loading Dashboard
                </h3>
                <p className="text-red-300 text-sm">{error}</p>
                <p className="text-red-400 text-xs mt-2">
                  Make sure the coaches table exists and you have drivers assigned to the coach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Card Component for Comparison Data
  const ComparisonCard = ({ item }: { item: DriverTrackStats }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors min-h-[100px]">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-gray-100 mb-1">
            {item.driverName}
          </div>
          <div className="text-sm text-gray-400">
            {item.trackName}
          </div>
        </div>
        <Link
          href={`/sessions?driverId=${item.driverId}&trackId=${item.trackId}`}
          className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
        >
          View Sessions
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Best Lap</div>
          <div className="font-mono">
            {item.bestLapMs ? (
              <span className="text-green-400">{formatLapMs(item.bestLapMs)}</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Laps</div>
          <div className="text-gray-300">{item.totalLaps}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Sessions</div>
          <div className="text-gray-300">{item.sessionCount}</div>
        </div>
      </div>

      {item.lastSessionDate && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            Last session: {formatDate(item.lastSessionDate)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Coach Dashboard</h1>
          <p className="text-gray-400 mt-2">
            {coachName
              ? `Welcome, ${coachName}. Track your drivers' progress and compare performance.`
              : "Multi-driver comparison and performance tracking"}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Drivers */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Drivers
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {loading ? "-" : totalDrivers}
            </div>
          </div>

          {/* Total Sessions */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-purple-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Sessions
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {loading ? "-" : totalSessions}
            </div>
          </div>

          {/* Best Lap */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-green-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Best Lap
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold font-mono text-green-400">
              {loading || !overallBestLap ? "-" : formatLapMs(overallBestLap)}
            </div>
            {overallBestDriver && (
              <p className="text-xs text-gray-500 mt-1">
                by {overallBestDriver}
              </p>
            )}
          </div>

          {/* Improved Drivers */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Improving
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {loading ? "-" : `${improvedDrivers}/${totalDrivers}`}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              drivers improving
            </p>
          </div>
        </div>

        {/* Driver Quick Links */}
        {drivers.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Your Drivers
              </h2>
              {/* Mobile collapsible toggle */}
              <button
                onClick={() => setShowAllDrivers(!showAllDrivers)}
                className="md:hidden text-gray-400 hover:text-gray-300 transition-colors"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${showAllDrivers ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                </svg>
              </button>
            </div>
            {/* Mobile: collapsible drivers display */}
            <div className="md:hidden flex flex-wrap gap-2">
              {(showAllDrivers ? drivers : drivers.slice(0, 5)).map((driver) => (
                <Link
                  key={driver.id}
                  href={`/sessions?driverId=${driver.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 transition-colors"
                >
                  {driver.name}
                  <span className="text-xs text-gray-400">
                    ({driver.totalSessions} sessions)
                  </span>
                </Link>
              ))}
              {/* Show toggle on mobile only when there are more than 5 drivers */}
              {!showAllDrivers && drivers.length > 5 && (
                <button
                  onClick={() => setShowAllDrivers(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 text-gray-400 rounded-full text-sm hover:bg-gray-600/50 transition-colors"
                >
                  +{drivers.length - 5} more
                </button>
              )}
            </div>
            {/* Desktop: always show all drivers */}
            <div className="hidden md:flex flex-wrap gap-2">
              {drivers.map((driver) => (
                <Link
                  key={driver.id}
                  href={`/sessions?driverId=${driver.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 transition-colors"
                >
                  {driver.name}
                  <span className="text-xs text-gray-400">
                    ({driver.totalSessions} sessions)
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

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
          <CoachFilters
            tracks={tracks}
            onFilterChange={setFilters}
            loading={loading}
          />
        </div>

        {/* Comparison Table/Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-white">
            Driver Comparison by Track
          </h2>
          {loading ? (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center">
              <p className="text-gray-400">
                Loading comparison data...
              </p>
            </div>
          ) : comparison.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center">
              <p className="text-gray-400">
                No comparison data available. Make sure drivers have recorded sessions.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block">
                <DriverComparisonTable
                  comparison={comparison}
                  selectedTrackId={filters.trackId}
                />
              </div>

              {/* Mobile Cards (shown on mobile/tablet) */}
              <div className="md:hidden space-y-4">
                {comparison.map((item) => (
                  <ComparisonCard key={`${item.driverId}-${item.trackId}`} item={item} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Total Laps Summary */}
        <div className="text-center text-sm text-gray-500">
          Total laps recorded: {totalLaps.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
