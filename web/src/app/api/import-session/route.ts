/**
 * Import Session API Route
 *
 * POST /api/import-session
 * Accepts a session from the iOS app or CSV import and imports it into Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentCoach } from '@/lib/auth/current-coach';
import { ImportSessionPayload } from '@/lib/types';
import { localDateForTimezone } from '@/lib/track-days';
import type { TablesInsert, Tables } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Parse request body
    const payload = (await request.json()) as ImportSessionPayload;

    // 2. Validate payload
    if (!payload.driverEmail || !payload.trackId || !payload.laps || payload.laps.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 1. Find or create driver by email
    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('*')
      .eq('email', payload.driverEmail)
      .eq('coach_id', coach.id)
      .single();

    let driver: Tables<'drivers'>;

    if (!existingDriver) {
      // Extract name from email (before @)
      const name = payload.driverEmail.split('@')[0];

      const driverInsert: TablesInsert<'drivers'> = {
        email: payload.driverEmail,
        name,
        coach_id: coach.id,
      };

      const { data: newDriver, error: driverError } = await supabase
        .from('drivers')
        .insert(driverInsert)
        .select()
        .single();

      if (driverError || !newDriver) {
        console.error('[Import Session] Driver creation failed', {
          email: payload.driverEmail,
          error: driverError?.message || 'Driver data missing',
        });
        return NextResponse.json(
          { error: 'Failed to create driver' },
          { status: 500 }
        );
      }

      driver = newDriver;
    } else {
      driver = existingDriver;
    }

    // 2. Verify track exists
    const { data: track } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', payload.trackId)
      .single();

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    console.log('[Import Session] Started', {
      timestamp: new Date().toISOString(),
      driverEmail: payload.driverEmail,
      trackName: track.name,
      lapCount: payload.laps?.length || 0,
      source: payload.source || 'csv_import',
    });

    // 3. Resolve the track day (implicit — never created by hand)
    let localDate: string;
    try {
      localDate = localDateForTimezone(payload.date, track.timezone);
    } catch {
      // payload.date is not validated above, so a malformed value lands here.
      console.error('[Import Session] Invalid session date', {
        driverId: driver.id,
        date: payload.date,
      });
      return NextResponse.json(
        { error: 'Invalid session date' },
        { status: 400 }
      );
    }

    const trackDayInsert: TablesInsert<'track_days'> = {
      driver_id: driver.id,
      track_id: payload.trackId,
      date: localDate,
    };

    const { data: trackDay, error: trackDayError } = await supabase
      .from('track_days')
      .upsert(trackDayInsert, { onConflict: 'driver_id,track_id,date' })
      .select()
      .single();

    if (trackDayError || !trackDay) {
      console.error('[Import Session] Track day upsert failed', {
        driverId: driver.id,
        trackId: payload.trackId,
        date: localDate,
        error: trackDayError?.message || 'Track day data missing',
      });
      return NextResponse.json(
        { error: 'Failed to resolve track day' },
        { status: 500 }
      );
    }

    // 4. Create session
    const sessionInsert: TablesInsert<'sessions'> = {
      driver_id: driver.id,
      track_id: payload.trackId,
      track_day_id: trackDay.id,
      date: payload.date,
      total_time_ms: payload.totalTimeMs,
      best_lap_ms: payload.bestLapMs,
      source: payload.source || 'csv_import', // Use source from payload
    };

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionInsert)
      .select()
      .single();

    if (sessionError || !sessionData) {
      console.error('[Import Session] Session creation failed', {
        driverId: driver.id,
        trackId: payload.trackId,
        error: sessionError?.message || 'Session data missing',
      });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    const session = sessionData;

    // 5. Create laps
    const lapsToInsert: TablesInsert<'laps'>[] = payload.laps.map((lap) => ({
      session_id: session.id,
      lap_number: lap.lapNumber,
      lap_time_ms: lap.lapTimeMs,
      sector_data: lap.sectorData || null,
    }));

    const { error: lapsError } = await supabase
      .from('laps')
      .insert(lapsToInsert);

    if (lapsError) {
      console.error('[Import Session] Laps creation failed', {
        sessionId: session.id,
        lapCount: lapsToInsert.length,
        error: lapsError.message,
      });
      // Still return success since session was created
      return NextResponse.json(
        {
          sessionId: session.id,
          trackDayId: trackDay.id,
          message: 'Session created but some laps failed to import',
          warning: lapsError.message,
        },
        { status: 207 } // Multi-status
      );
    }

    // Success!
    const duration = Date.now() - startTime;
    console.log('[Import Session] Success', {
      sessionId: session.id,
      durationMs: duration,
      lapsCreated: lapsToInsert.length,
      source: session.source,
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        trackDayId: trackDay.id,
        message: 'Session imported successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Import Session] Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
