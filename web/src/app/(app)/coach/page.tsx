"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Timer, TrendingUp, Activity, AlertCircle } from "lucide-react";
import DriverComparisonTable from "@/components/coach/DriverComparisonTable";
import CoachFilters, { CoachFilter } from "@/components/coach/CoachFilters";
import { formatLapMs } from "@/lib/time";

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

  // Fetch drivers data
  useEffect(() => {
    async function fetchDrivers() {
      try {
        const response = await fetch(`/api/coaches/${DEMO_COACH_ID}/drivers`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch drivers");
        }
        const data = await response.json();
        setDrivers(data.data.drivers || []);
        setCoachName(data.data.coachName);
      } catch (err) {
        console.error("Error fetching drivers:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    fetchDrivers();
  }, []);

  // Fetch comparison data
  useEffect(() => {
    async function fetchComparison() {
      try {
        setLoading(true);

        // Build query params
        const params = new URLSearchParams();
        if (filters.trackId) params.set("trackId", filters.trackId);
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);

        const queryString = params.toString();
        const url = `/api/coaches/${DEMO_COACH_ID}/comparison${
          queryString ? `?${queryString}` : ""
        }`;

        const response = await fetch(url);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch comparison data");
        }
        const data = await response.json();
        setComparison(data.data.comparison || []);
        setTracks(data.data.tracks || []);
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            Coach Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">
            Multi-driver comparison and performance tracking
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">
                Error Loading Dashboard
              </h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                Make sure the coaches table exists and you have drivers assigned to the coach.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
          Coach Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">
          {coachName
            ? `Welcome, ${coachName}. Track your drivers' progress and compare performance.`
            : "Multi-driver comparison and performance tracking"}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs md:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Drivers
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            {loading ? "-" : totalDrivers}
          </div>
        </div>

        {/* Total Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
            <span className="text-xs md:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sessions
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            {loading ? "-" : totalSessions}
          </div>
        </div>

        {/* Best Lap */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-green-500" />
            <span className="text-xs md:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Best Lap
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold font-mono text-green-600 dark:text-green-400">
            {loading || !overallBestLap ? "-" : formatLapMs(overallBestLap)}
          </div>
          {overallBestDriver && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              by {overallBestDriver}
            </p>
          )}
        </div>

        {/* Improved Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs md:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Improving
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            {loading ? "-" : `${improvedDrivers}/${totalDrivers}`}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            drivers improving
          </p>
        </div>
      </div>

      {/* Driver Quick Links */}
      {drivers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Your Drivers
          </h2>
          <div className="flex flex-wrap gap-2">
            {drivers.map((driver) => (
              <Link
                key={driver.id}
                href={`/sessions?driverId=${driver.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {driver.name}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({driver.totalSessions} sessions)
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <CoachFilters
        tracks={tracks}
        onFilterChange={setFilters}
        loading={loading}
      />

      {/* Comparison Table */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Driver Comparison by Track
        </h2>
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Loading comparison data...
            </p>
          </div>
        ) : (
          <DriverComparisonTable
            comparison={comparison}
            selectedTrackId={filters.trackId}
          />
        )}
      </div>

      {/* Total Laps Summary */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Total laps recorded: {totalLaps.toLocaleString()}
      </div>
    </div>
  );
}
