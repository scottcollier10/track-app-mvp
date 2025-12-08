"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getDriverProgress, SessionSummary } from "@/lib/queries/driver-progress";

interface DriverProgressViewProps {
  driverId: string;
  mode: "weekend" | "track";
  trackId?: string;
  dateRange?: [string, string];
  onModeChange?: (mode: "weekend" | "track") => void;
}

interface SessionCardProps {
  session: SessionSummary;
  showDelta?: boolean;
}

/**
 * Format lap time from seconds to MM:SS.mmm
 */
function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * SessionCard - Displays individual session information with delta indicators
 */
function SessionCard({ session, showDelta = false }: SessionCardProps) {
  const paceTrendConfig = {
    improving: {
      className: "bg-green-500/20 text-green-300 border border-green-500/40",
      label: "Improving"
    },
    stable: {
      className: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
      label: "Stable"
    },
    fading: {
      className: "bg-red-500/20 text-red-300 border border-red-500/40",
      label: "Fading"
    }
  };

  const paceTrend = paceTrendConfig[session.paceTrend];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
      {/* Session Header */}
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-base font-semibold text-slate-200">{session.label}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {new Date(session.date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </p>
      </div>

      {/* Best Lap */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          Best Lap
        </p>
        <p className="text-2xl font-bold text-slate-100">
          {formatLapTime(session.bestLap)}
        </p>
        {showDelta && session.delta && (
          <p className={`text-sm font-medium mt-1 ${
            session.delta.bestLap < 0 ? 'text-green-400' : session.delta.bestLap > 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {session.delta.bestLap < 0 ? '↓' : session.delta.bestLap > 0 ? '↑' : '→'}
            {session.delta.bestLap > 0 ? '+' : ''}{session.delta.bestLap.toFixed(3)}s
          </p>
        )}
      </div>

      {/* Consistency */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          Consistency
        </p>
        <p className="text-xl font-semibold text-slate-200">
          {Math.round(session.consistencyScore)} / 100
        </p>
        {showDelta && session.delta && (
          <p className={`text-sm font-medium mt-1 ${
            session.delta.consistency > 0 ? 'text-green-400' : session.delta.consistency < 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {session.delta.consistency > 0 ? '↑' : session.delta.consistency < 0 ? '↓' : '→'}
            {session.delta.consistency > 0 ? '+' : ''}{Math.round(session.delta.consistency)} pts
          </p>
        )}
      </div>

      {/* Pace Trend */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Pace Trend
        </p>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paceTrend.className}`}>
          {paceTrend.label}
        </span>
      </div>

      {/* Lap Count */}
      <div className="pt-3 border-t border-slate-800">
        <p className="text-sm text-slate-400">
          {session.lapsCount} {session.lapsCount === 1 ? 'lap' : 'laps'}
        </p>
      </div>

      {/* View Details Link */}
      <Link
        href={`/sessions/${session.sessionId}`}
        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-orange-500/70 hover:text-white transition-colors"
      >
        View Details →
      </Link>
    </div>
  );
}

/**
 * LoadingState - Displays loading spinner
 */
function LoadingState() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500" />
        <p className="text-sm text-slate-400">Loading session data...</p>
      </div>
    </div>
  );
}

/**
 * ErrorState - Displays error message
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
      <p className="text-sm font-medium text-red-400">Error loading data</p>
      <p className="mt-1 text-xs text-slate-400">{message}</p>
    </div>
  );
}

/**
 * EmptyState - Displays when no sessions found
 */
function EmptyState({ mode }: { mode: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
      <p className="text-sm font-medium text-slate-300">No sessions found</p>
      <p className="mt-1 text-xs text-slate-500">
        {mode === "weekend"
          ? "No sessions recorded for this date range"
          : "No sessions recorded at this track"}
      </p>
    </div>
  );
}

/**
 * DriverProgressView - Main component displaying driver progress across sessions
 */
export function DriverProgressView({
  driverId,
  mode,
  trackId,
  dateRange,
  onModeChange
}: DriverProgressViewProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const data = await getDriverProgress({
          driverId,
          mode,
          trackId,
          dateRange
        });
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [driverId, mode, trackId, dateRange]);

  // Calculate summary stats
  const totalImprovement = sessions.length >= 2
    ? sessions[sessions.length - 1].bestLap - sessions[0].bestLap
    : 0;
  const trend = sessions.length > 0
    ? sessions[sessions.length - 1].paceTrend
    : "stable";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-slate-100">
          {sessions.length > 0 && sessions[0].trackName}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {mode === "weekend" && dateRange && (
            <>
              {new Date(dateRange[0]).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
              {dateRange[0] !== dateRange[1] && (
                <> - {new Date(dateRange[1]).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}</>
              )}
            </>
          )}
          {mode === "track" && sessions.length > 0 && (
            <>Track History</>
          )}
        </p>
      </header>

      {/* Mode Toggle Tabs */}
      {onModeChange && (
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => onModeChange("weekend")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "weekend"
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            This Weekend
          </button>
          <button
            onClick={() => onModeChange("track")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "track"
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Track History
          </button>
        </div>
      )}

      {/* Summary Bar */}
      {!loading && !error && sessions.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Total Improvement</p>
              <p className={`text-lg font-semibold ${
                totalImprovement < 0 ? 'text-green-400' : totalImprovement > 0 ? 'text-red-400' : 'text-slate-200'
              }`}>
                {totalImprovement > 0 ? '+' : ''}{totalImprovement.toFixed(3)}s
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trend</p>
              <div className="flex items-center gap-1">
                {trend === 'improving' && <span className="text-green-400">↑</span>}
                {trend === 'fading' && <span className="text-red-400">↓</span>}
                {trend === 'stable' && <span className="text-yellow-400">→</span>}
                <p className="text-sm font-medium text-slate-200">
                  {trend.charAt(0).toUpperCase() + trend.slice(1)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sessions</p>
              <p className="text-lg font-semibold text-slate-200">
                {sessions.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingState />}

      {/* Error State */}
      {!loading && error && <ErrorState message={error} />}

      {/* Empty State */}
      {!loading && !error && sessions.length === 0 && <EmptyState mode={mode} />}

      {/* Session Cards Grid */}
      {!loading && !error && sessions.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session, index) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              showDelta={index > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
