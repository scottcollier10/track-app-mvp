/**
 * Tracks API Route
 *
 * GET /api/tracks
 * Returns all available tracks from the database
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: tracks, error } = await (supabase
      .from('tracks') as any)
      .select('id, name, location, length_meters, config')
      .order('name', { ascending: true });

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
