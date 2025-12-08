# Driver Progress Query Functions

This directory contains query functions for flexible driver progress tracking and session comparison.

## `getDriverProgress`

A flexible helper function that queries session data with different grouping and filtering modes.

### Import

```typescript
import { getDriverProgress, SessionSummary, DriverProgressParams } from '@/lib/queries/driver-progress';
```

### Function Signature

```typescript
export async function getDriverProgress(
  params: DriverProgressParams
): Promise<SessionSummary[]>
```

### Parameters

```typescript
interface DriverProgressParams {
  driverId: string;
  mode: "weekend" | "track" | "overall";
  trackId?: string;
  dateRange?: [string, string]; // ISO format dates: ["2025-11-16", "2025-11-16"]
}
```

### Return Type

```typescript
interface SessionSummary {
  sessionId: string;
  label: string;          // "Session 1", "May 2025", "Nov 16, 2025"
  date: string;           // ISO date
  trackName: string;
  trackId: string;
  bestLap: number;        // in seconds
  consistencyScore: number; // 0-100
  paceTrend: "improving" | "stable" | "fading";
  lapsCount: number;
  delta?: {               // Calculated vs previous session/event
    bestLap: number;      // negative = improved
    consistency: number;  // positive = improved
  }
}
```

### Modes

#### Weekend Mode
Shows all sessions for a driver on a specific date (or date range).

```typescript
const weekendSessions = await getDriverProgress({
  driverId: "driver-123",
  mode: "weekend",
  dateRange: ["2025-11-16", "2025-11-16"]
});
```

**Output:**
- All sessions from the specified date range
- Labeled as "Session 1", "Session 2", "Session 3", etc.
- Delta compares each session to the previous session

#### Track Mode
Shows driver's progress at a specific track over multiple events.

```typescript
const trackProgress = await getDriverProgress({
  driverId: "driver-123",
  mode: "track",
  trackId: "track-456"
});
```

**Output:**
- Best session from each event date at the specified track
- Labeled as "May 2025", "July 2025", etc.
- Delta compares each event to the previous event

#### Overall Mode
Shows driver's overall progress across all tracks over time (grouped by month).

```typescript
const overallProgress = await getDriverProgress({
  driverId: "driver-123",
  mode: "overall"
});
```

**Output:**
- Best session from each month across all tracks
- Labeled as "May 2025", "June 2025", etc.
- Delta compares each month to the previous month

### Understanding Deltas

The `delta` field compares the current session/event to the previous one:

```typescript
delta: {
  bestLap: -0.7,     // Negative = improved (0.7 seconds faster)
  consistency: 2      // Positive = improved (2 points better)
}
```

**Best Lap Delta:**
- Negative value = faster (improvement)
- Positive value = slower (regression)
- Example: `-0.7` means 0.7 seconds faster than previous

**Consistency Delta:**
- Positive value = more consistent (improvement)
- Negative value = less consistent (regression)
- Example: `2` means 2 points more consistent than previous

### Example API Route

See `/api/drivers/[id]/progress-summary/route.ts` for a complete example.

```typescript
// Weekend Mode
GET /api/drivers/{driverId}/progress-summary?mode=weekend&startDate=2025-11-16&endDate=2025-11-16

// Track Mode
GET /api/drivers/{driverId}/progress-summary?mode=track&trackId={trackId}

// Overall Mode
GET /api/drivers/{driverId}/progress-summary?mode=overall
```

### Error Handling

The function returns an empty array `[]` if:
- No sessions are found
- Database query fails
- Invalid parameters are provided

All errors are logged to the console.

### Notes

- All dates should be in ISO 8601 format (e.g., "2025-11-16T09:00:00Z")
- Best lap times are converted from milliseconds to seconds
- Consistency scores are calculated using the existing `calculateConsistencyScore` function
- Pace trends are calculated using the existing `calculatePaceTrend` function
