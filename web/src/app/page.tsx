import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime } from '@/lib/utils/formatters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // Fetch dashboard stats
  const [
    { count: totalSessions },
    { count: totalDrivers },
    { count: totalTracks },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('tracks').select('*', { count: 'exact', head: true }),
    supabase
      .from('sessions')
      .select(`
        *,
        driver:drivers(*),
        track:tracks(*)
      `)
      .order('date', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome to Track App coaching dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Sessions"
          value={totalSessions || 0}
          icon="📊"
        />
        <StatCard
          title="Active Drivers"
          value={totalDrivers || 0}
          icon="👤"
        />
        <StatCard
          title="Tracks"
          value={totalTracks || 0}
          icon="🏁"
        />
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="text-track-blue hover:underline text-sm"
          >
            View all →
          </Link>
        </div>

        {recentSessions && recentSessions.length > 0 ? (
          <div className="space-y-4">
            {recentSessions.map((session: any) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {session.track?.name || 'Unknown Track'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {session.driver?.name || 'Unknown Driver'} •{' '}
                      {formatDate(session.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    {session.best_lap_ms && (
                      <div className="text-lg font-mono font-semibold text-track-green">
                        {formatLapTime(session.best_lap_ms)}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Best Lap
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No sessions yet. Import a session from the iOS app to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="text-4xl">{icon}</div>
        <div>
          <div className="text-3xl font-bold">{value}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
        </div>
      </div>
    </div>
  );
}
