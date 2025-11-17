import { getTrack } from '@/data/tracks';
import { getAllSessions } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function TrackDetailPage({ params }: PageProps) {
  const { data: track, error: trackError } = await getTrack(params.id);
  const { data: sessions, error: sessionsError } = await getAllSessions({
    trackId: params.id,
  });

  // Error state
  if (trackError || sessionsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Track Detail</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Track
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {trackError?.message ||
              sessionsError?.message ||
              'Failed to load track details.'}
          </p>
          <Link
            href="/tracks"
            className="inline-block mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            ← Back to Tracks
          </Link>
        </div>
      </div>
    );
  }

  if (!track) {
    notFound();
  }

  const allSessions = sessions || [];

  // Calculate stats
  const totalSessions = allSessions.length;
  const uniqueDrivers = new Set(
    allSessions.map((s) => s.driver?.id).filter(Boolean)
  ).size;
  const bestLapEver = allSessions.reduce((best, session) => {
    if (session.best_lap_ms && (!best || session.best_lap_ms < best)) {
      return session.best_lap_ms;
    }
    return best;
  }, null as number | null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/tracks"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Back to Tracks
          </Link>
        </div>
        <h1 className="text-3xl font-bold">{track.name}</h1>
        {track.location && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            📍 {track.location}
          </p>
        )}
        {track.length_meters && (
          <p className="text-gray-500 dark:text-gray-500 mt-1">
            {(track.length_meters / 1000).toFixed(2)} km
            {track.config && ` • ${track.config}`}
          </p>
        )}
      </div>

      {/* Track Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Sessions" value={totalSessions.toString()} />
        <StatCard label="Unique Drivers" value={uniqueDrivers.toString()} />
        <StatCard
          label="All-Time Best Lap"
          value={bestLapEver ? formatLapMs(bestLapEver) : '--'}
          highlight={!!bestLapEver}
        />
      </div>

      {/* Sessions at this Track */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Sessions at this Track</h2>

        {allSessions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-5xl mb-4">🏁</div>
            <h3 className="text-xl font-semibold mb-2">No Sessions Found</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              No sessions have been recorded at this track yet.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Laps
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Best Lap
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allSessions.map((session) => {
                    const isTrackBest =
                      session.best_lap_ms && session.best_lap_ms === bestLapEver;
                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {formatDate(session.date)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {session.driver?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                          {session.lapCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                          <span
                            className={
                              isTrackBest
                                ? 'text-green-600 dark:text-green-400 font-semibold'
                                : 'text-green-600 dark:text-green-400'
                            }
                          >
                            {session.best_lap_ms
                              ? formatLapMs(session.best_lap_ms)
                              : '—'}
                          </span>
                          {isTrackBest && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ★
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatDurationMs(session.total_time_ms)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {label}
      </div>
      <div
        className={`text-3xl font-mono font-bold ${
          highlight ? 'text-green-600 dark:text-green-400' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
