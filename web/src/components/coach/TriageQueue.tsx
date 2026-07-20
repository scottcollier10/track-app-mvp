import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { CoachDashboardStudent } from '@/data/coachDashboard';
import { formatDriverName } from '@/lib/utils/formatters';
import { RUN_GROUP_LABELS, toRunGroupBand, formatDelta } from './runGroups';
import { StudentSparkline } from './StudentSparkline';
import { FlagChip } from './FlagChip';

interface TriageQueueProps {
  students: CoachDashboardStudent[];
}

/**
 * Headline zone: students who fired a flag this session, most-severe first.
 * Each row surfaces the top flag's plain-language "why", any additional flag
 * chips, the signed delta, and a trend sparkline. Replaces the old Bottom-5.
 */
export function TriageQueue({ students }: TriageQueueProps) {
  const flagged = students
    .filter((s) => s.flags.length > 0)
    .sort((a, b) => b.severityScore - a.severityScore);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
          Needs a debrief
        </p>
        <h2 className="text-xl font-semibold text-slate-50">Triage queue</h2>
        <p className="text-sm text-slate-400">
          Students whose latest session broke from their own pattern, ranked by
          severity.
        </p>
      </div>

      {flagged.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 text-center shadow-[0_22px_50px_rgba(15,23,42,0.9)]">
          <p className="text-sm text-slate-400">
            No students need a debrief right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.map((student) => {
            const [topFlag, ...restFlags] = student.flags;
            const delta = formatDelta(topFlag.deltaSeconds);
            return (
              <Link
                key={student.driverId}
                href={`/drivers/${student.driverId}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/80 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.6)] transition-all duration-200 hover:border-amber-500/40 hover:bg-slate-900/60"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-50">
                      {formatDriverName(student.driverName)}
                    </span>
                    <span className="flex-shrink-0 rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {RUN_GROUP_LABELS[toRunGroupBand(student.runGroup)]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-300">
                    {topFlag.why}
                  </p>
                  {restFlags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {restFlags.map((flag, i) => (
                        <FlagChip key={`${flag.kind}-${i}`} flag={flag} />
                      ))}
                    </div>
                  )}
                </div>

                {delta && (
                  <span className="flex-shrink-0 font-mono text-sm text-amber-300">
                    {delta}
                  </span>
                )}

                <div className="flex-shrink-0">
                  <StudentSparkline points={student.sparkline} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
