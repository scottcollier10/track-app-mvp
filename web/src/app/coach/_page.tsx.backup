import { createServerClient } from '@/lib/supabase/server';
import { formatLapMs, formatDate } from '@/lib/time';
import Link from 'next/link';

// Helper function: Format driver names
function formatDriverName(name: string): string {
  if (!name) return 'Unknown Driver';
  return name
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

// Helper function: Get color classes for source badges
function getSourceBadgeColor(source: string): string {
  switch (source?.toLowerCase()) {
    case 'ios_app':
      return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'racechrono':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'aim':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'trackaddict':
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  }
}

// Helper function: Format source name for display
function formatSourceName(source: string): string {
  switch (source?.toLowerCase()) {
    case 'ios_app': return 'iOS App';
    case 'racechrono': return 'RaceChrono';
    case 'aim': return 'AiM';
    case 'trackaddict': return 'TrackAddict';
    default: return source || 'Generic';
  }
}

export default async function CoachDashboardPage() {
  const supabase = createServerClient();

  // Fetch all sessions with driver and track info
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id,
      date,
      best_lap_ms,
      total_time_ms,
      source,
      drivers (
        id,
        name
      ),
      tracks (
        id,
        name
      ),
      laps (count)
    `)
    .order('date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching sessions:', error);
  }

  // Calculate stats
  const totalDrivers = sessions 
    ? new Set(sessions.map(s => s.drivers?.id)).size 
    : 0;
  
  const totalSessions = sessions?.length || 0;
  
  const bestSession = sessions?.reduce((best, current) => 
    !best || (current.best_lap_ms && current.best_lap_ms < best.best_lap_ms) 
      ? current 
      : best
  , null as typeof sessions[0] | null);

  // Calculate drivers improving (sessions in last 30 days with improvement)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSessions = sessions?.filter(s => 
    new Date(s.date) >= thirtyDaysAgo
  ) || [];
  const driversImproving = new Set(recentSessions.map(s => s.drivers?.id)).size;

  // Prepare comparison data (driver × track)
  const comparisonData = sessions?.map(session => ({
    id: session.id,
    driver_id: session.drivers?.id,
    driver_name: session.drivers?.name || 'Unknown',
    track_id: session.tracks?.id,
    track_name: session.tracks?.name || 'Unknown',
    best_lap_ms: session.best_lap_ms,
    lap_count: session.laps?.[0]?.count || 0,
    date: session.date,
    source: session.source
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Coach Dashboard</h1>
        <p className="text-gray-400">
          Track your drivers' progress and compare performance
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">👥 Drivers</div>
          <div className="text-2xl font-bold text-white">{totalDrivers}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">⚡ Sessions</div>
          <div className="text-2xl font-bold text-white">{totalSessions}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">🏁 Best Lap</div>
          <div className="text-lg font-bold text-green-400">
            {bestSession ? formatLapMs(bestSession.best_lap_ms) : '-'}
          </div>
          {bestSession && (
            <div className="text-xs text-gray-500 mt-1">
              by {formatDriverName(bestSession.drivers?.name || '')}
            </div>
          )}
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">📈 Improving</div>
          <div className="text-2xl font-bold text-white">
            {driversImproving}/{totalDrivers}
          </div>
          <div className="text-xs text-gray-500 mt-1">drivers improving</div>
        </div>
      </div>

      {/* Driver Comparison Section */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Driver Comparison by Track
        </h2>

        {comparisonData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No sessions found</p>
            <p className="text-sm text-gray-600 mt-2">
              Sessions will appear here once drivers start recording
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                    <th className="px-4 py-3 font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Track</th>
                    <th className="px-4 py-3 font-medium">Best Lap</th>
                    <th className="px-4 py-3 font-medium text-center">Laps</th>
                    <th className="px-4 py-3 font-medium">Last Session</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {comparisonData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-4 text-white font-medium">
                        {formatDriverName(item.driver_name)}
                      </td>
                      <td className="px-4 py-4 text-gray-300">
                        {item.track_name}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-green-400 font-semibold">
                          {formatLapMs(item.best_lap_ms)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-white">
                        {item.lap_count}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-sm">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-4 py-4">
                        {item.source && (
                          <span className={`
                            px-2 py-1 text-xs font-medium rounded
                            ${getSourceBadgeColor(item.source)}
                          `}>
                            {formatSourceName(item.source)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/sessions/${item.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View Session
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards - Hidden on desktop */}
            <div className="md:hidden space-y-4">
              {comparisonData.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                >
                  {/* Driver Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {formatDriverName(item.driver_name)}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{item.track_name}</span>
                      </div>
                    </div>
                    {item.source && (
                      <span className={`
                        px-2 py-1 text-xs font-medium rounded shrink-0
                        ${getSourceBadgeColor(item.source)}
                      `}>
                        {formatSourceName(item.source)}
                      </span>
                    )}
                  </div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-gray-800 rounded p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Best Lap
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        {formatLapMs(item.best_lap_ms)}
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Laps
                      </div>
                      <div className="text-lg font-bold text-white">
                        {item.lap_count}
                      </div>
                    </div>
                  </div>

                  {/* Session Details */}
                  <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-700">
                    <div className="text-gray-400">
                      {formatDate(item.date)}
                    </div>
                    <Link
                      href={`/sessions/${item.id}`}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <span>View</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
