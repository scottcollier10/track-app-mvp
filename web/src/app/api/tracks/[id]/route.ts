/**
 * Track API Route
 *
 * GET /api/tracks/[id]
 * Returns a single track with its details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrack } from '@/data/tracks';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    const { data: track, error } = await getTrack(id);

    if (error) {
      console.error('Error fetching track:', error);
      return NextResponse.json(
        { error: 'Failed to fetch track' },
        { status: 500 }
      );
    }

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: track });
  } catch (error) {
    console.error('Track API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
