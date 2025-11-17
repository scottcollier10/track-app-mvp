/**
 * Drivers Data Layer
 *
 * Clean data access functions for drivers
 */

import { createServerClient } from '@/lib/supabase/client';

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
    const supabase = createServerClient();

    const { data, error } = await (supabase
      .from('drivers') as any)
      .select('id, name, email')
      .order('name', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as any, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
