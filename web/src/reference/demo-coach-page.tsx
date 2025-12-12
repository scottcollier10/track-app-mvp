"use client";

import React from "react";
import Image from "next/image";
import heroBurst from "@/public/images/hero-burst-app.webp";

type DriverRow = {
  id: number;
  name: string;
  track: string;
  bestLap: string;
  avgBestLap: string;
  consistency: number;
  behavior: number;
  sessions: number;
  totalLaps: number;
  lastSession: string;
};

const DRIVERS: DriverRow[] = [
  {
    id: 1,
    name: "Taylor Brooks",
    track: "Buttonwillow Raceway",
    bestLap: "1:33.100",
    avgBestLap: "1:36.200",
    consistency: 99,
    behavior: 78,
    sessions: 9,
    totalLaps: 116,
    lastSession: "Dec 15, 2025",
  },
  {
    id: 2,
    name: "Marc Richardson",
    track: "Thunderhill Raceway",
    bestLap: "1:28.500",
    avgBestLap: "1:31.467",
    consistency: 99,
    behavior: 79,
    sessions: 12,
    totalLaps: 198,
    lastSession: "Dec 15, 2025",
  },
  {
    id: 3,
    name: "Cole Trickle",
    track: "Streets of Willow",
    bestLap: "1:29.000",
    avgBestLap: "1:29.000",
    consistency: 99,
    behavior: 90,
    sessions: 1,
    totalLaps: 42,
    lastSession: "Dec 10, 2025",
  },
  {
    id: 4,
    name: "Sofia Martinez",
    track: "Sonoma Raceway",
    bestLap: "1:29.200",
    avgBestLap: "1:31.800",
    consistency: 99,
    behavior: 80,
    sessions: 8,
    totalLaps: 141,
    lastSession: "Dec 9, 2025",
  },
  {
    id: 5,
    name: "Jordan Lee",
    track: "Sonoma Raceway",
    bestLap: "1:32.450",
    avgBestLap: "1:32.458",
    consistency: 99,
    behavior: 74,
    sessions: 1,
    totalLaps: 15,
    lastSession: "Dec 8, 2025",
  },
  {
    id: 6,
    name: "Alex Chen",
    track: "Buttonwillow Raceway",
    bestLap: "1:27.150",
    avgBestLap: "1:27.158",
    consistency: 99,
    behavior: 81,
    sessions: 2,
    totalLaps: 20,
    lastSession: "Dec 5, 2025",
  },
  {
    id: 7,
    name: "Jamie Rodriguez",
    track: "Laguna Seca",
    bestLap: "1:31.280",
    avgBestLap: "1:31.280",
    consistency: 98,
    behavior: 71,
    sessions: 2,
    totalLaps: 16,
    lastSession: "Dec 3, 2025",
  },
  {
    id: 8,
    name: "Scott Collier",
    track: "Laguna Seca",
    bestLap: "1:30.890",
    avgBestLap: "1:30.890",
    consistency: 99,
    behavior: 84,
    sessions: 5,
    totalLaps: 19,
    lastSession: "Dec 2, 2025",
  },
  {
    id: 9,
    name: "Jordan Moore",
    track: "Streets of Willow",
    bestLap: "1:24.762",
    avgBestLap: "1:24.762",
    consistency: 99,
    behavior: 82,
    sessions: 1,
    totalLaps: 10,
    lastSession: "Dec 2, 2025",
  },
  {
    id: 10,
    name: "Tyler Durden",
    track: "Laguna Seca",
    bestLap: "1:32.800",
    avgBestLap: "1:34.700",
    consistency: 99,
    behavior: 75,
    sessions: 9,
    totalLaps: 121,
    lastSession: "Dec 1, 2025",
  },
];

const TOP_5 = DRIVERS.slice(0, 5);
const BOTTOM_5 = [DRIVERS[6], DRIVERS[5], DRIVERS[4], DRIVERS[9], DRIVERS[1]];

export default function CoachPage() {
  return (
    <div className="min-h-screen bg-slate-850 text-slate-40">
      {/* Burst background (same treatment as landing hero) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src={heroBurst}
          alt=""
          fill
          priority
          className="object-cover opacity-80"
        />
        {/* Darken edges so the table text stays readable */}
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>


      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-10">
        {/* Page header */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            Program overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Program overview at a glance
          </h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Track 12–15 drivers per weekend, see who&apos;s improving, and
            spot coaching priorities in seconds—not after the event.
          </p>
        </header>

        {/* KPI cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Drivers" value="28" helper="Active in program" />
          <MetricCard
            label="Sessions"
            value="86"
            helper="Recorded this season"
          />
          <MetricCard
            label="Best lap"
            value="1:01.646"
            helper="By Cole Trickle • Streets of Willow"
          />
          <MetricCard
            label="Improving"
            value="25 / 28"
            helper="Drivers trending faster"
          />
        </section>

        {/* NEW layout: Top 5 / Bottom 5 row ABOVE the table */}
        <section className="grid gap-4 lg:grid-cols-2">
          <TopFiveCard drivers={TOP_5} />
          <BottomFiveCard drivers={BOTTOM_5} />
        </section>

        {/* Drivers table */}
        <section>
          <DriversTable drivers={DRIVERS} />
        </section>
      </main>
    </div>
  );
}

/* ----------------- small components ----------------- */

function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.75)] backdrop-blur">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {props.label}
      </p>
      <p className="text-2xl font-semibold text-slate-50">{props.value}</p>
      <p className="mt-1 text-xs text-slate-400">{props.helper}</p>
    </div>
  );
}

function BehaviorBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const width = `${clamped}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-slate-700/80">
        {/* main fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300"
          style={{ width }}
        />
        {/* subtle ring to sharpen edges */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-slate-900/80" />
      </div>
      <span className="text-xs tabular-nums text-slate-300">{value}%</span>
    </div>
  );

  /**
   * If you want to experiment with other looks, here are two quick swaps:
   *
   * 1) Soft gradient (more subtle than the original rainbow):
   *
   *  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300"
   *
   * 2) Discrete "ticks" instead of a single bar (mini segments):
   *
   *  <div className="flex gap-[2px]">
   *    {Array.from({ length: 10 }).map((_, i) => {
   *      const filled = (i + 1) * 10 <= clamped;
   *      return (
   *        <div
   *          key={i}
   *          className={
   *            "h-2 w-2 rounded-[3px] " +
   *            (filled ? "bg-emerald-400" : "bg-slate-800")
   *          }
   *        />
   *      );
   *    })}
   *  </div>
   */
}

function TopFiveCard({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="h-full rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/12 via-emerald-500/4 to-slate-950/80 px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Top 5 improving
          </p>
          <p className="text-xs text-emerald-100/90">
            High consistency and strong behavior scores.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-100">
          Priority: reinforce gains
        </span>
      </div>
      <div className="space-y-2">
        {drivers.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {d.name}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.track} • {d.bestLap}
              </p>
            </div>
            <BehaviorBar value={d.behavior} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomFiveCard({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="h-full rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200">
            Bottom 5 to watch
          </p>
          <p className="text-xs text-rose-100/90">
            Pace is fine; behavior/consistency need attention.
          </p>
        </div>
        <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-[11px] font-medium text-rose-50">
          Priority: next debrief
        </span>
      </div>
      <div className="space-y-2">
        {drivers.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-50">
                {d.name}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {d.track} • {d.bestLap}
              </p>
            </div>
            <BehaviorBar value={d.behavior} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DriversTable({ drivers }: { drivers: DriverRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
      <div className="border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Drivers overview
            </p>
            <p className="text-[11px] text-slate-400">
              Sorted by last session date • demo slice of 10 drivers
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200">
            CSV import · RaceChrono
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-1 px-2 py-2 text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              <Th>Driver</Th>
              <Th>Track</Th>
              <Th>Best lap</Th>
              <Th>Avg best</Th>
              <Th>Consistency</Th>
              <Th>Behavior</Th>
              <Th className="hidden md:table-cell">Sessions</Th>
              <Th className="hidden lg:table-cell">Total laps</Th>
              <Th>Last session</Th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="align-middle">
                <Td>
                  <div className="flex flex-col">
                    <span className="max-w-[160px] truncate text-[13px] font-medium text-slate-50">
                      {d.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Driver {d.id}
                    </span>
                  </div>
                </Td>
                <Td>
                  <span className="max-w-[160px] truncate text-[13px] text-slate-200">
                    {d.track}
                  </span>
                </Td>
                <Td>
                  <span className="font-mono text-[13px] text-emerald-300">
                    {d.bestLap}
                  </span>
                </Td>
                <Td>
                  <span className="font-mono text-[13px] text-slate-300">
                    {d.avgBestLap}
                  </span>
                </Td>
                <Td>
                  <span className="font-mono text-[13px] text-slate-200">
                    {d.consistency}
                    <span className="text-[11px] text-slate-400"> / 100</span>
                  </span>
                </Td>
                <Td>
                  <BehaviorBar value={d.behavior} />
                </Td>
                <Td className="hidden md:table-cell">
                  <span className="text-[13px] text-slate-200">
                    {d.sessions}
                  </span>
                </Td>
                <Td className="hidden lg:table-cell">
                  <span className="text-[13px] text-slate-200">
                    {d.totalLaps}
                  </span>
                </Td>
                <Td>
                  <span className="text-[12px] text-slate-300">
                    {d.lastSession}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-800/80 px-4 py-2 text-[11px] text-slate-500">
        Showing {drivers.length} of 28 drivers · demo slice
      </div>
    </div>
  );
}

function Th(props: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th
      className={
        "px-4 py-2 text-left text-[11px] font-medium uppercase tracking-[0.18em] " +
        (props.className ?? "")
      }
    >
      {props.children}
    </th>
  );
}

function Td(props: React.PropsWithChildren<{ className?: string }>) {
  return (
    <td
      className={
        "px-4 py-2 align-middle text-[13px] text-slate-200 " +
        (props.className ?? "")
      }
    >
      {props.children}
    </td>
  );
}
