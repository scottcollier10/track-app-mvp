import { getTrack } from '@/data/tracks';
import { getAllSessions } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ArrowLeft, Flag, Users, Timer, MapPin, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function TrackDetailPage({ params }: PageProps) {
  const { data: track, error: trackError } = await getTrack(params.id);
  const { data: sessions, error: sessionsError } = await getAllSessions({
    trackId: params.id,
  });

  // Error state
  if (trackError || sessionsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-100">Track Detail</h1>
        <Card className="bg-red-900/20 border-red-800/50">
          <h3 className="text-red-200 font-semibold mb-2">
            Error Loading Track
          </h3>
          <p className="text-red-300 text-sm leading-relaxed">
            {trackError?.message ||
              sessionsError?.message ||
              'Failed to load track details.'}
          </p>
          <Link
            href="/tracks"
            className="inline-flex items-center gap-1 mt-4 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tracks
          </Link>
        </Card>
      </div>
    );
  }

  if (!track) {
    notFound();
  }

  const allSessions = sessions || [];

  // Calculate stats
  const totalSessions = allSessions.length;
  const uniqueDrivers = new Set(
    allSessions.map((s) => s.driver?.id).filter(Boolean)
  ).size;
  const bestLapEver = allSessions.reduce((best, session) => {
    if (session.best_lap_ms && (!best || session.best_lap_ms < best)) {
      return session.best_lap_ms;
    }
    return best;
  }, null as number | null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/tracks"
            className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tracks
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-slate-100">{track.name}</h1>
        {track.location && (
          <p className="text-slate-400 mt-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {track.location}
          </p>
        )}
        {track.length_meters && (
          <p className="text-slate-500 mt-1">
            {(track.length_meters / 1000).toFixed(2)} km
            {track.config && ` • ${track.config}`}
          </p>
        )}
      </div>

      {/* Track Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={Flag}
          label="Total Sessions"
          value={totalSessions.toString()}
        />
        <MetricCard
          icon={Users}
          label="Unique Drivers"
          value={uniqueDrivers.toString()}
        />
        <MetricCard
          icon={Timer}
          label="All-Time Best Lap"
          value={bestLapEver ? formatLapMs(bestLapEver) : '--'}
          highlight={!!bestLapEver}
        />
      </div>

      {/* Sessions at this Track */}
      <div>
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Sessions at this Track</h2>

        {allSessions.length === 0 ? (
          <Card className="text-center py-12">
            <Flag className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">No Sessions Found</h3>
            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
              No sessions have been recorded at this track yet.
            </p>
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Laps
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Best Lap
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Total Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {allSessions.map((session) => {
                    const isTrackBest =
                      session.best_lap_ms && session.best_lap_ms === bestLapEver;
                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-blue-500 hover:text-blue-400 transition-colors"
                          >
                            {formatDate(session.date)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                          {session.driver?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-slate-300">
                          {session.lapCount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                          <span
                            className={
                              isTrackBest
                                ? 'text-emerald-500 font-semibold'
                                : 'text-emerald-500'
                            }
                          >
                            {session.best_lap_ms
                              ? formatLapMs(session.best_lap_ms)
                              : '—'}
                          </span>
                          {isTrackBest && (
                            <Star className="w-3 h-3 inline ml-1 text-emerald-500" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-slate-400">
                          {formatDurationMs(session.total_time_ms)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
