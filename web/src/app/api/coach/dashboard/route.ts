/**
 * Coach Dashboard API Route
 *
 * GET /api/coach/dashboard
 * Returns aggregated driver metrics for the authenticated coach's dashboard
 */

import { NextResponse } from 'next/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { getCoachDashboardData } from '@/data/coachDashboard';

export async function GET() {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await getCoachDashboardData();

    if (error) {
      console.error('[api/coach/dashboard] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('[api/coach/dashboard] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
