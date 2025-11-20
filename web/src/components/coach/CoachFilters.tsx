"use client";

import { useState } from "react";

export interface CoachFilter {
  trackId?: string;
  startDate?: string;
  endDate?: string;
}

interface CoachFiltersProps {
  tracks: Array<{ id: string; name: string }>;
  onFilterChange: (filters: CoachFilter) => void;
  loading?: boolean;
}

export default function CoachFilters({
  tracks,
  onFilterChange,
  loading = false,
}: CoachFiltersProps) {
  const [trackId, setTrackId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const handleApplyFilters = () => {
    const filters: CoachFilter = {};

    if (trackId) filters.trackId = trackId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    onFilterChange(filters);
  };

  const handleClearFilters = () => {
    setTrackId("");
    setStartDate("");
    setEndDate("");
    onFilterChange({});
  };

  const hasFilters = trackId || startDate || endDate;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Filter Comparison
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {/* Track Filter */}
        <div>
          <label
            htmlFor="coach-track-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Track
          </label>
          <select
            id="coach-track-filter"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Tracks</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label
            htmlFor="coach-start-date-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Start Date
          </label>
          <input
            type="date"
            id="coach-start-date-filter"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* End Date Filter */}
        <div>
          <label
            htmlFor="coach-end-date-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            End Date
          </label>
          <input
            type="date"
            id="coach-end-date-filter"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-end gap-2">
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleApplyFilters}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
