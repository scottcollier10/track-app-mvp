/**
 * Driver Profile API Route
 *
 * GET /api/drivers/[id]/profile
 * Returns the viewed driver's experience level, scoped to the coach's own students.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { getDriverById } from '@/data/drivers';
import { getDriverProfile } from '@/data/driverProfiles';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: driverId } = await params;

    // Ownership check: the coach may only view a driver they can see.
    const { data: driver, error: driverError } = await getDriverById(driverId);
    if (driverError) {
      return NextResponse.json({ error: driverError.message }, { status: 500 });
    }
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 403 });
    }

    const { data: profile, error } = await getDriverProfile(driverId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      experienceLevel: profile?.experience_level ?? 'beginner',
    });
  } catch (error) {
    console.error('[api/drivers/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
