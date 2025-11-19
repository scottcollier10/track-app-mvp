import { getTracks } from '@/data/tracks';
import { getAllSessions } from '@/data/sessions';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Flag, MapPin, Ruler } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const { data: tracks, error } = await getTracks();
  const { data: allSessions } = await getAllSessions();

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-100">Tracks</h1>
        <Card className="bg-red-900/20 border-red-800/50">
          <h3 className="text-red-200 font-semibold mb-2">
            Error Loading Tracks
          </h3>
          <p className="text-red-300 text-sm leading-relaxed">
            {error.message || 'Failed to load tracks.'}
          </p>
        </Card>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Tracks</h1>
        <p className="text-slate-400 mt-2 leading-relaxed">
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
                className="block"
              >
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-slate-100">{track.name}</h3>
                      {track.config && (
                        <p className="text-sm text-slate-400 mt-1">
                          {track.config}
                        </p>
                      )}
                    </div>
                    <Flag className="w-5 h-5 text-blue-500 ml-2 flex-shrink-0" />
                  </div>

                  {track.location && (
                    <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {track.location}
                    </p>
                  )}

                  {track.length_meters && (
                    <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      {(track.length_meters / 1000).toFixed(2)} km
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-sm font-medium text-slate-300">
                      {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Flag className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No Tracks Available</h3>
          <p className="text-slate-400 leading-relaxed">
            Demo data unavailable. Add tracks via the database to get started.
          </p>
        </Card>
      )}
    </div>
  );
}
