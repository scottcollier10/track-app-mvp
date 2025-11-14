import { getTracks } from '@/data/tracks';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const { data: tracks, error } = await getTracks();

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Tracks</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Tracks
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message || 'Failed to load tracks.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Tracks</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Racing circuits and configurations
        </p>
      </div>

      {/* Tracks Grid */}
      {tracks && tracks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <Link
              key={track.id}
              href={`/tracks/${track.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{track.name}</h3>
                  {track.config && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {track.config}
                    </p>
                  )}
                </div>
                <span className="text-2xl ml-2">🏁</span>
              </div>

              {track.location && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  📍 {track.location}
                </p>
              )}

              {track.length_meters && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📏 {(track.length_meters / 1609.34).toFixed(2)} miles
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-4">🏁</div>
          <h3 className="text-lg font-semibold mb-2">No Tracks Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Demo data unavailable. Add tracks via the database to get started.
          </p>
        </div>
      )}
    </div>
  );
}
