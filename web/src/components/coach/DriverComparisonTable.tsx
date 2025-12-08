"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatLapMs, formatDate } from "@/lib/time";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";

/**
 * Formats driver names from database format to display format
 * Examples:
 * - "jordan.moore" → "Jordan Moore"
 * - "Scott Collier" → "Scott Collier" (already formatted, preserve)
 * - "alex.chen" → "Alex Chen"
 */
const formatDriverName = (name: string): string => {
  // If name already has spaces (like "Scott Collier"), return as-is
  if (name.includes(' ')) {
    return name;
  }
  
  // If name has dots (like "jordan.moore"), convert to proper case
  if (name.includes('.')) {
    return name
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Fallback: capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

interface DriverTrackStats {
  driverId: string;
  driverName: string;
  trackId: string;
  trackName: string;
  sessionCount: number;
  bestLapMs: number | null;
  avgBestLapMs: number | null;
  totalLaps: number;
  lastSessionDate: string | null;
}

interface DriverComparisonTableProps {
  comparison: DriverTrackStats[];
  selectedTrackId?: string;
}

type SortField = "driverName" | "trackName" | "bestLapMs" | "sessionCount" | "totalLaps" | "lastSessionDate";
type SortDirection = "asc" | "desc";

export default function DriverComparisonTable({
  comparison,
  selectedTrackId,
}: DriverComparisonTableProps) {
  // Default sort: lastSessionDate descending (newest first) - matches Sessions page
  const [sortField, setSortField] = useState<SortField>("lastSessionDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter by track if selected
  const filteredData = useMemo(() => {
    if (!selectedTrackId) return comparison;
    return comparison.filter((item) => item.trackId === selectedTrackId);
  }, [comparison, selectedTrackId]);

  // Sort the data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "driverName":
          aVal = a.driverName.toLowerCase();
          bVal = b.driverName.toLowerCase();
          break;
        case "trackName":
          aVal = a.trackName.toLowerCase();
          bVal = b.trackName.toLowerCase();
          break;
        case "bestLapMs":
          // Null values go to the end
          if (a.bestLapMs === null) return 1;
          if (b.bestLapMs === null) return -1;
          aVal = a.bestLapMs;
          bVal = b.bestLapMs;
          break;
        case "sessionCount":
          aVal = a.sessionCount;
          bVal = b.sessionCount;
          break;
        case "totalLaps":
          aVal = a.totalLaps;
          bVal = b.totalLaps;
          break;
        case "lastSessionDate":
          // Null values go to the end
          if (a.lastSessionDate === null) return 1;
          if (b.lastSessionDate === null) return -1;
          aVal = new Date(a.lastSessionDate).getTime();
          bVal = new Date(b.lastSessionDate).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Default to ascending for names, descending for metrics and dates
      setSortDirection(
        field === "driverName" || field === "trackName" ? "asc" : "desc"
      );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  // Find best lap per track for highlighting
  const bestLapPerTrack = useMemo(() => {
    const best: Record<string, number> = {};
    for (const item of comparison) {
      if (item.bestLapMs !== null) {
        if (!best[item.trackId] || item.bestLapMs < best[item.trackId]) {
          best[item.trackId] = item.bestLapMs;
        }
      }
    }
    return best;
  }, [comparison]);

  if (sortedData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No comparison data available. Make sure drivers have recorded sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("driverName")}
              >
                Driver
                <SortIcon field="driverName" />
              </th>
              {!selectedTrackId && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("trackName")}
                >
                  Track
                  <SortIcon field="trackName" />
                </th>
              )}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("bestLapMs")}
              >
                Best Lap
                <SortIcon field="bestLapMs" />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Avg Best Lap
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("sessionCount")}
              >
                Sessions
                <SortIcon field="sessionCount" />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("totalLaps")}
              >
                Total Laps
                <SortIcon field="totalLaps" />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("lastSessionDate")}
              >
                Last Session
                <SortIcon field="lastSessionDate" />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((item, index) => {
              const isBestLap =
                item.bestLapMs !== null &&
                bestLapPerTrack[item.trackId] === item.bestLapMs;

              return (
                <tr
                  key={`${item.driverId}-${item.trackId}-${index}`}
                  className={
                    index % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50 dark:bg-gray-900"
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDriverName(item.driverName)}
                    </div>
                  </td>
                  {!selectedTrackId && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {item.trackName}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className={`text-sm font-mono ${
                        isBestLap
                          ? "text-green-600 dark:text-green-400 font-semibold"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {item.bestLapMs ? formatLapMs(item.bestLapMs) : "-"}
                      {isBestLap && (
                        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-600 dark:text-gray-300">
                      {item.avgBestLapMs ? formatLapMs(item.avgBestLapMs) : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {item.sessionCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {item.totalLaps}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {item.lastSessionDate
                        ? formatDate(item.lastSessionDate)
                        : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/sessions?driverId=${item.driverId}&trackId=${item.trackId}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 inline-flex items-center gap-1 text-sm"
                    >
                      View Sessions
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
