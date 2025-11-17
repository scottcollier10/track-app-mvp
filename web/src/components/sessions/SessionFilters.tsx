"use client";

import { useState, useEffect } from "react";

export interface SessionFilter {
  trackId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
}

interface SessionFiltersProps {
  onFilterChange: (filters: SessionFilter) => void;
}

interface Track {
  id: string;
  name: string;
  location: string | null;
}

interface Driver {
  id: string;
  name: string;
}

export default function SessionFilters({ onFilterChange }: SessionFiltersProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const [trackId, setTrackId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Fetch tracks and drivers on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        setLoading(true);

        const [tracksRes, driversRes] = await Promise.all([
          fetch("/api/tracks"),
          fetch("/api/drivers"),
        ]);

        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          setTracks(tracksData.data || []);
        }

        if (driversRes.ok) {
          const driversData = await driversRes.json();
          setDrivers(driversData.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch filter options:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOptions();
  }, []);

  const handleApplyFilters = () => {
    const filters: SessionFilter = {};

    if (trackId) filters.trackId = trackId;
    if (driverId) filters.driverId = driverId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    onFilterChange(filters);
  };

  const handleClearFilters = () => {
    setTrackId("");
    setDriverId("");
    setStartDate("");
    setEndDate("");
    onFilterChange({});
  };

  const hasFilters = trackId || driverId || startDate || endDate;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Filter Sessions
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Track Filter */}
        <div>
          <label
            htmlFor="track-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Track
          </label>
          <select
            id="track-filter"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Tracks</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
                {track.location ? ` - ${track.location}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Driver Filter */}
        <div>
          <label
            htmlFor="driver-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Driver
          </label>
          <select
            id="driver-filter"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label
            htmlFor="start-date-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Start Date
          </label>
          <input
            type="date"
            id="start-date-filter"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* End Date Filter */}
        <div>
          <label
            htmlFor="end-date-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            End Date
          </label>
          <input
            type="date"
            id="end-date-filter"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Clear Filters
          </button>
        )}
        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
