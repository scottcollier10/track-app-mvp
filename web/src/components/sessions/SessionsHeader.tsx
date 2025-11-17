'use client';

/**
 * Sessions Header Component
 *
 * Header section with title, subtitle, and export button
 */

import type { SessionWithDetails } from '@/data/sessions';
import SessionsSubtitle from '@/components/ui/SessionsSubtitle';
import ExportButton from './ExportButton';

interface SessionsHeaderProps {
  sessions: SessionWithDetails[];
  totalSessions: number;
  uniqueDrivers: number;
}

export default function SessionsHeader({
  sessions,
  totalSessions,
  uniqueDrivers,
}: SessionsHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      {/* Left side - Title and subtitle */}
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <SessionsSubtitle
          totalSessions={totalSessions}
          uniqueDrivers={uniqueDrivers}
        />
      </div>

      {/* Right side - Export button */}
      <div className="flex-shrink-0">
        <ExportButton sessions={sessions} />
      </div>
    </div>
  );
}
