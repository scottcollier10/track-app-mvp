"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import SessionHistoryTable from '@/components/drivers/SessionHistoryTable';
import { getAllSessions, SessionWithDetails } from '@/data/sessions';
import { getDrivers, Driver } from '@/data/drivers';
import { getDriverProgressByTrack, getDriverTracks, DriverProgressData } from '@/data/driverProgress';
import ProgressStats from '@/components/drivers/ProgressStats';
import ProgressCharts from '@/components/drivers/ProgressCharts';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

type DateFilter = 'last7' | 'last30' | 'last90' | 'thisYear' | 'allTime';

interface DriverProgressPageProps {
  params: {
    driverId: string;
  };
}

export default function DriverProgressPage({ params }: DriverProgressPageProps) {
  const { driverId } = params;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('last30');

  // Phase 2: Track selection and progression data
  const [availableTracks, setAvailableTracks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<DriverProgressData | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Fetch driver info and sessions
  useEffect(() => {
    async function fetchData() {
      console.log('[DriverProgressPage] Fetching data for driver:', driverId);
      try {
        setLoading(true);

        // Fetch driver info and sessions in parallel
        const [driversResult, sessionsResult] = await Promise.all([
          getDrivers(),
          getAllSessions({ driverId }),
        ]);

        if (driversResult.error) {
          throw new Error(driversResult.error.message);
        }
        if (sessionsResult.error) {
          throw new Error(sessionsResult.error.message);
        }

        const allDrivers = driversResult.data || [];
        const foundDriver = allDrivers.find((d) => d.id === driverId);

        if (!foundDriver) {
          throw new Error('Driver not found');
        }

        setDriver(foundDriver);
        setSessions(sessionsResult.data || []);
        console.log(
          `[DriverProgressPage] Loaded ${sessionsResult.data?.length || 0} sessions for ${foundDriver.name}`
        );
      } catch (err) {
        console.error('[DriverProgressPage] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [driverId]);

  // Apply date filter
  useEffect(() => {
    if (sessions.length === 0) {
      setFilteredSessions([]);
      return;
    }

    const now = new Date();
    let startDate: Date;

    switch (dateFilter) {
      case 'last7':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'allTime':
        setFilteredSessions(sessions);
        return;
    }

    const filtered = sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate;
    });

    console.log(
      `[DriverProgressPage] Filtered to ${filtered.length} sessions (${dateFilter})`
    );
    setFilteredSessions(filtered);
  }, [sessions, dateFilter]);

  // Phase 2: Fetch available tracks
  useEffect(() => {
    async function fetchTracks() {
      if (sessions.length === 0) return;

      // Extract unique tracks from sessions
      const tracksMap = new Map<string, { id: string; name: string }>();
      sessions.forEach((session) => {
        if (session.track) {
          tracksMap.set(session.track.id, {
            id: session.track.id,
            name: session.track.name,
          });
        }
      });

      const tracks = Array.from(tracksMap.values());
      setAvailableTracks(tracks);

      // Auto-select track with most sessions if none selected
      if (tracks.length > 0 && !selectedTrackId) {
        // Count sessions per track
        const sessionCounts = new Map<string, number>();
        sessions.forEach((session) => {
          if (session.track) {
            const count = sessionCounts.get(session.track.id) || 0;
            sessionCounts.set(session.track.id, count + 1);
          }
        });

        // Find track with most sessions
        let trackWithMostSessions = tracks[0];
        let maxSessions = 0;
        tracks.forEach((track) => {
          const count = sessionCounts.get(track.id) || 0;
          if (count > maxSessions) {
            maxSessions = count;
            trackWithMostSessions = track;
          }
        });

        setSelectedTrackId(trackWithMostSessions.id);
        console.log(
          `[DriverProgressPage] Auto-selected track with most sessions: ${trackWithMostSessions.name} (${maxSessions} sessions)`
        );
      }
    }

    fetchTracks();
  }, [sessions, selectedTrackId]);

  // Phase 2: Fetch progression data for selected track
  useEffect(() => {
    async function fetchProgressData() {
      if (!selectedTrackId || !driverId) return;

      console.log('[DriverProgressPage] Fetching progress data for track:', selectedTrackId);
      setProgressLoading(true);

      try {
        // Calculate date range based on filter
        let after: string | undefined;
        const now = new Date();

        switch (dateFilter) {
          case 'last7':
            after = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'last30':
            after = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'last90':
            after = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'thisYear':
            after = new Date(now.getFullYear(), 0, 1).toISOString();
            break;
          case 'allTime':
            after = undefined;
            break;
        }

        console.log(`[DriverProgressPage] Fetching with filter: ${dateFilter}, after: ${after}`);

        const result = await getDriverProgressByTrack(driverId, selectedTrackId, { after });

        if (result.error) {
          console.error('[DriverProgressPage] Progress data error:', result.error);
          setProgressData(null);
        } else {
          console.log(`[DriverProgressPage] Loaded progress data - ${result.data?.events?.length || 0} events for ${dateFilter} filter`);
          console.log('[DriverProgressPage] Events:', result.data?.events);
          setProgressData(result.data);
        }
      } catch (err) {
        console.error('[DriverProgressPage] Error fetching progress:', err);
        setProgressData(null);
      } finally {
        setProgressLoading(false);
      }
    }

    fetchProgressData();
  }, [driverId, selectedTrackId, dateFilter]);

  if (loading) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-24">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-24">
          <Link
            href="/coach"
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-50 transition-colors"
          >
            ← Back to Coach Dashboard
          </Link>

          <div className="mt-8 rounded-lg bg-rose-500/10 border border-rose-500/20 p-6">
            <h3 className="text-lg font-semibold text-rose-400 mb-2">Error</h3>
            <p className="text-slate-300">{error || 'Driver not found'}</p>
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
        {/* Back link */}
        <Link
          href="/coach"
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-50 transition-colors"
        >
          ← Back to Coach Dashboard
        </Link>

        {/* Page Header */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            Driver Progress
          </p>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              {formatDriverName(driver.name)}
            </h1>
            <span className="text-sm text-slate-400">
              {driver.email}
            </span>
          </div>

          {/* Track selector dropdown */}
          {availableTracks.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-300">
                Select Track:
              </label>
              <select
                value={selectedTrackId || ''}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {availableTracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Progress Stats - Phase 2 */}
        {progressData && progressData.events.length >= 2 ? (
          <ProgressStats progressData={progressData} />
        ) : progressData && progressData.events.length === 1 ? (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center mb-8">
            <p className="text-gray-400 text-lg mb-2">Not Enough Data</p>
            <p className="text-gray-500 text-sm">
              This driver needs at least 2 sessions at {progressData.trackName} to show progression stats.
            </p>
          </div>
        ) : null}

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-300">Time Period:</span>

          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
            {[
              { value: 'last7' as DateFilter, label: 'Last 7 Days' },
              { value: 'last30' as DateFilter, label: 'Last 30 Days' },
              { value: 'last90' as DateFilter, label: 'Last 90 Days' },
              { value: 'thisYear' as DateFilter, label: 'This Year' },
              { value: 'allTime' as DateFilter, label: 'All Time' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Charts - Phase 2 */}
        {progressLoading ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
            <p className="text-slate-400">Loading progress data...</p>
          </div>
        ) : progressData && progressData.events.length > 0 ? (
          <ProgressCharts
            events={progressData.events}
            trackName={progressData.trackName}
            seasonTarget={undefined} // Optional: Set a season target in ms, e.g., 88500 for 1:28.5
          />
        ) : selectedTrackId ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
            <p className="text-slate-400 mb-2">
              No progress data available for the selected time period.
            </p>
            <p className="text-slate-500 text-sm">
              Try selecting a different time range or track.
            </p>
          </div>
        ) : null}

        {/* Session History */}
        {filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
            <p className="text-slate-400">
              No sessions found for the selected time period.
            </p>
          </div>
        ) : (
          <SessionHistoryTable sessions={filteredSessions} />
        )}
      </main>
    </div>
  );
}
