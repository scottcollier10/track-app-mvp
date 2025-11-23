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
import { createServerClient, getUser } from '@/lib/supabase/server';
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

    // Get the driver ID for the current user
    const supabase = await createServerClient();
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver profile not found' },
        { status: 404 }
      );
    }

    // Build filters from query params (always filter by current user's driver ID)
    const filters: SessionFilters = {
      driverId: driver.id,
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
