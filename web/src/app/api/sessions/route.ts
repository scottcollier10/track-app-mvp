/**
 * Sessions API Route
 *
 * GET /api/sessions
 * Returns all sessions with optional filtering
 * Query params: trackId, driverId, startDate, endDate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions, SessionFilters } from '@/data/sessions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build filters from query params
    const filters: SessionFilters = {};

    const trackId = searchParams.get('trackId');
    const driverId = searchParams.get('driverId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (trackId) filters.trackId = trackId;
    if (driverId) filters.driverId = driverId;
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
