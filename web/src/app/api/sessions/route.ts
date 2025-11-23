/**
 * Sessions API Route
 *
 * GET /api/sessions
 * Returns sessions for the authenticated user with optional filtering
 * Query params: trackId, startDate, endDate
 *
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { getAllSessions, SessionFilters } from '@/data/sessions';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Build filters from query params (always filter by current user's driver ID)
    // Note: drivers.id = auth.users.id, so we can use user.id directly
    const filters: SessionFilters = {
      driverId: user.id,
    };

    const trackId = searchParams.get('trackId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (trackId) filters.trackId = trackId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const { data: sessions, error } = await getAllSessions(filters);

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: sessions || [] });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
