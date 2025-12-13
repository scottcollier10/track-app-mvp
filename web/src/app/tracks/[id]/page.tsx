import { getTrack } from '@/data/tracks';
import { getAllSessions } from '@/data/sessions';
import { formatDate, formatLapMs, formatDurationMs } from '@/lib/time';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

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
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-50">Track Detail</h1>
            <div className="rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <h3 className="text-rose-400 font-semibold mb-2">
                Error Loading Track
              </h3>
              <p className="text-slate-300 text-sm">
                {trackError?.message ||
                  sessionsError?.message ||
                  'Failed to load track details.'}
              </p>
              <Link
                href="/tracks"
                className="inline-block mt-4 text-sm text-sky-400 hover:text-sky-300"
              >
                ← Back to Tracks
              </Link>
            </div>
          </div>
        </div>
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
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/tracks"
                className="text-sky-400 hover:text-sky-300 text-sm"
              >
                ← Back to Tracks
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-slate-50">{track.name}</h1>
            {track.location && (
              <p className="text-slate-300 mt-2">
                📍 {track.location}
              </p>
            )}
            {track.length_meters && (
              <p className="text-slate-400 mt-1">
                {(track.length_meters / 1000).toFixed(2)} km
                {track.config && ` • ${track.config}`}
              </p>
            )}
          </div>

          {/* Track Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Total Sessions" value={totalSessions.toString()} />
            <StatCard label="Unique Drivers" value={uniqueDrivers.toString()} />
            <StatCard
              label="All-Time Best Lap"
              value={bestLapEver ? formatLapMs(bestLapEver) : '--'}
              highlight={!!bestLapEver}
            />
          </div>

          {/* Sessions at this Track */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-slate-50">Sessions at this Track</h2>

        {allSessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-12 text-center shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="text-5xl mb-4">🏁</div>
            <h3 className="text-xl font-semibold mb-2 text-slate-50">No Sessions Found</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              No sessions have been recorded at this track yet.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 overflow-hidden shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-800/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-[0.18em]">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-[0.18em]">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-[0.18em]">
                      Laps
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-[0.18em]">
                      Best Lap
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-[0.18em]">
                      Total Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {allSessions.map((session) => {
                    const isTrackBest =
                      session.best_lap_ms && session.best_lap_ms === bestLapEver;
                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-sky-400 hover:text-sky-300"
                          >
                            {formatDate(session.date)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {session.driver?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-slate-200">
                          {session.lapCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                          <span
                            className={
                              isTrackBest
                                ? 'text-emerald-300 font-semibold'
                                : 'text-emerald-300'
                            }
                          >
                            {session.best_lap_ms
                              ? formatLapMs(session.best_lap_ms)
                              : '—'}
                          </span>
                          {isTrackBest && (
                            <span className="ml-2 text-xs text-emerald-300">
                              ★
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-slate-300">
                          {formatDurationMs(session.total_time_ms)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
      <div className="text-sm text-slate-400 mb-2">
        {label}
      </div>
      <div
        className={`text-3xl font-mono font-bold ${
          highlight ? 'text-emerald-300' : 'text-slate-50'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
