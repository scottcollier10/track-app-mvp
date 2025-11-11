import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime, formatDuration } from '@/lib/utils/formatters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const supabase = createServerClient();

  // Fetch all sessions with relations
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      *,
      driver:drivers(*),
      track:tracks(*),
      laps(count)
    `)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
  }

  // Fetch all tracks for filter
  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .order('name');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse and filter all track sessions
        </p>
      </div>

      {/* Filters */}
      {/* TODO: Add client-side filters for track and date range */}

      {/* Sessions List */}
      {sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session: any) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                {/* Session Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {session.track?.name || 'Unknown Track'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {session.driver?.name || 'Unknown Driver'} •{' '}
                    {formatDate(session.date)}
                  </p>
                  {session.track?.location && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      📍 {session.track.location}
                    </p>
                  )}
                </div>

                {/* Session Stats */}
                <div className="flex gap-6">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Laps
                    </div>
                    <div className="font-mono font-semibold">
                      {session.laps?.[0]?.count || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total Time
                    </div>
                    <div className="font-mono font-semibold">
                      {formatDuration(session.total_time_ms)}
                    </div>
                  </div>
                  {session.best_lap_ms && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Best Lap
                      </div>
                      <div className="font-mono font-semibold text-track-green">
                        {formatLapTime(session.best_lap_ms)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No sessions found. Import a session from the iOS app to get started.
          </p>
        </div>
      )}
    </div>
  );
}
