'use client';

import SessionsSubtitle from '@/components/ui/SessionsSubtitle';
import { exportSessionsToCSV } from '@/lib/csv-export';

interface Session {
  id: string;
  date: string;
  total_time_ms: number;
  best_lap_ms: number | null;
  driver: { id: string; name: string; email: string } | null;
  track: { id: string; name: string; location: string | null } | null;
  lapCount: number;
}

interface SessionsHeaderProps {
  sessions: Session[];
  totalSessions: number;
  uniqueDrivers: number;
}

export default function SessionsHeader({
  sessions,
  totalSessions,
  uniqueDrivers
}: SessionsHeaderProps) {
  const handleExport = () => {
    exportSessionsToCSV(sessions);
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <SessionsSubtitle
          totalSessions={totalSessions}
          uniqueDrivers={uniqueDrivers}
        />
      </div>
      <button
        onClick={handleExport}
        disabled={sessions.length === 0}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium"
      >
        Export to CSV
      </button>
    </div>
  );
}
