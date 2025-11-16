/**
 * Driver Profiles Data Layer
 *
 * Clean data access functions for driver profiles
 */

import { createServerClient } from '@/lib/supabase/client';
import { ExperienceLevel } from '@/types/driver';

export interface DriverProfileData {
  id: string;
  driver_id: string;
  experience_level: ExperienceLevel;
  total_sessions: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get driver profile by driver ID
 */
export async function getDriverProfile(
  driverId: string
): Promise<{ data: DriverProfileData | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    const { data: profile, error } = await (supabase
      .from('driver_profiles') as any)
      .select('*')
      .eq('driver_id', driverId)
      .single();

    if (error) {
      // Return null if profile doesn't exist (not an error)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    return { data: profile as DriverProfileData, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create a new driver profile
 */
export async function createDriverProfile(
  driverId: string,
  experienceLevel: ExperienceLevel
): Promise<{ data: DriverProfileData | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    const { data: profile, error } = await (supabase
      .from('driver_profiles') as any)
      .insert({
        driver_id: driverId,
        experience_level: experienceLevel,
        total_sessions: 0,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: profile as DriverProfileData, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Increment total sessions count for a driver
 */
export async function updateTotalSessions(
  driverId: string
): Promise<{ data: DriverProfileData | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    // First get the current profile
    const { data: currentProfile, error: fetchError } = await (supabase
      .from('driver_profiles') as any)
      .select('total_sessions')
      .eq('driver_id', driverId)
      .single();

    if (fetchError) {
      return { data: null, error: new Error(fetchError.message) };
    }

    // Increment the session count
    const { data: profile, error } = await (supabase
      .from('driver_profiles') as any)
      .update({
        total_sessions: (currentProfile.total_sessions || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('driver_id', driverId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: profile as DriverProfileData, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
