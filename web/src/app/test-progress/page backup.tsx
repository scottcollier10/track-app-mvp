"use client";

import { useState } from "react";
import { DriverProgressView } from "@/components/driver-progress-view";

export default function TestProgressPage() {
  const [mode, setMode] = useState<"weekend" | "track">("weekend");

  // Example values - replace with actual driver/track IDs from your database
  const testDriverId = "0e0640b9-c296-42e2-99f0-c4a2a4a643b9"; // Replace with actual driver ID
  const testTrackId = "550e8400-e29b-41d4-a716-446655440005"; // Replace with actual track ID
  const testDateRange: [string, string] = ["2025-11-16", "2025-11-16"];

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Driver Progress Test
          </h1>
          <p className="text-sm text-slate-400">
            Testing the DriverProgressView component
          </p>
        </div>

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
