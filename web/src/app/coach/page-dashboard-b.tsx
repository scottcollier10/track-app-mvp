"use client";

import { useState, useEffect } from 'react';
import { Users, Timer, TrendingUp, Activity, AlertCircle } from 'lucide-react';
import CoachDashboardTable from '@/components/coach/CoachDashboardTable';
import { formatLapMs } from '@/lib/time';
import { getCoachDashboardData, CoachDashboardDriver } from '@/data/coachDashboard';

/**
 * Coach Dashboard - Dashboard B (Table View)
 *
 * Full-width table showing all drivers with their metrics
 */
export default function CoachDashboardPage() {
  const [drivers, setDrivers] = useState<CoachDashboardDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchData() {
      console.log('[CoachDashboard] Fetching dashboard data...');
      try {
        setLoading(true);

        const { data, error: fetchError } = await getCoachDashboardData();

        if (fetchError) {
          throw fetchError;
        }

        setDrivers(data || []);
        console.log(`[CoachDashboard] Loaded ${data?.length || 0} driver-track combinations`);
      } catch (err) {
        console.error('[CoachDashboard] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate aggregate stats
  const uniqueDrivers = new Set(drivers.map((d) => d.driverId)).size;
  const totalSessions = drivers.reduce((sum, d) => sum + d.sessionCount, 0);
  const totalLaps = drivers.reduce((sum, d) => sum + d.totalLaps, 0);

  // Find overall best lap
  let overallBestLap: number | null = null;
  let overallBestDriver: string | null = null;
  for (const driver of drivers) {
    if (
      driver.bestLapMs &&
      (overallBestLap === null || driver.bestLapMs < overallBestLap)
    ) {
      overallBestLap = driver.bestLapMs;
      overallBestDriver = driver.driverName;
    }
  }

  // Calculate average consistency and behavior scores
  const driversWithConsistency = drivers.filter(
    (d) => d.consistencyScore !== null
  );
  const avgConsistency =
    driversWithConsistency.length > 0
      ? Math.round(
          driversWithConsistency.reduce((sum, d) => sum + (d.consistencyScore || 0), 0) /
            driversWithConsistency.length
        )
      : null;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Coach Dashboard</h1>
            <p className="text-gray-400 mt-2">Loading your coaching data...</p>
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
            Track your drivers' progress and compare performance across tracks
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
              {uniqueDrivers}
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
              {overallBestLap ? formatLapMs(overallBestLap) : '-'}
            </div>
            {overallBestDriver && (
              <p className="text-xs text-gray-500 mt-1">
                by{' '}
                {overallBestDriver.includes('.')
                  ? overallBestDriver
                      .split('.')
                      .map(
                        (part) =>
                          part.charAt(0).toUpperCase() +
                          part.slice(1).toLowerCase()
                      )
                      .join(' ')
                  : overallBestDriver}
              </p>
            )}
          </div>

          {/* Avg Consistency */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Avg Consistency
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {avgConsistency !== null ? avgConsistency : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">across all drivers</p>
          </div>
        </div>

        {/* Driver Dashboard Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">
            All Drivers by Track
          </h2>
          {drivers.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center">
              <p className="text-gray-400">
                No driver data available. Make sure drivers have recorded sessions.
              </p>
            </div>
          ) : (
            <CoachDashboardTable drivers={drivers} />
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
