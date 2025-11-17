/**
 * Drivers API Route
 *
 * GET /api/drivers
 * Returns all available drivers from the database
 */

import { NextResponse } from 'next/server';
import { getDrivers } from '@/data/drivers';

export async function GET() {
  try {
    const { data: drivers, error } = await getDrivers();

    if (error) {
      console.error('Error fetching drivers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drivers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: drivers || [] });
  } catch (error) {
    console.error('Drivers API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
