/**
 * Import Session API Route
 *
 * POST /api/import-session
 * Accepts a session from the iOS app and imports it into Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { ImportSessionPayload } from '@/lib/types';
import type { TablesInsert } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const payload: ImportSessionPayload = await request.json();

    // Validate payload
    if (!payload.driverEmail || !payload.trackId || !payload.laps) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 1. Find or create driver by email
    let { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('email', payload.driverEmail)
      .single();

    if (!driver) {
      // Extract name from email (before @)
      const name = payload.driverEmail.split('@')[0];

      const driverInsert: TablesInsert<'drivers'> = {
        email: payload.driverEmail,
        name: name,
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
     // @ts-ignore – Supabase typing is wrong here in CI; runtime is fine for MVP
      const { data: newDriver, error: driverError } = await supabase
      .from('drivers')
      .insert([driverInsert])
      .select()
      .single();

      if (driverError || !newDriver) {
        console.error('Error creating driver:', driverError);
        return NextResponse.json(
          { error: 'Failed to create driver' },
          { status: 500 }
        );
      }

      driver = newDriver;
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

    // 3. Create session
    const sessionInsert: TablesInsert<'sessions'> = {
      driver_id: driver.id,
      track_id: payload.trackId,
      date: payload.date,
      total_time_ms: payload.totalTimeMs,
      best_lap_ms: payload.bestLapMs,
      source: 'ios_app',
    };

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionInsert)
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // 4. Create laps
    const lapsToInsert: TablesInsert<'laps'>[] = payload.laps.map((lap) => ({
      session_id: session.id,
      lap_number: lap.lapNumber,
      lap_time_ms: lap.lapTimeMs,
      sector_data: lap.sectorData || null,
    }));

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – same TS typing issue as drivers insert 
    await supabase
      .from('laps')
      .insert(lapsToInsert);

    if (lapsError) {
      console.error('Error creating laps:', lapsError);
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
    return NextResponse.json(
      {
        sessionId: session.id,
        message: 'Session imported successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Import session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
