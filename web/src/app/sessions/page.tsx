import { getRecentSessions } from "@/data/sessions";
import { formatDate, formatLapMs, formatDurationMs } from "@/lib/time";
import Link from "next/link";
import SessionsHeader from "@/components/sessions/SessionsHeader";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { data: sessions, error } = await getRecentSessions(50);

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Browse all track sessions
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-900 dark:text-red-200 font-semibold mb-2">
            Error Loading Sessions
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message ||
              "Failed to load sessions. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!sessions || sessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Browse all track sessions
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-4">🏁</div>
          <h3 className="text-xl font-semibold mb-2">No Sessions Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Demo data unavailable. Import a session from the iOS app or add
            sample data to your database.
          </p>
        </div>
      </div>
    );
  }

  // Derived counts for subtitle
  const totalSessions = sessions.length;
  const uniqueDrivers = new Set(
    sessions.map((s) => s.driver?.name || "Unknown")
  ).size;

  // Success state - render sessions table
  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <SessionsHeader
        sessions={sessions}
        totalSessions={totalSessions}
        uniqueDrivers={uniqueDrivers}
      />

      {/* Sessions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Laps
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Lap
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/sessions/${session.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {formatDate(session.date)}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {session.track?.name || "Unknown Track"}
                      </span>
                      {session.track?.location && (
                        <span className="text-sm text-gray-500">
                          {session.track.location}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    {session.driver?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                    {session.lapCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-green-600 dark:text-green-400 font-semibold">
                    {session.best_lap_ms
                      ? formatLapMs(session.best_lap_ms)
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600 dark:text-gray-400">
                    {formatDurationMs(session.total_time_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
