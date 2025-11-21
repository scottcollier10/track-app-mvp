'use client';

import Link from 'next/link';
import SessionsSubtitle from '@/components/ui/SessionsSubtitle';
import { exportSessionsToCSV } from '@/lib/csv-export';
import { Button } from '@/components/ui/Button';
import { Download, ArrowLeft } from 'lucide-react';
import { useCoachView } from '@/context/coach-view';

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
  driverId?: string;
}

export default function SessionsHeader({
  sessions,
  totalSessions,
  uniqueDrivers,
  driverId
}: SessionsHeaderProps) {
  const { coachView } = useCoachView();
  const handleExport = () => {
    exportSessionsToCSV(sessions);
  };

  // Show back button only when driverId is present AND coach view is enabled
  const showBackButton = driverId && coachView;

  return (
    <div className="space-y-4">
      {/* Back to Coach Dashboard Button */}
      {showBackButton && (
        <div>
          <Link
            href="/coach"
            className="inline-flex items-center gap-2 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Coach Dashboard
          </Link>
        </div>
      )}

      {/* Header Content */}
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
    </div>
  );
}
