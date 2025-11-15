"use client";

import { useCoachView } from "@/context/coach-view";

type SessionsSubtitleProps = {
  totalSessions: number;
  uniqueDrivers: number;
};

export default function SessionsSubtitle({
  totalSessions,
  uniqueDrivers,
}: SessionsSubtitleProps) {
  const { coachView } = useCoachView();

  if (coachView) {
    return (
      <p className="text-sm text-slate-400">
        {totalSessions} session{totalSessions === 1 ? "" : "s"} across{" "}
        {uniqueDrivers} driver{uniqueDrivers === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <p className="text-sm text-slate-400">
      {totalSessions} track session{totalSessions === 1 ? "" : "s"}
    </p>
  );
}
