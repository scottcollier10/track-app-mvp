import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime } from '@/lib/utils/formatters';
import { formatLapMs, formatDateTime } from '@/lib/time';
import Link from 'next/link';
import { Gauge, BarChart3, Flag, RefreshCcw, ArrowRight, MapPin, Users, Timer, TrendingUp, Activity } from 'lucide-react';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // Fetch all data needed for dashboard
  const [
    { data: allSessions },
    { count: totalTracks },
    { count: totalLaps },
  ] = await Promise.all([
    (supabase
      .from('sessions') as any)
      .select(`
        *,
        driver:drivers(*),
        track:tracks(*)
      `)
      .order('date', { ascending: false }),
    (supabase.from('tracks') as any).select('*', { count: 'exact', head: true }),
    (supabase.from('laps') as any).select('*', { count: 'exact', head: true }),
  ]);

  const sessions = allSessions || [];
  const lastSession = sessions[0] || null;
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
    const { count } = await (supabase
      .from('laps') as any)
      .select('*', { count: 'exact', head: true })
      .eq('session_id', lastSession.id);
    lastSessionLapCount = count || 0;
  }

  // Mobile Card Component for Recent Sessions
  const SessionCard = ({ session }: { session: any }) => (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-gray-100 mb-1">
            {session.track?.name || 'Unknown Track'}
          </div>
          <div className="text-sm text-gray-400">
            {session.driver?.name || 'Unknown Driver'}
          </div>
        </div>
        <div className="text-sm text-red-400">
          {formatDateTime(session.date)}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Best Lap</div>
          <div className="font-mono">
            {session.best_lap_ms ? (
              <span className="text-green-400">{formatLapMs(session.best_lap_ms)}</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>
        <div className="text-blue-400 text-sm">
          View →
        </div>
      </div>
    </Link>
  );

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-2">
            Welcome to Track App coaching dashboard
          </p>
        </div>

        {/* Last Session Card */}
        {lastSession ? (
          <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/30 rounded-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
              <div>
                <p className="text-xs md:text-sm font-medium text-red-400 mb-2 uppercase tracking-wide">
                  Last Session
                </p>
                <h2 className="text-xl font-semibold text-white mb-2">
                  {lastSession.track?.name || 'Unknown Track'}
                </h2>
                <p className="text-gray-300 text-sm">
                  {lastSession.driver?.name || 'Unknown Driver'} • {formatDate(lastSession.date)}
                </p>
              </div>
              <div className="text-left md:text-right">
                {lastSession.best_lap_ms && (
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-green-400">
                    {formatLapTime(lastSession.best_lap_ms)}
                  </div>
                )}
                <p className="text-xs md:text-sm text-gray-300 mt-1">
                  Best Lap
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {lastSessionLapCount} laps
                </p>
              </div>
            </div>
            <Link
              href={`/sessions/${lastSession.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              View Session
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center mb-8">
            <Flag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-sm md:text-base">
              No sessions yet. Import your first session from the iOS app.
            </p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Best Lap */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-green-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Best Lap
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold font-mono text-green-400">
              {bestLapMs ? formatLapMs(bestLapMs) : '--'}
            </div>
          </div>

          {/* Total Sessions */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-purple-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Sessions
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {sessions.length}
            </div>
          </div>

          {/* Tracks Visited */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-blue-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Tracks
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {totalTracks || 0}
            </div>
          </div>

          {/* Total Laps */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCcw className="w-4 h-4 text-orange-500" />
              <span className="text-xs md:text-sm uppercase tracking-wide text-gray-400">
                Total Laps
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-white">
              {totalLaps || 0}
            </div>
          </div>
        </div>

        {/* Recent Sessions Table */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Sessions</h2>
            <Link
              href="/sessions"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentSessions.length > 0 ? (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-sm text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Track</th>
                        <th className="px-6 py-3 font-medium text-right">Best Lap</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {recentSessions.map((session: any) => (
                        <tr key={session.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatDate(session.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-100">
                              {session.track?.name || 'Unknown Track'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {session.driver?.name || 'Unknown Driver'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold text-green-400">
                            {session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link
                              href={`/sessions/${session.id}`}
                              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards (shown on mobile/tablet) */}
              <div className="md:hidden space-y-4">
                {recentSessions.map((session: any) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-sm md:text-base">
                No sessions yet. Import a session from the iOS app to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
