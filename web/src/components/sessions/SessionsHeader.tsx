'use client';

import SessionsSubtitle from '@/components/ui/SessionsSubtitle';
import { exportSessionsToCSV } from '@/lib/csv-export';
import { Button } from '@/components/ui/Button';
import { Download } from 'lucide-react';

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
        <h1 className="text-2xl md:text-3xl font-semibold text-primary">Sessions</h1>
        <SessionsSubtitle
          totalSessions={totalSessions}
          uniqueDrivers={uniqueDrivers}
        />
      </div>
      <Button
        onClick={handleExport}
        disabled={sessions.length === 0}
        icon={Download}
        variant="primary"
      >
        Export to CSV
      </Button>
    </div>
  );
}
