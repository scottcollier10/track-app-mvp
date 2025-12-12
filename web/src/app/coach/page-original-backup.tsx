"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Timer, TrendingUp, Activity, AlertCircle } from "lucide-react";
import DriverComparisonTable from "@/components/coach/DriverComparisonTable";
import CoachFilters, { CoachFilter } from "@/components/coach/CoachFilters";
import { formatLapMs, formatDate } from "@/lib/time";
import { getAllSessions, SessionWithDetails } from "@/data/sessions";
import { getDrivers, Driver } from "@/data/drivers";
import { getDriverProgress } from "@/lib/queries/driver-progress";

// Demo coach ID - in production this would come from auth context
const DEMO_COACH_ID = "c1111111-1111-1111-1111-111111111111";

/**
 * Formats driver names from database format to display format
 * Examples:
 * - "jordan.moore" → "Jordan Moore"
 * - "Scott Collier" → "Scott Collier" (already formatted, preserve)
 * - "alex.chen" → "Alex Chen"
 */
const formatDriverName = (name: string): string => {
  // If name already has spaces (like "Scott Collier"), return as-is
  if (name.includes(' ')) {
    return name;
  }
  
  // If name has dots (like "jordan.moore"), convert to proper case
  if (name.includes('.')) {
    return name
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Fallback: capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

interface DriverProgressSummary {
  driver: {
    id: string;
    name: string;
  };
  improvement: number;
  status: 'improved' | 'stable' | 'regressed';
  sessionCount: number;
}

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

// Weekend Progress Widget
function WeekendProgressWidget({ date, drivers }: { date: string, drivers: Driver[] }) {
  const [driversProgress, setDriversProgress] = useState<DriverProgressSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeekendProgress() {
      // For each driver, check if they have multiple sessions today
      const progressPromises = drivers.map(async (driver) => {
        try {
          const sessions = await getDriverProgress({
            driverId: driver.id,
            mode: "weekend",
            dateRange: [date, date]
          });

          if (sessions.length < 2) return null; // Need at least 2 sessions to compare

          const firstSession = sessions[0];
          const lastSession = sessions[sessions.length - 1];
          const improvement = firstSession.bestLap - lastSession.bestLap; // negative = faster

          return {
            driver: {
              id: driver.id,
              name: driver.name
            },
            improvement,
            status: improvement > 0.1 ? 'improved' : improvement < -0.1 ? 'regressed' : 'stable',
            sessionCount: sessions.length
          } as DriverProgressSummary;
        } catch (error) {
          console.error(`Error loading progress for ${driver.name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(progressPromises);
      const filtered = results.filter(Boolean) as DriverProgressSummary[];
      setDriversProgress(filtered);
      setLoading(false);
    }

    if (drivers.length > 0) {
      loadWeekendProgress();
    }
  }, [date, drivers]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          Weekend Progress
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500" />
        </div>
      </div>
    );
  }

  const improvedCount = driversProgress.filter(d => d.status === 'improved').length;
  const totalCount = driversProgress.length;

  if (totalCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          Weekend Progress
        </h3>
        <p className="text-sm text-slate-500">
          No drivers with multiple sessions today
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
        Weekend Progress
      </h3>

      <p className="mb-4 text-sm text-slate-300">
        <span className="font-semibold text-green-400">{improvedCount} / {totalCount}</span>
        {' '}drivers improved session-to-session today
      </p>

      <div className="space-y-2">
        {driversProgress.map(({ driver, improvement, status, sessionCount }) => (
          <Link
            key={driver.id}
            href={`/test-progress?driverId=${driver.id}&mode=weekend&date=${date}`}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              {status === 'improved' && (
                <span className="text-green-400 text-base">✓</span>
              )}
              {status === 'stable' && (
                <span className="text-yellow-400 text-base">⚠</span>
              )}
              {status === 'regressed' && (
                <span className="text-red-400 text-base">✗</span>
              )}

              <span className="text-sm font-medium text-slate-200">
                {formatDriverName(driver.name)}
              </span>

              <span className={`text-xs ${
                improvement > 0 ? 'text-green-400' :
                improvement < 0 ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                ({improvement > 0 ? '↓' : improvement < 0 ? '↑' : '→'} {Math.abs(improvement).toFixed(3)}s)
              </span>

              <span className="text-xs text-slate-500">
                {sessionCount} sessions
              </span>
            </div>

            <span className="text-xs text-slate-500">View →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Driver Chips Section with status badges
function DriverChipsSection({
  drivers,
  date,
  showAllDrivers,
  onToggle
}: {
  drivers: Driver[],
  date: string,
  showAllDrivers: boolean,
  onToggle: () => void
}) {
  const [driverStatuses, setDriverStatuses] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatuses() {
      const statusPromises = drivers.map(async (driver): Promise<[string, any]> => {
        try {
          const sessions = await getDriverProgress({
            driverId: driver.id,
            mode: "weekend",
            dateRange: [date, date]
          });

          if (sessions.length < 2) {
            return [driver.id, { status: 'stable', sessionCount: sessions.length, improvement: 0 }];
          }

          const firstSession = sessions[0];
          const lastSession = sessions[sessions.length - 1];
          const improvement = firstSession.bestLap - lastSession.bestLap;

          const status = improvement > 0.1 ? 'improved' :
                        improvement < -0.1 ? 'regressed' :
                        'stable';

          return [driver.id, { status, sessionCount: sessions.length, improvement }];
        } catch (error) {
          return [driver.id, { status: 'stable', sessionCount: 0, improvement: 0 }];
        }
      });

      const results = await Promise.all(statusPromises);
      setDriverStatuses(new Map(results));
      setLoading(false);
    }

    if (drivers.length > 0) {
      loadStatuses();
    }
  }, [drivers, date]);

  const renderDriverChip = (driver: Driver) => {
    const statusInfo = driverStatuses.get(driver.id) || {
      status: 'stable',
      sessionCount: 0,
      improvement: 0
    };

    return (
      <Link
        key={driver.id}
        href={`/test-progress?driverId=${driver.id}&mode=track`}
        className={`group relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          statusInfo.status === 'improved'
            ? 'border-green-500/50 bg-green-500/10 text-green-300 hover:border-green-500'
            : statusInfo.status === 'regressed'
            ? 'border-red-500/50 bg-red-500/10 text-red-300 hover:border-red-500'
            : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600'
        }`}
      >
        {/* Status indicator dot */}
        {statusInfo.sessionCount >= 2 && (
          <span className={`h-1.5 w-1.5 rounded-full ${
            statusInfo.status === 'improved' ? 'bg-green-400' :
            statusInfo.status === 'regressed' ? 'bg-red-400' :
            'bg-yellow-400'
          }`} />
        )}

        {formatDriverName(driver.name)}

        {/* Session count badge */}
        {statusInfo.sessionCount > 0 && (
          <span className="text-[10px] text-gray-500">
            ({statusInfo.sessionCount})
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile: collapsible drivers display */}
      <div className="md:hidden flex flex-wrap gap-2">
        {(showAllDrivers ? drivers : drivers.slice(0, 5)).map(renderDriverChip)}
        {/* Show toggle on mobile only when there are more than 5 drivers */}
        {!showAllDrivers && drivers.length > 5 && (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 text-gray-400 rounded-full text-sm hover:bg-gray-600/50 transition-colors"
          >
            +{drivers.length - 5} more
          </button>
        )}
      </div>
      {/* Desktop: always show all drivers */}
      <div className="hidden md:flex flex-wrap gap-2">
        {drivers.map(renderDriverChip)}
      </div>
    </>
  );
}

// ComparisonCard component for mobile view
function ComparisonCard({ item }: { item: DriverTrackStats }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {formatDriverName(item.driverName)}
          </h3>
          <p className="text-sm text-gray-400">{item.trackName}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-semibold text-green-400">
            {item.bestLapMs ? formatLapMs(item.bestLapMs) : "-"}
          </div>
          <p className="text-xs text-gray-500">Best Lap</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Sessions</p>
          <p className="text-sm font-semibold text-white">{item.sessionCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Laps</p>
          <p className="text-sm font-semibold text-white">{item.totalLaps}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Last Session</p>
          <p className="text-sm font-semibold text-white">
            {item.lastSessionDate ? formatDate(item.lastSessionDate) : "-"}
          </p>
        </div>
      </div>

      <Link
        href={`/sessions?driverId=${item.driverId}&trackId=${item.trackId}`}
        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm transition-colors"
      >
        View Sessions
      </Link>
    </div>
  );
}

export default function CoachDashboardPage() {
  const [drivers, setDrivers] = useState<DriverWithStats[]>([]);
  const [comparison, setComparison] = useState<DriverTrackStats[]>([]);
  const [tracks, setTracks] = useState<Array<{ id: string; name: string }>>([]);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CoachFilter>({});

  // Weekend progress state
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [weekendStats, setWeekendStats] = useState({ improved: 0, total: 0 });
  const today = new Date().toISOString().split('T')[0];

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

        // Store all drivers for weekend progress widget
        setAllDrivers(allDrivers);

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

        // Transform sessions into comparison format - AGGREGATE by driver-track
        const driverTrackMap = new Map<string, DriverTrackStats>();
        
        sessions.forEach(session => {
          const driverId = session.driver?.id || '';
          const trackId = session.track?.id || '';
          const key = `${driverId}-${trackId}`;
          
          const existing = driverTrackMap.get(key);
          
          if (existing) {
            // Aggregate multiple sessions for same driver-track
            existing.sessionCount += 1;
            existing.totalLaps += session.lapCount;
            
            // Update best lap if this session is faster
            if (session.best_lap_ms && (!existing.bestLapMs || session.best_lap_ms < existing.bestLapMs)) {
              existing.bestLapMs = session.best_lap_ms;
            }
            
            // Update last session date if newer
            if (new Date(session.date) > new Date(existing.lastSessionDate || '1970-01-01')) {
              existing.lastSessionDate = session.date;
            }
            
            // Recalculate average best lap
            // Collect all best laps for this driver-track and average them
            const allBestLaps = sessions
              .filter(s => s.driver?.id === driverId && s.track?.id === trackId && s.best_lap_ms)
              .map(s => s.best_lap_ms!);
            
            if (allBestLaps.length > 0) {
              existing.avgBestLapMs = Math.round(
                allBestLaps.reduce((sum, lap) => sum + lap, 0) / allBestLaps.length
              );
            }
          } else {
            // First session for this driver-track combination
            driverTrackMap.set(key, {
              driverId: driverId,
              driverName: session.driver?.name || 'Unknown',
              trackId: trackId,
              trackName: session.track?.name || 'Unknown',
              sessionCount: 1,
              bestLapMs: session.best_lap_ms,
              avgBestLapMs: session.best_lap_ms,
              totalLaps: session.lapCount,
              lastSessionDate: session.date
            });
          }
        });
        
        const comparisonData = Array.from(driverTrackMap.values());

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

  // Calculate weekend stats
  useEffect(() => {
    async function loadWeekendStats() {
      if (allDrivers.length === 0) return;

      let improvedCount = 0;
      let totalWithMultipleSessions = 0;

      for (const driver of allDrivers) {
        const sessions = await getDriverProgress({
          driverId: driver.id,
          mode: "weekend",
          dateRange: [today, today]
        });

        if (sessions.length >= 2) {
          totalWithMultipleSessions++;
          const improvement = sessions[0].bestLap - sessions[sessions.length - 1].bestLap;
          if (improvement > 0.1) improvedCount++;
        }
      }

      setWeekendStats({ improved: improvedCount, total: totalWithMultipleSessions });
    }

    loadWeekendStats();
  }, [allDrivers, today]);

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
                <h3 className="text-lg font-semibold text-red-400 mb-2">
                  Error Loading Dashboard
                </h3>
                <p className="text-gray-300">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && drivers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Coach Dashboard</h1>
            <p className="text-gray-400 mt-2">
              Loading your coaching data...
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

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
              {totalDrivers}
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
              {totalSessions}
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
              {overallBestLap ? formatLapMs(overallBestLap) : "-"}
            </div>
            {overallBestDriver && (
              <p className="text-xs text-gray-500 mt-1">
                by {formatDriverName(overallBestDriver)}
              </p>
            )}
          </div>

          {/* Improved Drivers - Weekend Trend */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Weekend Trend
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {weekendStats.total > 0 ? `${weekendStats.improved}/${weekendStats.total}` : `${improvedDrivers}/${totalDrivers}`}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {weekendStats.total > 0 ? 'improving this weekend' : 'drivers improving'}
            </p>
          </div>
        </div>

        {/* Weekend Progress Widget */}
        {allDrivers.length > 0 && (
          <div className="mb-8">
            <WeekendProgressWidget date={today} drivers={allDrivers} />
          </div>
        )}

        {/* Driver Quick Links */}
        {drivers.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8">
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
            <DriverChipsSection
              drivers={allDrivers}
              date={today}
              showAllDrivers={showAllDrivers}
              onToggle={() => setShowAllDrivers(!showAllDrivers)}
            />
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
          {comparison.length === 0 ? (
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
                {Array.isArray(comparison) && comparison.map((item) => (
                  <ComparisonCard key={`${item.driverId}-${item.trackId}`} item={item} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Total Laps Summary */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Total laps recorded: {totalLaps.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
