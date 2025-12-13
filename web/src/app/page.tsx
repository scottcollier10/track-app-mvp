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
      className="block rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-4 hover:border-slate-600/50 transition-colors shadow-[0_22px_50px_rgba(0,0,0,0.60)]"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-slate-50 mb-1">
            {session.track?.name || 'Unknown Track'}
          </div>
          <div className="text-sm text-slate-400">
            {session.driver?.name || 'Unknown Driver'}
          </div>
        </div>
        <div className="text-sm text-orange-400">
          {formatDateTime(session.date)}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-[0.18em] mb-1">Best Lap</div>
          <div className="font-mono">
            {session.best_lap_ms ? (
              <span className="text-emerald-300">{formatLapMs(session.best_lap_ms)}</span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </div>
        </div>
        <div className="text-sky-400 text-sm">
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
          <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-b from-orange-500/12 via-orange-500/4 to-slate-950/80 p-6 mb-8 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
              <div>
                <p className="text-xs md:text-sm font-semibold text-orange-400 mb-2 uppercase tracking-[0.18em]">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-lg"
            >
              View Session
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-8 text-center mb-8 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <Flag className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400 text-sm md:text-base">
              No sessions yet. Import your first session from the iOS app.
            </p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Best Lap */}
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-4 md:p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-emerald-400" />
              <span className="text-xs md:text-sm uppercase tracking-[0.18em] text-slate-400">
                Best Lap
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold font-mono text-emerald-300">
              {bestLapMs ? formatLapMs(bestLapMs) : '--'}
            </div>
          </div>

          {/* Total Sessions */}
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-4 md:p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-sky-400" />
              <span className="text-xs md:text-sm uppercase tracking-[0.18em] text-slate-400">
                Sessions
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-slate-50">
              {sessions.length}
            </div>
          </div>

          {/* Tracks Visited */}
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-4 md:p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-sky-400" />
              <span className="text-xs md:text-sm uppercase tracking-[0.18em] text-slate-400">
                Tracks
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-slate-50">
              {totalTracks || 0}
            </div>
          </div>

          {/* Total Laps */}
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-4 md:p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCcw className="w-4 h-4 text-orange-400" />
              <span className="text-xs md:text-sm uppercase tracking-[0.18em] text-slate-400">
                Total Laps
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold text-slate-50">
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
              <div className="hidden md:block rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 overflow-hidden shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-left text-sm text-slate-400 uppercase tracking-[0.18em]">
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Track</th>
                        <th className="px-6 py-3 font-medium text-right">Best Lap</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {recentSessions.map((session: any) => (
                        <tr key={session.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {formatDate(session.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-50">
                              {session.track?.name || 'Unknown Track'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {session.driver?.name || 'Unknown Driver'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold text-emerald-300">
                            {session.best_lap_ms ? formatLapMs(session.best_lap_ms) : '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link
                              href={`/sessions/${session.id}`}
                              className="text-sky-400 hover:text-sky-300 text-sm font-medium"
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
            <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-8 text-center shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <p className="text-slate-400 text-sm md:text-base">
                No sessions yet. Import a session from the iOS app to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
