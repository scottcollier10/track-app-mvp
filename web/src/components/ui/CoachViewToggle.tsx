"use client";

import { useCoachView } from "@/context/coach-view";

export default function CoachViewToggle() {
  const { coachView, toggleCoachView } = useCoachView();

  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span>Coach View</span>
      <button
        type="button"
        onClick={toggleCoachView}
        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition
          ${
            coachView
              ? "bg-emerald-500 border-emerald-500"
              : "bg-slate-700 border-slate-500"
          }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-slate-900 transition
            ${coachView ? "translate-x-4" : "translate-x-1"}`}
        />
      </button>
      <span className="text-[11px] text-slate-400">
        {coachView ? "ON" : "OFF"}
      </span>
    </div>
  );
}
