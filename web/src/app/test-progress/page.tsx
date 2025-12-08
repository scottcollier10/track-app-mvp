"use client";

import { useState } from "react";
import { DriverProgressView } from "@/components/driver-progress-view";

export default function TestProgressPage() {
  const [mode, setMode] = useState<"weekend" | "track">("weekend");
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Cole Trickle - Streets of Willow
  const testDriverId = "0e0640b9-c296-42e2-99f0-c4a2a4a643b9";
  const testTrackId = "550e8400-e29b-41d4-a716-446655440005";
  
  // Weekend mode: Dec 10, 2025 (3 sessions)
  const testDateRange: [string, string] = ["2025-12-10", "2025-12-10"];

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">
                Driver Progress Test
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Cole Trickle • Streets of Willow • Dec 10, 2025
              </p>
            </div>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 hover:border-orange-500/50 hover:text-orange-400 transition-colors"
            >
              {showInstructions ? "Hide" : "Show"} Instructions
            </button>
          </div>

          {/* Collapsible Instructions */}
          {showInstructions && (
            <div className="space-y-3 mb-4">
              {/* Test Data */}
              <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4">
                <p className="text-sm text-blue-300 font-medium mb-2">
                  Test Data (3 sessions)
                </p>
                <div className="text-xs text-blue-200 space-y-1">
                  <p>• <strong>Session 1 (9:00 AM):</strong> 1:30.500, 12 laps, 95% consistency</p>
                  <p>• <strong>Session 2 (11:30 AM):</strong> 1:29.800, 15 laps, 97% consistency → 0.7s faster</p>
                  <p>• <strong>Session 3 (2:00 PM):</strong> 1:29.000, 15 laps, 98% consistency → 0.8s faster</p>
                  <p className="pt-1 border-t border-blue-800/30">
                    <strong>Total improvement:</strong> -1.5 seconds across the day
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Weekend Mode */}
                <div className="rounded-lg border border-green-900/50 bg-green-950/20 p-3">
                  <p className="text-sm text-green-300 font-medium mb-2">
                    Weekend Mode
                  </p>
                  <ul className="text-xs text-green-200 space-y-1">
                    <li>• All sessions from one date/weekend</li>
                    <li>• Session-to-session deltas</li>
                    <li>• "Did my feedback work today?"</li>
                  </ul>
                </div>

                {/* Track Mode */}
                <div className="rounded-lg border border-orange-900/50 bg-orange-950/20 p-3">
                  <p className="text-sm text-orange-300 font-medium mb-2">
                    Track Mode
                  </p>
                  <ul className="text-xs text-orange-200 space-y-1">
                    <li>• Best session per event at this track</li>
                    <li>• Longitudinal progress over time</li>
                    <li>• "Is this driver improving here?"</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Driver</p>
                <p className="text-slate-200 font-medium">Cole Trickle</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Track</p>
                <p className="text-slate-200 font-medium">Streets of Willow</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Mode</p>
                <p className="text-slate-200 font-medium capitalize">{mode}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Date</p>
                <p className="text-slate-200 font-medium">
                  {mode === "weekend" ? "Dec 10, 2025" : "All events"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Component Under Test */}
        <DriverProgressView
          driverId={testDriverId}
          mode={mode}
          trackId={mode === "track" ? testTrackId : undefined}
          dateRange={mode === "weekend" ? testDateRange : undefined}
          onModeChange={setMode}
        />
      </div>
    </div>
  );
}
