'use client';

/**
 * Export Button Component
 *
 * Allows users to export session data to CSV format
 */

import { useState } from 'react';
import type { SessionWithDetails } from '@/data/sessions';
import { exportSessionsToCSV } from '@/lib/csv-export';

export interface ExportButtonProps {
  sessions: SessionWithDetails[];
  disabled?: boolean;
}

export default function ExportButton({ sessions, disabled = false }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (disabled || sessions.length === 0) {
      return;
    }

    setIsExporting(true);

    try {
      exportSessionsToCSV(sessions);

      // Reset loading state after a brief delay
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || sessions.length === 0 || isExporting;

  return (
    <button
      onClick={handleExport}
      disabled={isDisabled}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        ${
          isDisabled
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95'
        }
      `}
      aria-label="Export sessions to CSV"
    >
      {/* Download Icon */}
      <svg
        className={`w-5 h-5 ${isExporting ? 'animate-bounce' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>

      {/* Button Text */}
      <span>{isExporting ? 'Exporting...' : 'Export to CSV'}</span>
    </button>
  );
}
