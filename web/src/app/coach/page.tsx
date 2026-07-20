"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertCircle, Search } from "lucide-react";
import { formatLapMs } from "@/lib/time";
import { formatDriverName } from "@/lib/utils/formatters";
import type { CoachDashboardStudent } from "@/data/coachDashboard";
import { HeroBurst } from "@/components/ui/HeroBurst";
import { TrackAppHeader } from "@/components/TrackAppHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { TriageQueue } from "@/components/coach/TriageQueue";
import { RosterByRunGroup } from "@/components/coach/RosterByRunGroup";

/**
 * Coach Dashboard — three zones over one row per student:
 * 1. KPI strip, 2. Triage queue (who needs a debrief), 3. Roster by run group.
 */
export default function CoachDashboardPage() {
  const [students, setStudents] = useState<CoachDashboardStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const res = await fetch("/api/coach/dashboard");
        const json = await res.json();

        if (!res.ok || json.error) {
          throw new Error(json.error || "Failed to load dashboard data");
        }

        const data: CoachDashboardStudent[] = json.data || [];
        setStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Aggregate KPIs across the whole roster (unfiltered).
  const kpis = useMemo(() => {
    const totalStudents = students.length;
    const totalSessions = students.reduce((sum, s) => sum + s.sessionCount, 0);
    const needsDebrief = students.filter((s) => s.flags.length > 0).length;
    const progressing = students.filter((s) => s.ready).length;

    let bestLapMs: number | null = null;
    let bestDriver: string | null = null;
    let bestTrack: string | null = null;
    for (const s of students) {
      if (s.bestLapMs && (bestLapMs === null || s.bestLapMs < bestLapMs)) {
        bestLapMs = s.bestLapMs;
        bestDriver = formatDriverName(s.driverName);
        bestTrack = s.lastTrackName;
      }
    }

    return {
      totalStudents,
      totalSessions,
      needsDebrief,
      progressing,
      bestLapMs,
      bestDriver,
      bestTrack,
    };
  }, [students]);

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
      <HeroBurst />
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
            Track your students&apos; progress and spot who needs a debrief next.
          </p>
        </header>

        {/* KPI strip */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          <MetricCard
            label="Drivers"
            value={kpis.totalStudents.toString()}
            helper="Active in program"
          />
          <MetricCard
            label="Sessions"
            value={kpis.totalSessions.toString()}
            helper="Recorded this season"
          />
          <MetricCard
            label="Best lap"
            value={kpis.bestLapMs ? formatLapMs(kpis.bestLapMs) : "-"}
            helper={
              kpis.bestDriver && kpis.bestTrack
                ? `By ${kpis.bestDriver} • ${kpis.bestTrack}`
                : "No laps recorded yet"
            }
          />
          <MetricCard
            label="Needs debrief"
            value={kpis.needsDebrief.toString()}
            helper="Broke from their pattern"
          />
          <MetricCard
            label="Progressing"
            value={kpis.progressing.toString()}
            helper="Ready to advance"
          />
        </section>

        {/* Triage queue */}
        <TriageQueue students={students} />

        {/* Roster search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search roster by student or track..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 py-2 pl-10 pr-4 text-sm text-slate-50 placeholder-slate-400 focus:border-sky-400/70 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        {/* Roster by run group */}
        {students.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-8 text-center shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
            <p className="text-slate-400">
              No student data available. Make sure students have recorded
              sessions.
            </p>
          </div>
        ) : (
          <RosterByRunGroup students={students} searchQuery={searchQuery} />
        )}
      </main>
    </div>
  );
}
