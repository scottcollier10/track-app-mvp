/**
 * Test page for Coach Dashboard Data Layer
 *
 * Temporary page to verify getCoachDashboardData() works correctly
 */

import { getCoachDashboardData } from '@/data/coachDashboard';
import { formatLapMs } from '@/lib/time';

export default async function TestCoachDataPage() {
  const { data: drivers, error } = await getCoachDashboardData();

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
        <p className="text-gray-300">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">
        Test: Coach Dashboard Data Layer
      </h1>

      <div className="mb-6">
        <p className="text-gray-400">
          Found {drivers?.length || 0} drivers
        </p>
      </div>

      <div className="space-y-4">
        {drivers?.map((driver) => (
          <div
            key={driver.driverId}
            className="bg-gray-800 rounded-lg border border-gray-700 p-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {driver.driverName}
                </h3>
                <p className="text-sm text-gray-400">{driver.driverEmail}</p>
                <p className="text-sm text-gray-400 mt-2">
                  Last Track: {driver.lastTrackName}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-400">Best Lap</p>
                <p className="text-2xl font-mono font-bold text-green-400">
                  {driver.bestLapMs ? formatLapMs(driver.bestLapMs) : '-'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
              <div>
                <p className="text-xs text-gray-500">Avg Lap</p>
                <p className="text-sm text-white font-mono">
                  {driver.avgBestLapMs ? formatLapMs(driver.avgBestLapMs) : '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Consistency</p>
                <p className="text-sm text-white">
                  {driver.consistencyScore !== null
                    ? `${driver.consistencyScore}`
                    : '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Behavior</p>
                <p className="text-sm text-white">
                  {driver.behaviorScore !== null
                    ? `${driver.behaviorScore}`
                    : '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Sessions</p>
                <p className="text-sm text-white">{driver.sessionCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-gray-500">Total Laps</p>
                <p className="text-sm text-white">{driver.totalLaps}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Last Session</p>
                <p className="text-sm text-white">
                  {driver.lastSessionDate
                    ? new Date(driver.lastSessionDate).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
