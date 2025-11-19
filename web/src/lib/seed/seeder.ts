/**
 * Database Seeder
 *
 * Generates realistic demo data for Track App
 * Idempotent - can be run multiple times without creating duplicates
 */
import { config } from 'dotenv';
import { resolve } from 'path';
// Load .env.local from web directory
config({ path: resolve(__dirname, '../../../.env.local') });
import { createServerClient } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import {
  SEED_TRACKS,
  generateDriverName,
  generateDriverEmail,
  generateRealisticLapTimes,
  generateLapCount,
  generateRecentDate,
  getConsistencyForExperience,
  generateExperienceLevel,
} from './generators';

// ============================================================================
// TYPES
// ============================================================================

export interface SeedOptions {
  size: 'small' | 'medium' | 'large';
  clearExisting?: boolean;
  tracksOnly?: boolean;
}

export interface SeedResult {
  tracks: number;
  drivers: number;
  sessions: number;
  laps: number;
}

type TrackInsert = Database['public']['Tables']['tracks']['Insert'];
type DriverInsert = Database['public']['Tables']['drivers']['Insert'];
type DriverProfileInsert = Database['public']['Tables']['driver_profiles']['Insert'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type LapInsert = Database['public']['Tables']['laps']['Insert'];

// ============================================================================
// SEED SIZE CONFIGURATIONS
// ============================================================================

const SEED_SIZES = {
  small: {
    tracks: 5,
    drivers: 8,
    sessions: 15,
  },
  medium: {
    tracks: 10,
    drivers: 20,
    sessions: 50,
  },
  large: {
    tracks: 15,
    drivers: 50,
    sessions: 200,
  },
};

// ============================================================================
// MAIN SEEDER FUNCTION
// ============================================================================

/**
 * Seed the database with realistic demo data
 */
export async function seedDatabase(options: SeedOptions): Promise<SeedResult> {
  const { size, clearExisting = false, tracksOnly = false } = options;
  const config = SEED_SIZES[size];

  console.log(`\n🌱 Starting database seed (${size} dataset)...`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

  // Clear existing data if requested
  if (clearExisting) {
    console.log('🗑️  Clearing existing data...');
    await clearDatabase(supabase);
  }

  const result: SeedResult = {
    tracks: 0,
    drivers: 0,
    sessions: 0,
    laps: 0,
  };

  // Seed tracks (always idempotent)
  console.log(`\n🏁 Seeding ${config.tracks} tracks...`);
  const trackIds = await seedTracks(supabase, config.tracks);
  result.tracks = trackIds.length;
  console.log(`✓ Created ${result.tracks} tracks`);

  if (tracksOnly) {
    console.log('\n✅ Tracks-only seed complete!');
    return result;
  }

  // Seed drivers
  console.log(`\n🏎️  Seeding ${config.drivers} drivers...`);
  const driverData = await seedDrivers(supabase, config.drivers);
  result.drivers = driverData.length;
  console.log(`✓ Created ${result.drivers} drivers`);

  // Seed sessions and laps
  console.log(`\n📊 Seeding ${config.sessions} sessions...`);
  const sessionResults = await seedSessions(
    supabase,
    trackIds,
    driverData,
    config.sessions
  );
  result.sessions = sessionResults.sessions;
  result.laps = sessionResults.laps;
  console.log(`✓ Created ${result.sessions} sessions with ${result.laps} total laps`);

  console.log('\n✅ Database seed complete!');
  console.log(`\n📈 Summary:`);
  console.log(`   Tracks:   ${result.tracks}`);
  console.log(`   Drivers:  ${result.drivers}`);
  console.log(`   Sessions: ${result.sessions}`);
  console.log(`   Laps:     ${result.laps}`);

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clear all seeded data from the database
 */
async function clearDatabase(supabase: ReturnType<typeof createServerClient>) {
  // Delete in order to respect foreign key constraints
  await supabase.from('laps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('coaching_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('driver_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tracks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✓ Cleared existing data');
}

/**
 * Seed tracks (idempotent - uses upsert)
 */
async function seedTracks(
  supabase: ReturnType<typeof createServerClient>,
  count: number
): Promise<string[]> {
  const tracksToSeed = SEED_TRACKS.slice(0, count);

  const trackInserts: TrackInsert[] = tracksToSeed.map((track) => ({
    name: track.name,
    location: track.location,
    length_meters: track.length_meters,
    config: track.config,
  }));

  // Check for existing tracks and only insert new ones
  const { data: existingTracks } = await supabase
    .from('tracks')
    .select('id, name')
    .in('name', tracksToSeed.map((t) => t.name));

  const existingTrackNames = new Set(
    (existingTracks || []).map((t) => t.name)
  );

  const newTracks = trackInserts.filter(
    (t) => !existingTrackNames.has(t.name)
  );

  if (newTracks.length > 0) {
    const { error: insertError } = await supabase
      .from('tracks')
      .insert(newTracks);

    if (insertError) {
      throw new Error(`Failed to insert tracks: ${insertError.message}`);
    }
  }

  // Fetch all track IDs
  const { data: allTracks, error: fetchError } = await supabase
    .from('tracks')
    .select('id, name')
    .in('name', tracksToSeed.map((t) => t.name));

  if (fetchError) {
    throw new Error(`Failed to fetch tracks: ${fetchError.message}`);
  }

  return (allTracks || []).map((t) => t.id);
}

/**
 * Seed drivers with profiles
 */
async function seedDrivers(
  supabase: ReturnType<typeof createServerClient>,
  count: number
): Promise<Array<{ id: string; experience: 'beginner' | 'intermediate' | 'advanced' }>> {
  const usedNames = new Set<string>();
  const driverInserts: DriverInsert[] = [];

  for (let i = 0; i < count; i++) {
    const name = generateDriverName(usedNames);
    const email = generateDriverEmail(name);

    driverInserts.push({
      name,
      email,
    });
  }

  const { data: drivers, error: driverError } = await supabase
    .from('drivers')
    .insert(driverInserts)
    .select('id');

  if (driverError) {
    throw new Error(`Failed to insert drivers: ${driverError.message}`);
  }

  if (!drivers || drivers.length === 0) {
    throw new Error('No drivers were created');
  }

  // Create driver profiles
  const profileInserts: DriverProfileInsert[] = drivers.map((driver) => ({
    driver_id: driver.id,
    experience_level: generateExperienceLevel(),
    total_sessions: 0, // Will be updated as sessions are created
  }));

  const { error: profileError } = await supabase
    .from('driver_profiles')
    .insert(profileInserts);

  if (profileError) {
    throw new Error(`Failed to insert driver profiles: ${profileError.message}`);
  }

  // Return driver IDs with their experience levels
  const { data: profiles, error: fetchError } = await supabase
    .from('driver_profiles')
    .select('id, driver_id, experience_level')
    .in('driver_id', drivers.map((d) => d.id));

  if (fetchError) {
    throw new Error(`Failed to fetch driver profiles: ${fetchError.message}`);
  }

  return (profiles || []).map((p) => ({
    id: p.driver_id,
    experience: p.experience_level as 'beginner' | 'intermediate' | 'advanced',
  }));
}

/**
 * Seed sessions with laps
 */
async function seedSessions(
  supabase: ReturnType<typeof createServerClient>,
  trackIds: string[],
  driverData: Array<{ id: string; experience: 'beginner' | 'intermediate' | 'advanced' }>,
  totalSessions: number
): Promise<{ sessions: number; laps: number }> {
  let totalLaps = 0;
  const sessionsPerDriver = Math.ceil(totalSessions / driverData.length);

  for (const driver of driverData) {
    const numSessions = Math.min(
      sessionsPerDriver,
      totalSessions - (totalLaps > 0 ? Math.floor(totalLaps / 10) : 0)
    );

    for (let i = 0; i < numSessions; i++) {
      // Pick a random track
      const trackId = trackIds[Math.floor(Math.random() * trackIds.length)];

      // Get track data for realistic lap times
      const track = SEED_TRACKS.find((t) =>
        trackIds.includes(trackId)
      ) || SEED_TRACKS[0];

      // Generate lap times
      const lapCount = generateLapCount('practice');
      const consistency = getConsistencyForExperience(driver.experience);
      const improvement = Math.random() > 0.4; // 60% improvement rate

      const lapTimes = generateRealisticLapTimes(
        track.typical_lap_ms,
        lapCount,
        {
          consistency,
          improvement,
          experienceLevel: driver.experience,
        }
      );

      // Calculate session totals
      const totalTimeMs = lapTimes.reduce((sum, time) => sum + time, 0);
      const bestLapMs = Math.min(...lapTimes);

      // Create session
      const sessionInsert: SessionInsert = {
        driver_id: driver.id,
        track_id: trackId,
        date: generateRecentDate(30).toISOString(),
        total_time_ms: totalTimeMs,
        best_lap_ms: bestLapMs,
        source: 'seeded',
      };

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionInsert)
        .select('id')
        .single();

      if (sessionError) {
        console.error(`Failed to insert session: ${sessionError.message}`);
        continue;
      }

      // Create laps
      const lapInserts: LapInsert[] = lapTimes.map((time, idx) => ({
        session_id: session.id,
        lap_number: idx + 1,
        lap_time_ms: time,
      }));

      const { error: lapError } = await supabase
        .from('laps')
        .insert(lapInserts);

      if (lapError) {
        console.error(`Failed to insert laps: ${lapError.message}`);
        continue;
      }

      totalLaps += lapCount;
    }
  }

  return {
    sessions: totalSessions,
    laps: totalLaps,
  };
}
