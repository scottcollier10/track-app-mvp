/**
 * Import Session API Route
 *
 * POST /api/import-session
 * Accepts a session from the iOS app and imports it into Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { ImportSessionPayload } from '@/lib/types';
import type { TablesInsert, Tables } from '@/lib/types/database';

const DEMO_COACH_ID = "c1111111-1111-1111-1111-111111111111";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse request body
    const payload = (await request.json()) as ImportSessionPayload;

    // 2. Validate payload
    if (!payload.driverEmail || !payload.trackId || !payload.laps || payload.laps.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    // Bypass Supabase's strict TS typing for this MVP endpoint
    const db = supabase as any;

    // 1. Find or create driver by email
    const { data: existingDriver } = await (supabase
      .from('drivers') as any)
      .select('*')
      .eq('email', payload.driverEmail)
      .single();

    let driver: Tables<'drivers'>;

    if (!existingDriver) {
      // Extract name from email (before @)
      const name = payload.driverEmail.split('@')[0];

      const driverInsert: TablesInsert<'drivers'> = {
  email: payload.driverEmail,
  name,
  coach_id: DEMO_COACH_ID, // ← ADD THIS LINE
};

      const { data: newDriver, error: driverError } = await (supabase
        .from('drivers') as any)
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

      driver = newDriver as Tables<'drivers'>;
    } else {
      driver = existingDriver as Tables<'drivers'>;
    }

    // 2. Verify track exists
    const { data: track } = await (supabase
      .from('tracks') as any)
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
    });

    // 3. Create session
    const sessionInsert: TablesInsert<'sessions'> = {
      driver_id: driver.id,
      track_id: payload.trackId,
      date: payload.date,
      total_time_ms: payload.totalTimeMs,
      best_lap_ms: payload.bestLapMs,
      source: 'ios_app',
    };

    const { data: sessionData, error: sessionError } = await (supabase
      .from('sessions') as any)
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

    const session = sessionData as Tables<'sessions'>;

    // 4. Create laps
    const lapsToInsert: TablesInsert<'laps'>[] = payload.laps.map((lap) => ({
      session_id: session.id,
      lap_number: lap.lapNumber,
      lap_time_ms: lap.lapTimeMs,
      sector_data: lap.sectorData || null,
    }));

    const { error: lapsError } = await (supabase
      .from('laps') as any)
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
    });

    return NextResponse.json(
      {
        sessionId: session.id,
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
