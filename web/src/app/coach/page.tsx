"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { formatLapMs, formatDate } from "@/lib/time";
import { formatDriverName } from "@/lib/utils/formatters";
import {
  getCoachDashboardData,
  CoachDashboardDriver,
} from "@/data/coachDashboard";
import { HeroBurst } from "@/components/ui/HeroBurst";
import { TrackAppHeader } from "@/components/TrackAppHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { BehaviorBar } from "@/components/ui/BehaviorBar";
import { ViewButton } from "@/components/ui/ViewButton";
import { Th, Td } from "@/components/ui/TableHelpers";

type SortColumn =
  | "driverName"
  | "lastTrackName"
  | "bestLapMs"
  | "avgBestLapMs"
  | "consistencyScore"
  | "behaviorScore"
  | "sessionCount"
  | "totalLaps"
  | "lastSessionDate";

type SortDirection = "asc" | "desc";


/**
 * Coach Dashboard - Dashboard B (Table View)
 *
 * Full-width table showing all drivers with their metrics
 */
export default function CoachDashboardPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<CoachDashboardDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting and filtering state
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastSessionDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch dashboard data
  useEffect(() => {
    async function fetchData() {
      console.log("[CoachDashboard] Fetching dashboard data...");
      try {
        setLoading(true);

        const { data, error: fetchError } = await getCoachDashboardData();

        if (fetchError) {
          throw fetchError;
        }

        setDrivers(data || []);
        console.log(
          `[CoachDashboard] Loaded ${data?.length || 0} driver-track combinations`
        );
      } catch (err) {
        console.error("[CoachDashboard] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending (except for dates and lap times)
      setSortColumn(column);
      setSortDirection(
        column === "lastSessionDate" ||
          column === "bestLapMs" ||
          column === "avgBestLapMs"
          ? "desc"
          : "asc"
      );
    }
  };

  // Sort and filter drivers
  const sortedAndFilteredDrivers = useMemo(() => {
    // Filter by search query
    let filtered = drivers;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = drivers.filter(
        (driver) =>
          formatDriverName(driver.driverName).toLowerCase().includes(query) ||
          driver.lastTrackName.toLowerCase().includes(query) ||
          (driver.lastSessionDate &&
            driver.lastSessionDate.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];

      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortDirection === "asc" ? 1 : -1;
      if (bValue === null) return sortDirection === "asc" ? -1 : 1;

      // String comparison for names
      if (sortColumn === "driverName" || sortColumn === "lastTrackName") {
        aValue =
          sortColumn === "driverName"
            ? formatDriverName(a.driverName)
            : a.lastTrackName;
        bValue =
          sortColumn === "driverName"
            ? formatDriverName(b.driverName)
            : b.lastTrackName;
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Date comparison
      if (sortColumn === "lastSessionDate") {
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      }

      // Numeric comparison
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [drivers, sortColumn, sortDirection, searchQuery]);

  // Calculate aggregate stats
  const totalDrivers = drivers.length;
  const totalSessions = drivers.reduce((sum, d) => sum + d.sessionCount, 0);
  const totalLaps = drivers.reduce((sum, d) => sum + d.totalLaps, 0);

  // Find overall best lap
  let overallBestLap: number | null = null;
  let overallBestDriver: string | null = null;
  let overallBestTrack: string | null = null;
  for (const driver of drivers) {
    if (
      driver.bestLapMs &&
      (overallBestLap === null || driver.bestLapMs < overallBestLap)
    ) {
      overallBestLap = driver.bestLapMs;
      overallBestDriver = formatDriverName(driver.driverName);
      overallBestTrack = driver.lastTrackName;
    }
  }

  // NEW (FIXED) - Replace with this:
  // ✅ Count drivers who are actually improving (3+ sessions, 2%+ faster)
  const improvingCount = drivers.filter(d => d.isImproving).length;


  // Calculate Top 5 / Bottom 5 by behavior score
  const top5Drivers = [...drivers]
    .sort((a, b) => (b.behaviorScore || 0) - (a.behaviorScore || 0))
    .slice(0, 5);

  const bottom5Drivers = [...drivers]
    .sort((a, b) => (a.behaviorScore || 0) - (b.behaviorScore || 0))
    .slice(0, 5);

  // Render sort indicator
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  if (error) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
              <div>
                <h3 className="mb-2 text-lg font-semibold text-rose-400">
                  Error Loading Dashboard
                </h3>
                <p className="text-slate-300">{error}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-50"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-slate-50">
      {/* Hero burst background */}
      <HeroBurst />

      {/* Global header */}
      <TrackAppHeader />

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-24">
        {/* Page header */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            Program overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Coach Dashboard
          </h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Track your drivers' progress and compare performance across tracks
          </p>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricCard
            label="Drivers"
            value={totalDrivers.toString()}
            helper="Active in program"
          />
          <MetricCard
            label="Sessions"
            value={totalSessions.toString()}
            helper="Recorded this season"
          />
          <MetricCard
            label="Best lap"
            value={overallBestLap ? formatLapMs(overallBestLap) : "-"}
            helper={
              overallBestDriver && overallBestTrack
                ? `By ${overallBestDriver} • ${overallBestTrack}`
                : "No laps recorded yet"
            }
          />
          <MetricCard
            label="Improving"
            value={`${improvingCount} / ${totalDrivers}`}
            helper="Drivers trending faster"
          />
        </section>

        {/* Top 5 / Bottom 5 cards */}
        <section className="grid gap-4 lg:grid-cols-2">
          <TopFiveCard drivers={top5Drivers} />
          <BottomFiveCard drivers={bottom5Drivers} />
        </section>

        {/* Drivers table */}
        <section>
          {drivers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-8 text-center shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
              <p className="text-slate-400">
                No driver data available. Make sure drivers have recorded
                sessions.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
              {/* Table header section */}
              <div className="border-b border-slate-800/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Drivers overview
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {sortedAndFilteredDrivers.length} drivers • sortable
                      columns
                    </p>
                  </div>
                </div>
              </div>

              {/* Search bar */}
              <div className="border-b border-slate-800/80 px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by driver, track, or date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 py-2 pl-10 pr-4 text-sm text-slate-50 placeholder-slate-400 focus:border-sky-400/70 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              {/* Table itself */}
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-1 px-2 py-2 text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <Th
                        className="cursor-pointer hover:text-slate-200"
                        onClick={() => handleSort("driverName")}
                      >
                        <div className="flex items-center gap-2">
                          Driver
                          <SortIndicator column="driverName" />
                        </div>
                      </Th>
                      <Th
                        className="cursor-pointer hover:text-slate-200"
                        onClick={() => handleSort("bestLapMs")}
                      >
                        <div className="flex items-center gap-2">
                          Best lap
                          <SortIndicator column="bestLapMs" />
                        </div>
                      </Th>
                      <Th
                        className="hidden cursor-pointer hover:text-slate-200 md:table-cell"
                        onClick={() => handleSort("avgBestLapMs")}
                      >
                        <div className="flex items-center gap-2">
                          Avg best
                          <SortIndicator column="avgBestLapMs" />
                        </div>
                      </Th>
                      <Th
                        className="cursor-pointer hover:text-slate-200"
                        onClick={() => handleSort("consistencyScore")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="hidden md:inline">Consistency</span>
                          <span className="md:hidden">CST</span>
                          <SortIndicator column="consistencyScore" />
                        </div>
                      </Th>
                      <Th
                        className="hidden cursor-pointer hover:text-slate-200 md:table-cell"
                        onClick={() => handleSort("behaviorScore")}
                      >
                        <div className="flex items-center gap-2">
                          Behavior
                          <SortIndicator column="behaviorScore" />
                        </div>
                      </Th>
                      <Th
                        className="hidden cursor-pointer hover:text-slate-200 lg:table-cell"
                        onClick={() => handleSort("sessionCount")}
                      >
                        <div className="flex items-center gap-2">
                          Sessions
                          <SortIndicator column="sessionCount" />
                        </div>
                      </Th>
                      <Th
                        className="hidden cursor-pointer hover:text-slate-200 lg:table-cell"
                        onClick={() => handleSort("totalLaps")}
                      >
                        <div className="flex items-center gap-2">
                          Total laps
                          <SortIndicator column="totalLaps" />
                        </div>
                      </Th>
                      <Th
                        className="hidden cursor-pointer hover:text-slate-200 md:table-cell"
                        onClick={() => handleSort("lastSessionDate")}
                      >
                        <div className="flex items-center gap-2">
                          Last session
                          <SortIndicator column="lastSessionDate" />
                        </div>
                      </Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredDrivers.length === 0 ? (
                      <tr>
                        <Td colSpan={9} className="py-8 text-center">
                          <span className="text-slate-400">
                            No drivers found matching your search.
                          </span>
                        </Td>
                      </tr>
                    ) : (
                      sortedAndFilteredDrivers.map((d) => (
                        <tr key={d.driverId} className="align-middle">
                          <Td>
                            <div className="flex flex-col">
                              <span className="max-w-[160px] truncate text-[13px] font-medium text-slate-50">
                                {formatDriverName(d.driverName)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {d.lastTrackName}
                              </span>
                            </div>
                          </Td>

                          <Td>
                            <span className="font-mono text-[13px] text-emerald-300">
                              {d.bestLapMs ? formatLapMs(d.bestLapMs) : "-"}
                            </span>
                          </Td>

                          <Td className="hidden md:table-cell">
                            <span className="font-mono text-[13px] text-slate-300">
                              {d.avgBestLapMs
                                ? formatLapMs(d.avgBestLapMs)
                                : "-"}
                            </span>
                          </Td>

                          <Td>
                            {d.consistencyScore !== null ? (
                              <span className="font-mono text-[13px] text-slate-200">
                                {d.consistencyScore}
                                <span className="text-[11px] text-slate-400">
                                  {" "}
                                  / 100
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </Td>

                          <Td className="hidden md:table-cell">
                            {d.behaviorScore !== null ? (
                              <BehaviorBar value={d.behaviorScore} />
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </Td>

                          <Td className="hidden lg:table-cell">
                            <span className="text-[13px] text-slate-200">
                              {d.sessionCount}
                            </span>
                          </Td>

                          <Td className="hidden lg:table-cell">
                            <span className="text-[13px] text-slate-200">
                              {d.totalLaps}
                            </span>
                          </Td>

                          <Td className="hidden md:table-cell">
                            <span className="text-[12px] text-slate-300">
                              {d.lastSessionDate
                                ? formatDate(d.lastSessionDate)
                                : "-"}
                            </span>
                          </Td>

                          <Td>
                            <ViewButton
                              variant="primary"
                              onClick={() =>
                                router.push(`/drivers/${d.driverId}`)
                              }
                            />
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="border-t border-slate-800/80 px-4 py-2 text-[11px] text-slate-500">
                Showing {sortedAndFilteredDrivers.length} of {totalDrivers}{" "}
                drivers
              </div>
            </div>
          )}
        </section>

        {/* Total Laps Summary */}
        <div className="text-center text-sm text-slate-500">
          Total laps recorded: {totalLaps.toLocaleString()}
        </div>
      </main>
    </div>
  );
}

/* ----------------- Top 5 / Bottom 5 Cards ----------------- */

function TopFiveCard({ drivers }: { drivers: CoachDashboardDriver[] }) {
  return (
    <div className="h-full rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/12 via-emerald-500/4 to-slate-950/80 px-3 py-3 md:px-4 md:py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Top 5 improving
          </p>
          <p className="text-xs text-emerald-100/90">
            High consistency and strong behavior scores.
          </p>
        </div>
        <span className="hidden md:inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-100">
          Priority: reinforce gains
        </span>
      </div>
      <div className="space-y-2">
        {drivers.map((d) => (
          <div
            key={d.driverId}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {formatDriverName(d.driverName)}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.lastTrackName} •{" "}
                {d.bestLapMs ? formatLapMs(d.bestLapMs) : "-"}
              </p>
            </div>
            {d.behaviorScore !== null && <BehaviorBar value={d.behaviorScore} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomFiveCard({ drivers }: { drivers: CoachDashboardDriver[] }) {
  return (
    <div className="h-full rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 px-3 py-3 md:px-4 md:py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200">
            Bottom 5 to watch
          </p>
          <p className="text-xs text-rose-100/90">
            Pace is fine; behavior/consistency need attention.
          </p>
        </div>
        <span className="hidden md:inline-flex rounded-full border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-[11px] font-medium text-rose-50">
          Priority: next debrief
        </span>
      </div>
      <div className="space-y-2">
        {drivers.map((d) => (
          <div
            key={d.driverId}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {formatDriverName(d.driverName)}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.lastTrackName} •{" "}
                {d.bestLapMs ? formatLapMs(d.bestLapMs) : "-"}
              </p>
            </div>
            {d.behaviorScore !== null && <BehaviorBar value={d.behaviorScore} />}
          </div>
        ))}
      </div>
    </div>
  );
}
