import { getTracks } from '@/data/tracks';
import { getAllSessions } from '@/data/sessions';
import Link from 'next/link';
import { HeroBurst } from '@/components/ui/HeroBurst';
import { TrackAppHeader } from '@/components/TrackAppHeader';

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const { data: tracks, error } = await getTracks();
  const { data: allSessions } = await getAllSessions();

  // Error state
  if (error) {
    return (
      <div className="relative min-h-screen text-slate-50">
        <HeroBurst />
        <TrackAppHeader />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-50">Tracks</h1>
            <div className="rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-500/16 via-rose-500/6 to-slate-950/80 p-6 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <h3 className="text-rose-400 font-semibold mb-2">
                Error Loading Tracks
              </h3>
              <p className="text-slate-300 text-sm">
                {error.message || 'Failed to load tracks.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Count sessions per track
  const sessionCountByTrack = (allSessions || []).reduce((acc, session) => {
    if (session.track?.id) {
      acc[session.track.id] = (acc[session.track.id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="relative min-h-screen text-slate-50">
      <HeroBurst />
      <TrackAppHeader />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-slate-50">Tracks</h1>
            <p className="text-slate-400 mt-2">
              Racing circuits and configurations
            </p>
          </div>

          {/* Tracks Grid */}
          {tracks && tracks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tracks.map((track) => {
                const sessionCount = sessionCountByTrack[track.id] || 0;
                return (
                  <Link
                    key={track.id}
                    href={`/tracks/${track.id}`}
                    className="block rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-6 hover:border-slate-600/50 transition-all shadow-[0_22px_50px_rgba(0,0,0,0.60)]"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-slate-50">{track.name}</h3>
                        {track.config && (
                          <p className="text-sm text-slate-400 mt-1">
                            {track.config}
                          </p>
                        )}
                      </div>
                      <span className="text-2xl ml-2">🏁</span>
                    </div>

                    {track.location && (
                      <p className="text-sm text-slate-300 mb-2">
                        📍 {track.location}
                      </p>
                    )}

                    {track.length_meters && (
                      <p className="text-sm text-slate-300 mb-2">
                        📏 {(track.length_meters / 1000).toFixed(2)} km
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-800/80">
                      <p className="text-sm font-medium text-slate-200">
                        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-12 text-center shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
              <div className="text-5xl mb-4">🏁</div>
              <h3 className="text-lg font-semibold mb-2 text-slate-50">No Tracks Available</h3>
              <p className="text-slate-400">
                Demo data unavailable. Add tracks via the database to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
