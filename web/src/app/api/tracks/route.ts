/**
 * Tracks API Route
 *
 * GET /api/tracks
 * Returns all available tracks from the database
 * Supports filtering by name with ?name=<track_name>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const searchParams = request.nextUrl.searchParams;
    const nameFilter = searchParams.get('name');

    // Build query
    let query = (supabase
      .from('tracks') as any)
      .select('id, name, location, length_meters, config');

    // Apply name filter if provided
    if (nameFilter) {
      query = query.ilike('name', nameFilter);
    }

    query = query.order('name', { ascending: true });

    const { data: tracks, error } = await query;

    if (error) {
      console.error('Error fetching tracks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tracks' },
        { status: 500 }
      );
    }

    // Transform to camelCase for iOS app compatibility
    const tracksFormatted = (tracks || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      location: track.location,
      lengthMeters: track.length_meters,
      config: track.config,
    }));

    return NextResponse.json({
      tracks: tracksFormatted,  // Legacy iOS app compatibility
      data: tracks || []        // Web app compatibility
    });
  } catch (error) {
    console.error('Tracks API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
