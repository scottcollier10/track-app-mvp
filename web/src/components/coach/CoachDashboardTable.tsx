"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { formatLapMs, formatDate } from '@/lib/time';
import { CoachDashboardDriver } from '@/data/coachDashboard';

interface CoachDashboardTableProps {
  drivers: CoachDashboardDriver[];
}

type SortColumn =
  | 'driverName'
  | 'lastTrackName'
  | 'bestLapMs'
  | 'avgBestLapMs'
  | 'consistencyScore'
  | 'behaviorScore'
  | 'sessionCount'
  | 'totalLaps'
  | 'lastSessionDate';

type SortDirection = 'asc' | 'desc';

/**
 * Format driver name from database format to display format
 */
const formatDriverName = (name: string): string => {
  if (name.includes(' ')) {
    return name;
  }

  if (name.includes('.')) {
    return name
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

export default function CoachDashboardTable({
  drivers,
}: CoachDashboardTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastSessionDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending (except for dates and lap times)
      setSortColumn(column);
      setSortDirection(
        column === 'lastSessionDate' || column === 'bestLapMs' || column === 'avgBestLapMs'
          ? 'desc'
          : 'asc'
      );
    }
  };

  // Sort and filter drivers
  const sortedAndFilteredDrivers = useMemo(() => {
    // Filter by search query
    let filtered = drivers;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = drivers.filter(
        (driver) =>
          formatDriverName(driver.driverName).toLowerCase().includes(query) ||
          driver.lastTrackName.toLowerCase().includes(query) ||
          (driver.lastSessionDate && driver.lastSessionDate.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];

      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === null) return sortDirection === 'asc' ? -1 : 1;

      // String comparison for names
      if (sortColumn === 'driverName' || sortColumn === 'lastTrackName') {
        aValue = sortColumn === 'driverName' ? formatDriverName(a.driverName) : a.lastTrackName;
        bValue = sortColumn === 'driverName' ? formatDriverName(b.driverName) : b.lastTrackName;
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Date comparison
      if (sortColumn === 'lastSessionDate') {
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // Numeric comparison
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [drivers, sortColumn, sortDirection, searchQuery]);

  // Render sort indicator
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by track, driver, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr className="border-b border-gray-700">
                {/* Driver */}
                <th
                  onClick={() => handleSort('driverName')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Driver
                    <SortIndicator column="driverName" />
                  </div>
                </th>

                {/* Track (Last Track) */}
                <th
                  onClick={() => handleSort('lastTrackName')}
                  className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Track
                    <SortIndicator column="lastTrackName" />
                  </div>
                </th>

                {/* Best Lap */}
                <th
                  onClick={() => handleSort('bestLapMs')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Best Lap
                    <SortIndicator column="bestLapMs" />
                  </div>
                </th>

                {/* Avg Best Lap */}
                <th
                  onClick={() => handleSort('avgBestLapMs')}
                  className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Avg Best Lap
                    <SortIndicator column="avgBestLapMs" />
                  </div>
                </th>

                {/* Consistency */}
                <th
                  onClick={() => handleSort('consistencyScore')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Consistency
                    <SortIndicator column="consistencyScore" />
                  </div>
                </th>

                {/* Driving Behavior */}
                <th
                  onClick={() => handleSort('behaviorScore')}
                  className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Driving Behavior
                    <SortIndicator column="behaviorScore" />
                  </div>
                </th>

                {/* Sessions */}
                <th
                  onClick={() => handleSort('sessionCount')}
                  className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Sessions
                    <SortIndicator column="sessionCount" />
                  </div>
                </th>

                {/* Total Laps */}
                <th
                  onClick={() => handleSort('totalLaps')}
                  className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Total Laps
                    <SortIndicator column="totalLaps" />
                  </div>
                </th>

                {/* Last Session */}
                <th
                  onClick={() => handleSort('lastSessionDate')}
                  className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Last Session
                    <SortIndicator column="lastSessionDate" />
                  </div>
                </th>

                {/* Action */}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedAndFilteredDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No drivers found matching your search.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredDrivers.map((driver) => {
                  // Get color coding for scores
                  const getScoreColor = (score: number): string => {
                    if (score >= 95) return 'text-green-400';
                    if (score >= 85) return 'text-blue-400';
                    if (score >= 75) return 'text-yellow-400';
                    return 'text-red-400';
                  };

                  return (
                    <tr
                      key={driver.driverId}
                      className="hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Driver */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">
                          {formatDriverName(driver.driverName)}
                        </span>
                      </td>

                      {/* Track (Last Track) */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="text-sm text-gray-300">
                          {driver.lastTrackName}
                        </span>
                      </td>

                      {/* Best Lap */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono font-semibold text-green-400">
                          {driver.bestLapMs ? formatLapMs(driver.bestLapMs) : '-'}
                        </span>
                      </td>

                      {/* Avg Best Lap */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="text-sm font-mono text-gray-300">
                          {driver.avgBestLapMs
                            ? formatLapMs(driver.avgBestLapMs)
                            : '-'}
                        </span>
                      </td>

                      {/* Consistency (as percentage) */}
                      <td className="px-4 py-3">
                        {driver.consistencyScore !== null ? (
                          <span
                            className={`text-sm font-medium ${getScoreColor(
                              driver.consistencyScore
                            )}`}
                          >
                            {driver.consistencyScore}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>

                      {/* Driving Behavior (as percentage) */}
                      <td className="hidden md:table-cell px-4 py-3">
                        {driver.behaviorScore !== null ? (
                          <span
                            className={`text-sm font-medium ${getScoreColor(
                              driver.behaviorScore
                            )}`}
                          >
                            {driver.behaviorScore}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>

                      {/* Sessions */}
                      <td className="hidden lg:table-cell px-4 py-3">
                        <span className="text-sm text-gray-300">
                          {driver.sessionCount}
                        </span>
                      </td>

                      {/* Total Laps */}
                      <td className="hidden lg:table-cell px-4 py-3">
                        <span className="text-sm text-gray-400">
                          {driver.totalLaps}
                        </span>
                      </td>

                      {/* Last Session */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="text-sm text-gray-400">
                          {driver.lastSessionDate
                            ? formatDate(driver.lastSessionDate)
                            : '-'}
                        </span>
                      </td>

                      {/* GO Button */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/drivers/${driver.driverId}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          GO
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-400 text-center">
        Showing {sortedAndFilteredDrivers.length} of {drivers.length} drivers
      </div>
    </div>
  );
}
