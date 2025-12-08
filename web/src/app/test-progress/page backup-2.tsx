"use client";

import { useState } from "react";
import { DriverProgressView } from "@/components/driver-progress-view";

export default function TestProgressPage() {
  const [mode, setMode] = useState<"weekend" | "track">("track");
  
  // Cole Trickle - Streets of Willow
  const testDriverId = "0e0640b9-c296-42e2-99f0-c4a2a4a643b9";
  const testTrackId = "550e8400-e29b-41d4-a716-446655440005";
  
  // After importing CSV, change to ["2025-12-10", "2025-12-10"]
  const testDateRange: [string, string] = ["2025-12-10", "2025-12-10"];

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Driver Progress Test
          </h1>
          <p className="text-sm text-slate-400 mb-4">
            Testing the DriverProgressView component
          </p>
          
          {/* Instructions */}
          <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4 mb-4">
            <p className="text-sm text-blue-300 mb-2">
              <strong>Setup Instructions:</strong>
            </p>
            <ol className="text-xs text-blue-200 space-y-1 list-decimal list-inside">
              <li>Import <code className="bg-blue-900/30 px-1 rounded">weekend-sessions-correct-format.csv</code> via Import CSV page</li>
              <li>This adds 3 sessions for Cole Trickle on Dec 10, 2025</li>
              <li>Click "This Weekend" tab to see session-to-session comparison</li>
              <li>Click "Track History" tab to see multi-event progress</li>
            </ol>
          </div>
          
          {/* Current Config */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Driver ID</p>
                <p className="text-slate-200 font-mono text-xs">
                  {testDriverId.slice(0, 8)}...
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Track ID</p>
                <p className="text-slate-200 font-mono text-xs">
                  {testTrackId.slice(0, 8)}...
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Mode</p>
                <p className="text-slate-200 font-medium capitalize">
                  {mode}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Date</p>
                <p className="text-slate-200 font-medium">
                  {mode === "weekend" ? testDateRange[0] : "All events"}
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
