/**
 * Example API route using getDriverProgress
 *
 * This demonstrates how to use the getDriverProgress function
 * with different modes: weekend, track, and overall
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDriverProgress } from '@/lib/queries/driver-progress';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: driverId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('mode') as 'weekend' | 'track' | 'overall' || 'overall';
    const trackId = searchParams.get('trackId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Build date range if both dates provided
    const dateRange: [string, string] | undefined =
      startDate && endDate ? [startDate, endDate] : undefined;

    // Call the getDriverProgress function
    const progressData = await getDriverProgress({
      driverId,
      mode,
      trackId,
      dateRange
    });

    return NextResponse.json({
      mode,
      driverId,
      trackId,
      dateRange,
      sessions: progressData
    });
  } catch (error) {
    console.error('Error in progress-summary route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch driver progress summary' },
      { status: 500 }
    );
  }
}

/**
 * Example Usage:
 *
 * Weekend Mode:
 * GET /api/drivers/{driverId}/progress-summary?mode=weekend&startDate=2025-11-16&endDate=2025-11-16
 *
 * Track Mode:
 * GET /api/drivers/{driverId}/progress-summary?mode=track&trackId={trackId}
 *
 * Overall Mode:
 * GET /api/drivers/{driverId}/progress-summary?mode=overall
 */
