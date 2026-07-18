/**
 * Driver Progress By Track API Route
 *
 * GET /api/drivers/[id]/progress-by-track?trackId=...&after=...&before=...
 * Returns longitudinal progression data for a driver at a specific track
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { getDriverProgressByTrack } from '@/data/driverProgress';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: driverId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const trackId = searchParams.get('trackId');
    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId query param is required' },
        { status: 400 }
      );
    }

    const after = searchParams.get('after') || undefined;
    const before = searchParams.get('before') || undefined;

    const { data, error } = await getDriverProgressByTrack(driverId, trackId, {
      after,
      before,
    });

    if (error) {
      console.error('[api/drivers/progress-by-track] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch progress data' },
        { status: 500 }
      );
    }

    // Response shape matches the data-function return: { data, error }
    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/drivers/progress-by-track] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
