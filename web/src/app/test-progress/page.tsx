"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DriverProgressView } from "@/components/driver-progress-view";
import { createServerClient } from "@/lib/supabase/client";

function TestProgressContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get URL params
  const urlDriverId = searchParams.get('driverId');
  const urlMode = searchParams.get('mode') as "weekend" | "track" | null;
  const urlDate = searchParams.get('date');

  // Default to Cole Trickle for standalone testing
  const testDriverId = urlDriverId || "0e0640b9-c296-42e2-99f0-c4a2a4a643b9";
  const testTrackId = "550e8400-e29b-41d4-a716-446655440005"; // Streets of Willow

  // Default to "track" mode unless explicitly set to weekend
  const [mode, setMode] = useState<"weekend" | "track">(urlMode || "track");

  // Fetch driver and track names
  const [driverName, setDriverName] = useState<string>('Loading...');
  const [trackName, setTrackName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNames() {
      const supabase = createServerClient();

      try {
        // Fetch driver name
        const { data: driver } = await (supabase
          .from('drivers') as any)
          .select('name')
          .eq('id', testDriverId)
          .single();

        // Fetch track name (if we have a trackId)
        const { data: track } = await (supabase
          .from('tracks') as any)
          .select('name')
          .eq('id', testTrackId)
          .single();

        setDriverName(driver?.name || 'Unknown Driver');
        setTrackName(track?.name || 'Unknown Track');
      } catch (error) {
        console.error('Error fetching names:', error);
        setDriverName('Unknown Driver');
        setTrackName('Unknown Track');
      } finally {
        setLoading(false);
      }
    }

    fetchNames();
  }, [testDriverId, testTrackId]);

  // Date handling
  const testDate = urlDate || "2025-12-10"; // Fallback to test data date
  const testDateRange: [string, string] = [testDate, testDate];

  // Instructions toggle
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href="/coach"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-orange-400 transition-colors"
        >
          <span>←</span>
          <span>Back to Coach Dashboard</span>
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Driver Progress Test
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {loading ? 'Loading...' : `${driverName} • ${trackName} • ${new Date(testDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
          </div>

          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 transition-colors"
          >
            {showInstructions ? 'Hide' : 'Show'} Instructions
          </button>
        </div>

        {/* Instructions (collapsible) */}
        {showInstructions && (
          <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
              Test Data & Instructions
            </h3>

            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <h4 className="mb-2 font-medium text-slate-200">Current View Settings:</h4>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                  <p><span className="text-slate-500">Driver:</span> {driverName}</p>
                  <p><span className="text-slate-500">Track:</span> {trackName}</p>
                  <p><span className="text-slate-500">Mode:</span> {mode === 'weekend' ? 'Weekend (Session-to-Session)' : 'Track History (Event-to-Event)'}</p>
                  <p><span className="text-slate-500">Date:</span> {testDate}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-slate-200">Available Test Data:</h4>
                <ul className="space-y-1 text-slate-400">
                  <li>• <strong>Cole Trickle:</strong> Dec 10, 2025 - 3 weekend sessions (improving)</li>
                  <li>• <strong>Cole Trickle:</strong> Nov 2025 track history at Streets of Willow</li>
                  <li>• <strong>Other drivers:</strong> Various historical sessions</li>
                </ul>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-slate-200">How to Test:</h4>
                <ol className="space-y-1 text-slate-400 list-decimal list-inside">
                  <li>Toggle between "This Weekend" and "Track History" tabs</li>
                  <li>Weekend mode shows session-to-session progress (same day)</li>
                  <li>Track mode shows event-to-event progress (grouped by month)</li>
                  <li>Navigate from Coach Dashboard to test different drivers</li>
                </ol>
              </div>

              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
                <p className="text-orange-300">
                  <strong>Note:</strong> If "This Weekend" shows no data, the driver doesn't have multiple sessions for the selected date. Use Track History to see their overall progress.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Driver</p>
              <p className="text-slate-200 font-medium">{driverName}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Track</p>
              <p className="text-slate-200 font-medium">{trackName}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Mode</p>
              <p className="text-slate-200 font-medium">
                {mode === 'weekend' ? 'Weekend' : 'Track'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Date</p>
              <p className="text-slate-200 font-medium">
                {mode === 'weekend' ? testDate : 'All events'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress View Component */}
        {!loading && (
          <DriverProgressView
            driverId={testDriverId}
            mode={mode}
            trackId={testTrackId}
            dateRange={mode === "weekend" ? testDateRange : undefined}
            onModeChange={setMode}
          />
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestProgressPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500" />
      </div>
    }>
      <TestProgressContent />
    </Suspense>
  );
}
