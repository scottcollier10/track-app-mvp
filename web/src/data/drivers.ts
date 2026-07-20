/**
 * Drivers Data Layer
 *
 * Clean data access functions for drivers
 */

import { createServerSupabase } from '@/lib/supabase/server';

export interface Driver {
  id: string;
  name: string;
  email: string;
}

/**
 * Get all drivers
 */
export async function getDrivers(): Promise<{
  data: Driver[] | null;
  error: Error | null;
}> {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get a single driver by id under the coach's RLS server session.
 * Returns { data: null } when the driver is not visible/found (PGRST116).
 */
export async function getDriverById(
  driverId: string
): Promise<{ data: Driver | null; error: Error | null }> {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, email')
      .eq('id', driverId)
      .single();

    if (error) {
      // Not found / not visible under RLS is not an error, just null data.
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
