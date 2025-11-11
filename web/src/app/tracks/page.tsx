import { createServerClient } from '@/lib/supabase/client';
import { formatTrackLength } from '@/lib/utils/formatters';

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const supabase = createServerClient();

  // Fetch all tracks with session count
  const { data: tracks, error } = await supabase
    .from('tracks')
    .select(`
      *,
      sessions(count)
    `)
    .order('name');

  if (error) {
    console.error('Error fetching tracks:', error);
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
          {tracks.map((track: any) => (
            <div
              key={track.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{track.name}</h3>
                  {track.config && (
                    <p className="text-sm text-gray-500 mt-1">{track.config}</p>
                  )}
                </div>
                <span className="text-2xl">🏁</span>
              </div>

              {track.location && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  📍 {track.location}
                </p>
              )}

              {track.length_meters && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  📏 {formatTrackLength(track.length_meters)}
                </p>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">
                  {track.sessions?.[0]?.count || 0} sessions recorded
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No tracks found. Add tracks via the database.
          </p>
        </div>
      )}
    </div>
  );
}
