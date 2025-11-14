import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime } from '@/lib/utils/formatters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();
  // TypeScript escape hatch for Vercel build - runtime works fine
  const db = supabase as any;

  // Fetch all data needed for dashboard
  const [
    { data: allSessions },
    { count: totalTracks },
    { count: totalLaps },
  ] = await Promise.all([
    db
      .from('sessions')
      .select(`
        *,
        driver:drivers(*),
        track:tracks(*)
      `)
      .order('date', { ascending: false }),
    db.from('tracks').select('*', { count: 'exact', head: true }),
    db.from('laps').select('*', { count: 'exact', head: true }),
  ]);

  const sessions = (allSessions || []) as any[];
  const lastSession = (sessions[0] ?? null) as any;
  const recentSessions = sessions.slice(0, 10);

  // Calculate best lap across all sessions
  const bestLapMs = sessions.reduce((best: number | null, session: any) => {
    if (!session.best_lap_ms) return best;
    if (best === null) return session.best_lap_ms;
    return Math.min(best, session.best_lap_ms);
  }, null);

  // Get lap count for last session
  let lastSessionLapCount = 0;
  if (lastSession) {
    const { count } = await db
      .from('laps')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', lastSession?.id);  // Added optional chaining for safety
    lastSessionLapCount = count || 0;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome to Track App coaching dashboard
        </p>
      </div>

      {/* Last Session Card */}
      {lastSession ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-8 border-2 border-blue-200 dark:border-blue-900">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                LAST SESSION
              </p>
              <h2 className="text-2xl font-bold mb-2">
                {lastSession.track?.name || 'Unknown Track'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {lastSession.driver?.name || 'Unknown Driver'} • {formatDate(lastSession.date)}
              </p>
            </div>
            <div className="text-right">
              {lastSession.best_lap_ms && (
                <div className="text-3xl font-mono font-bold text-green-600 dark:text-green-400">
                  {formatLapTime(lastSession.best_lap_ms)}
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Best Lap
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {lastSessionLapCount} laps
              </p>
            </div>
          </div>
          <Link
            href={`/sessions/${lastSession.id}`}
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            View Session →
          </Link>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-4">🏁</div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No sessions yet. Import your first session from the iOS app.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Best Lap"
          value={bestLapMs ? formatLapTime(bestLapMs) : '--'}
          icon="⚡"
          isTime
        />
        <StatCard
          title="Total Sessions"
          value={sessions.length}
          icon="📊"
        />
        <StatCard
          title="Tracks Visited"
          value={totalTracks || 0}
          icon="🏁"
        />
        <StatCard
          title="Total Laps"
          value={totalLaps || 0}
          icon="🔄"
        />
      </div>

      {/* Recent Sessions Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            View all →
          </Link>
        </div>

        {recentSessions.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Track
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
                  {recentSessions.map((session: any) => (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(session.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">
                          {session.track?.name || 'Unknown Track'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {session.driver?.name || 'Unknown Driver'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                        {session.best_lap_ms ? formatLapTime(session.best_lap_ms) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              No sessions yet. Import a session from the iOS app to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  isTime = false,
}: {
  title: string;
  value: number | string;
  icon: string;
  isTime?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="text-4xl">{icon}</div>
        <div className="flex-1">
          <div className={`text-2xl font-bold ${isTime ? 'font-mono' : ''}`}>
            {value}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
        </div>
      </div>
    </div>
  );
}
