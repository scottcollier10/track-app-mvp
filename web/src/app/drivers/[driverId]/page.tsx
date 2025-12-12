"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/time';
import SessionHistoryTable from '@/components/drivers/SessionHistoryTable';
import { getAllSessions, SessionWithDetails } from '@/data/sessions';
import { getDrivers, Driver } from '@/data/drivers';
import { getDriverProgressByTrack, getDriverTracks, DriverProgressData } from '@/data/driverProgress';
import ProgressStats from '@/components/drivers/ProgressStats';
import ProgressCharts from '@/components/drivers/ProgressCharts';

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

      // Auto-select first track if none selected
      if (tracks.length > 0 && !selectedTrackId) {
        setSelectedTrackId(tracks[0].id);
        console.log('[DriverProgressPage] Auto-selected track:', tracks[0].name);
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

        const result = await getDriverProgressByTrack(driverId, selectedTrackId, { after });

        if (result.error) {
          console.error('[DriverProgressPage] Progress data error:', result.error);
          setProgressData(null);
        } else {
          setProgressData(result.data);
          console.log('[DriverProgressPage] Loaded progress data:', result.data);
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
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/coach"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Coach Dashboard
          </Link>

          <div className="mt-8 rounded-lg bg-red-500/10 border border-red-500/20 p-6">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
            <p className="text-gray-300">{error || 'Driver not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Coach Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">{driver.name}</h1>
          <p className="text-gray-400 text-sm">{driver.email}</p>
        </div>

        {/* Track Selector - Phase 2 */}
        {availableTracks.length > 1 && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wide">
              Select Track:
            </label>
            <select
              value={selectedTrackId || ''}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {availableTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Session History */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Session History</h2>
          {filteredSessions.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center">
              <p className="text-gray-400">
                No sessions found for the selected time period.
              </p>
            </div>
          ) : (
            <SessionHistoryTable sessions={filteredSessions} />
          )}
        </div>

        {/* Progress Charts - Phase 2 */}
        {progressData && progressData.events.length > 0 && (
          <ProgressCharts
            events={progressData.events}
            trackName={progressData.trackName}
            seasonTarget={undefined} // Optional: Set a season target in ms, e.g., 88500 for 1:28.5
          />
        )}
      </div>
    </div>
  );
}
