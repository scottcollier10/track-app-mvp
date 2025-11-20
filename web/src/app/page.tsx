import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime } from '@/lib/utils/formatters';
import Link from 'next/link';
import { Gauge, BarChart3, Flag, RefreshCcw, ArrowRight, MapPin, Clock } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { HeroCard, HeroCardHeader, HeroCardStats } from '@/components/ui/HeroCard';
import { Button } from '@/components/ui/Button';

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

  // Calculate total time (sum of all session durations)
  const totalTimeMs = sessions.reduce((total: number, session: any) => {
    return total + (session.duration_ms || 0);
  }, 0);

  const formatTotalTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-background-darkest">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-2 text-sm md:text-base">
            Welcome to Track App coaching dashboard
          </p>
        </div>

        {/* Hero Card - Last Session */}
        {lastSession ? (
          <HeroCard>
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
              <HeroCardHeader
                label="Last Session"
                title={lastSession.track?.name || 'Unknown Track'}
                subtitle={`${lastSession.driver?.name || 'Unknown Driver'} • ${formatDate(lastSession.date)}`}
              />
              {lastSession.best_lap_ms && (
                <HeroCardStats
                  primaryValue={formatLapTime(lastSession.best_lap_ms)}
                  primaryLabel="Best Lap"
                  secondaryValue={`${lastSessionLapCount} laps`}
                />
              )}
            </div>
            <Link href={`/sessions/${lastSession.id}`}>
              <Button icon={ArrowRight} iconPosition="right">
                View Session
              </Button>
            </Link>
          </HeroCard>
        ) : (
          <div className="bg-background-card rounded-lg p-8 md:p-12 text-center border border-background-elevated">
            <Flag className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary text-sm md:text-base">
              No sessions yet. Import your first session from the iOS app.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            icon={Gauge}
            label="Best Lap"
            value={bestLapMs ? formatLapTime(bestLapMs) : '--'}
            color="green"
          />
          <StatCard
            icon={BarChart3}
            label="Sessions"
            value={sessions.length}
            color="blue"
          />
          <StatCard
            icon={Flag}
            label="Laps"
            value={totalLaps || 0}
            color="default"
          />
          <StatCard
            icon={Clock}
            label="Total Time"
            value={totalTimeMs > 0 ? formatTotalTime(totalTimeMs) : '--'}
            color="default"
          />
        </div>

        {/* Recent Sessions Table */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Recent Sessions</h2>
            <Link
              href="/sessions"
              className="text-blue-default hover:text-blue-light text-sm font-medium flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentSessions.length > 0 ? (
            <div className="bg-background-card rounded-lg overflow-hidden border border-background-elevated">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background-elevated">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Track
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Driver
                      </th>
                      <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Best Lap
                      </th>
                      <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-elevated">
                    {recentSessions.map((session: any) => (
                      <tr key={session.id} className="hover:bg-background-elevated/50 transition-colors">
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {formatDate(session.date)}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">
                            {session.track?.name || 'Unknown Track'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {session.driver?.name || 'Unknown Driver'}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold text-green-default">
                          {session.best_lap_ms ? formatLapTime(session.best_lap_ms) : '--'}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-blue-default hover:text-blue-light text-sm font-medium transition-colors"
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
          ) : (
            <div className="bg-background-card rounded-lg p-8 md:p-12 text-center border border-background-elevated">
              <p className="text-text-secondary text-sm md:text-base">
                No sessions yet. Import a session from the iOS app to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
