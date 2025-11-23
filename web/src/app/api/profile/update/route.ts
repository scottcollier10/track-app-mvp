/**
 * Driver Profile Update API Route
 *
 * POST /api/profile/update
 * Updates a driver's experience level
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { updateDriverProfile } from '@/data/driverProfiles';
import { ExperienceLevel } from '@/types/driver';

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { driverId, experienceLevel } = body;

    // 3. Verify user can only update their own profile
    // Note: drivers.id = auth.users.id
    if (user.id !== driverId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - you can only update your own profile' },
        { status: 403 }
      );
    }

    // 4. Validate required fields
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: 'driverId is required' },
        { status: 400 }
      );
    }

    if (!experienceLevel) {
      return NextResponse.json(
        { success: false, error: 'experienceLevel is required' },
        { status: 400 }
      );
    }

    // 5. Validate experience level value
    const validLevels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
    if (!validLevels.includes(experienceLevel as ExperienceLevel)) {
      return NextResponse.json(
        {
          success: false,
          error: 'experienceLevel must be one of: beginner, intermediate, advanced'
        },
        { status: 400 }
      );
    }

    // 6. Update profile
    const { data: profile, error } = await updateDriverProfile(
      driverId,
      experienceLevel as ExperienceLevel
    );

    if (error) {
      console.error('[Profile Update] Failed to update profile', {
        driverId,
        error: error.message,
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // 7. Return success
    console.log('[Profile Update] Success', {
      driverId,
      experienceLevel,
    });

    return NextResponse.json(
      {
        success: true,
        profile: {
          id: profile.id,
          driverId: profile.driver_id,
          experienceLevel: profile.experience_level,
          totalSessions: profile.total_sessions,
          updatedAt: profile.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Profile Update] Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
