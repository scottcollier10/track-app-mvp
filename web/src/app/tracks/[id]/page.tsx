import { getTrack } from '@/data/tracks';
import { formatDate, formatLapMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function TrackDetailPage({ params }: PageProps) {
  const { data: track, error } = await getTrack(params.id);

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Track Detail</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Track
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message || 'Failed to load track details.'}
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

  const recentSessions = track.recentSessions || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/tracks"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Tracks
          </Link>
        </div>
        <h1 className="text-3xl font-bold">{track.name}</h1>
        {track.config && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">{track.config}</p>
        )}
      </div>

      {/* Track Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InfoCard
          label="Location"
          value={track.location || 'Unknown'}
          icon="📍"
        />
        <InfoCard
          label="Length"
          value={
            track.length_meters
              ? `${(track.length_meters / 1609.34).toFixed(2)} miles`
              : '--'
          }
          icon="📏"
        />
        <InfoCard
          label="Sessions"
          value={recentSessions.length.toString()}
          icon="🏁"
        />
      </div>

      {/* Recent Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">Recent Sessions</h2>
        </div>

        {recentSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Lap
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentSessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDate(session.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.driver?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                      {session.best_lap_ms
                        ? formatLapMs(session.best_lap_ms)
                        : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No sessions recorded at this track yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
        <span>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
