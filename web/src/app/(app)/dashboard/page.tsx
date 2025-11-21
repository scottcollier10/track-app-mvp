import { createServerClient } from '@/lib/supabase/client';
import { formatDate, formatLapTime } from '@/lib/utils/formatters';
import Link from 'next/link';
import { Gauge, BarChart3, Flag, RefreshCcw, ArrowRight, MapPin } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="text-muted mt-2 text-sm md:text-base">
          Welcome to Track App coaching dashboard
        </p>
      </div>

      {/* Last Session Card */}
      {lastSession ? (
        <Card className="bg-gradient-to-br from-accent-primarySoft to-surface border-accent-primary/30">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
            <div>
              <p className="text-xs md:text-sm font-medium text-accent-primary mb-2 uppercase tracking-wide">
                Last Session
              </p>
              <h2 className="text-xl font-semibold text-primary mb-2">
                {lastSession.track?.name || 'Unknown Track'}
              </h2>
              <p className="text-muted text-sm">
                {lastSession.driver?.name || 'Unknown Driver'} • {formatDate(lastSession.date)}
              </p>
            </div>
            <div className="text-left md:text-right">
              {lastSession.best_lap_ms && (
                <div className="text-2xl md:text-3xl font-mono font-semibold text-status-success">
                  {formatLapTime(lastSession.best_lap_ms)}
                </div>
              )}
              <p className="text-xs md:text-sm text-muted mt-1">
                Best Lap
              </p>
              <p className="text-xs text-text-subtle mt-1">
                {lastSessionLapCount} laps
              </p>
            </div>
          </div>
          <Link href={`/sessions/${lastSession.id}`}>
            <Button icon={ArrowRight} iconPosition="right">
              View Session
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="text-center py-8 md:py-12">
          <Flag className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted text-sm md:text-base">
            No sessions yet. Import your first session from the iOS app.
          </p>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard
          icon={Gauge}
          label="Best Lap"
          value={bestLapMs ? formatLapTime(bestLapMs) : '--'}
          highlight
        />
        <MetricCard
          icon={BarChart3}
          label="Total Sessions"
          value={sessions.length}
        />
        <MetricCard
          icon={Flag}
          label="Tracks Visited"
          value={totalTracks || 0}
        />
        <MetricCard
          icon={RefreshCcw}
          label="Total Laps"
          value={totalLaps || 0}
        />
      </div>

      {/* Recent Sessions Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="text-accent-primary hover:text-accent-primary/80 text-sm font-medium flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentSessions.length > 0 ? (
          <Card noPadding className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surfaceAlt">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                      Track
                    </th>
                    <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                      Best Lap
                    </th>
                    <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {recentSessions.map((session: any) => (
                    <tr key={session.id} className="hover:bg-surfaceAlt/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDate(session.date)}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary">
                          {session.track?.name || 'Unknown Track'}
                        </div>
                        <div className="text-xs text-text-subtle">
                          {session.driver?.name || 'Unknown Driver'}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-semibold text-status-success">
                        {session.best_lap_ms ? formatLapTime(session.best_lap_ms) : '--'}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="text-accent-primary hover:text-accent-primary/80 text-sm font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-8 md:py-12">
            <p className="text-muted text-sm md:text-base">
              No sessions yet. Import a session from the iOS app to get started.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
