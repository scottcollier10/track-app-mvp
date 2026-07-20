import Link from 'next/link';
import { ArrowUpRight, Activity } from 'lucide-react';
import type { CoachDashboardStudent } from '@/data/coachDashboard';
import { formatLapMs, formatDate } from '@/lib/time';
import { formatDriverName } from '@/lib/utils/formatters';
import { Th, Td } from '@/components/ui/TableHelpers';
import { StudentSparkline } from './StudentSparkline';
import {
  RUN_GROUP_BANDS,
  RUN_GROUP_LABELS,
  toRunGroupBand,
  type RunGroupBand,
} from './runGroups';

interface RosterByRunGroupProps {
  students: CoachDashboardStudent[];
  searchQuery?: string;
}

/** ±0.Xs consistency, e.g. ±0.4s. "-" when null (building baseline). */
function formatConsistency(seconds: number | null): string {
  if (seconds === null) return '-';
  return `±${seconds.toFixed(1)}s`;
}

function matchesSearch(student: CoachDashboardStudent, query: string): boolean {
  return (
    formatDriverName(student.driverName).toLowerCase().includes(query) ||
    student.lastTrackName.toLowerCase().includes(query)
  );
}

/**
 * The full roster, grouped into Novice / Intermediate / Advanced bands. Each
 * band shows a count, a blue "ready to advance" callout, then honest per-student
 * columns: best lap, consistency (±0.Xs), trend, sessions, last session. No
 * behavior bars, no 0-100 scores, no gap-to-ideal (that lives on driver detail).
 */
export function RosterByRunGroup({
  students,
  searchQuery,
}: RosterByRunGroupProps) {
  const query = searchQuery?.trim().toLowerCase() ?? '';
  const filtered = query
    ? students.filter((s) => matchesSearch(s, query))
    : students;

  const byBand = new Map<RunGroupBand, CoachDashboardStudent[]>();
  for (const band of RUN_GROUP_BANDS) byBand.set(band, []);
  for (const student of filtered) {
    byBand.get(toRunGroupBand(student.runGroup))!.push(student);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
          Roster
        </p>
        <h2 className="text-xl font-semibold text-slate-50">By run group</h2>
        <p className="text-sm text-slate-400">
          Every student, grouped by tier. Consistency is the spread of their lap
          times this session.
        </p>
      </div>

      {RUN_GROUP_BANDS.map((band) => (
        <RunGroupBandSection
          key={band}
          band={band}
          students={byBand.get(band)!}
        />
      ))}
    </section>
  );
}

function RunGroupBandSection({
  band,
  students,
}: {
  band: RunGroupBand;
  students: CoachDashboardStudent[];
}) {
  const ready = students.filter((s) => s.ready);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          {RUN_GROUP_LABELS[band]}
        </p>
        <span className="text-[11px] text-slate-400">
          {students.length} {students.length === 1 ? 'student' : 'students'}
        </span>
      </div>

      {ready.length > 0 && (
        <div className="border-b border-slate-800/80 bg-sky-500/5 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-sky-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
              Ready to advance
            </p>
          </div>
          <ul className="space-y-1">
            {ready.map((s) => (
              <li key={s.driverId} className="text-xs text-sky-100/90">
                <Link
                  href={`/drivers/${s.driverId}`}
                  className="hover:underline"
                >
                  <span className="font-medium text-sky-50">
                    {formatDriverName(s.driverName)}
                  </span>
                </Link>
                {s.readyWhy && (
                  <span className="text-sky-200/70"> — {s.readyWhy}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {students.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-slate-500">No students in this group.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1 px-2 py-2 text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <Th>Driver</Th>
                <Th>Best lap</Th>
                <Th>Consistency</Th>
                <Th className="hidden md:table-cell">Trend</Th>
                <Th className="hidden lg:table-cell">Sessions</Th>
                <Th className="hidden md:table-cell">Last session</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const offBaseline = s.flags.some(
                  (f) => f.kind === 'off_baseline'
                );
                return (
                  <tr key={s.driverId} className="align-middle">
                    <Td>
                      <div className="flex flex-col">
                        <span className="truncate text-[13px] font-medium text-slate-50">
                          {formatDriverName(s.driverName)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {s.lastTrackName}
                        </span>
                      </div>
                    </Td>

                    <Td>
                      <span className="font-mono text-[13px] text-slate-200">
                        {s.bestLapMs ? formatLapMs(s.bestLapMs) : '-'}
                      </span>
                    </Td>

                    <Td>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`font-mono text-[13px] ${
                            offBaseline ? 'text-amber-300' : 'text-slate-200'
                          }`}
                        >
                          {formatConsistency(s.sessionConsistencySeconds)}
                        </span>
                        {offBaseline && (
                          <Activity
                            className="h-3 w-3 text-amber-400"
                            aria-label="Wider than usual spread"
                          />
                        )}
                      </span>
                    </Td>

                    <Td className="hidden md:table-cell">
                      <StudentSparkline points={s.sparkline} />
                    </Td>

                    <Td className="hidden lg:table-cell">
                      <span className="text-[13px] text-slate-200">
                        {s.sessionCount}
                      </span>
                    </Td>

                    <Td className="hidden md:table-cell">
                      <span className="text-[12px] text-slate-300">
                        {s.lastSessionDate ? formatDate(s.lastSessionDate) : '-'}
                      </span>
                    </Td>

                    <Td>
                      <Link
                        href={`/drivers/${s.driverId}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/90 bg-slate-900/70 text-sky-50 transition-colors hover:border-sky-300 hover:bg-sky-500/15"
                        aria-label={`View ${formatDriverName(s.driverName)}`}
                      >
                        <span className="translate-x-px">→</span>
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
