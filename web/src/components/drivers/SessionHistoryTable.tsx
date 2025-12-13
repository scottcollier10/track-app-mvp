"use client";

import { useRouter } from 'next/navigation';
import { formatLapMs, formatDate } from '@/lib/time';
import { SessionWithDetails } from '@/data/sessions';
import { BehaviorBar } from '@/components/ui/BehaviorBar';
import { ViewButton } from '@/components/ui/ViewButton';
import { Th, Td } from '@/components/ui/TableHelpers';

interface SessionHistoryTableProps {
  sessions: SessionWithDetails[];
}

interface GroupedSession {
  date: string;
  trackName: string;
  trackId: string;
  sessions: SessionWithDetails[];
}

/**
 * Groups sessions by date and track (Event = Track + Date)
 */
function groupSessionsByEvent(
  sessions: SessionWithDetails[]
): GroupedSession[] {
  const grouped = new Map<string, GroupedSession>();

  sessions.forEach((session) => {
    const dateKey = session.date.split('T')[0]; // YYYY-MM-DD
    const trackId = session.track?.id || 'unknown';
    const key = `${dateKey}-${trackId}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: dateKey,
        trackName: session.track?.name || 'Unknown Track',
        trackId: trackId,
        sessions: [],
      });
    }

    grouped.get(key)!.sessions.push(session);
  });

  // Sort sessions within each group by date/time
  grouped.forEach((group) => {
    group.sessions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  });

  // Convert to array and sort by date (newest first)
  return Array.from(grouped.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

/**
 * Get source badge styling
 */
function getSourceBadge(source?: string): { label: string; className: string } {
  const s = source?.toLowerCase() || 'unknown';

  if (s.includes('ios') || s.includes('app')) {
    return {
      label: 'iOS App',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
  }
  if (s.includes('racechrono')) {
    return {
      label: 'RaceChrono',
      className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    };
  }
  if (s.includes('aim')) {
    return {
      label: 'AiM',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
  }
  if (s.includes('trackaddict')) {
    return {
      label: 'TrackAddict',
      className: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    };
  }

  return {
    label: source || 'Unknown',
    className: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
}

export default function SessionHistoryTable({
  sessions,
}: SessionHistoryTableProps) {
  const router = useRouter();
  const groupedSessions = groupSessionsByEvent(sessions);

  return (
    <div className="space-y-6">
      {groupedSessions.map((group) => (
        <div
          key={`${group.date}-${group.trackId}`}
          className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]"
        >
          {/* Event Header */}
          <div className="border-b border-slate-800/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-50">
              {group.trackName}
            </p>
            <p className="text-xs text-slate-400">
              {formatDate(group.date)} • {group.sessions.length} session
              {group.sessions.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Sessions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <Th>Session</Th>
                  <Th className="hidden md:table-cell">Source</Th>
                  <Th className="hidden md:table-cell">Laps</Th>
                  <Th>Best Lap</Th>
                  <Th>
                    <span className="hidden md:inline">Consistency</span>
                    <span className="md:hidden">CST</span>
                  </Th>
                  <Th className="hidden md:table-cell">Behavior</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {group.sessions.map((session, index) => {
                  const sourceBadge = getSourceBadge(session.source);
                  // TODO: Replace with actual consistency/behavior data when available
                  const mockConsistency = 85 + Math.floor(Math.random() * 10);
                  const mockBehavior = 75 + Math.floor(Math.random() * 20);

                  return (
                    <tr
                      key={session.id}
                      className="align-middle border-t border-slate-800/50"
                    >
                      {/* Session Number */}
                      <Td>
                        <span className="text-[13px] font-medium text-slate-50">
                          S{index + 1}
                        </span>
                      </Td>

                      {/* Source Badge */}
                      <Td className="hidden md:table-cell">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${sourceBadge.className}`}>
                          {sourceBadge.label}
                        </span>
                      </Td>

                      {/* Laps */}
                      <Td className="hidden md:table-cell">
                        <span className="text-[13px] text-slate-200">
                          {session.lapCount}
                        </span>
                      </Td>

                      {/* Best Lap */}
                      <Td>
                        <span className="font-mono text-[13px] text-emerald-300">
                          {session.best_lap_ms
                            ? formatLapMs(session.best_lap_ms)
                            : '-'}
                        </span>
                      </Td>

                      {/* Consistency */}
                      <Td>
                        <span className="font-mono text-[13px] text-slate-200">
                          {mockConsistency}
                          <span className="text-[11px] text-slate-400"> / 100</span>
                        </span>
                      </Td>

                      {/* Behavior */}
                      <Td className="hidden md:table-cell">
                        <BehaviorBar value={mockBehavior} />
                      </Td>

                      {/* ViewButton */}
                      <Td>
                        <ViewButton
                          variant="primary"
                          onClick={() => router.push(`/sessions/${session.id}`)}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
