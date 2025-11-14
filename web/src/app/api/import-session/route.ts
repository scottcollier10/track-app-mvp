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

    // 3. Find or create driver by email
    let { data: driver } = await db
      .from('drivers')
      .select('*')
      .eq('email', payload.driverEmail)
      .single();

    if (!driver) {
      // Extract name from email (before @)
      const name = payload.driverEmail.split('@')[0];

      const driverInsert: TablesInsert<'drivers'> = {
        email: payload.driverEmail,
        name,
      };

      const { data: newDriver, error: driverError } = await db
        .from('drivers')
        .insert([driverInsert] as any) // TS bypass for Vercel
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

    // 4. Verify track exists
    const { data: track } = await db
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

    // 5. Create session
    const sessionInsert: TablesInsert<'sessions'> = {
      driver_id: driver.id,
      track_id: payload.trackId,
      date: payload.date,
      total_time_ms: payload.totalTimeMs,
      best_lap_ms: payload.bestLapMs,
      source: 'ios_app',
    };

    const { data: session, error: sessionError } = await db
      .from('sessions')
      .insert(sessionInsert as any) // TS bypass for Vercel
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // 6. Create laps
    const lapsToInsert: TablesInsert<'laps'>[] = payload.laps.map((lap) => ({
      session_id: session.id,
      lap_number: lap.lapNumber,
      lap_time_ms: lap.lapTimeMs,
      sector_data: lap.sectorData || null,
    }));

    const { error: lapsError } = await db
      .from('laps')
      .insert(lapsToInsert as any); // TS bypass for Vercel

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

    // 7. Success
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
