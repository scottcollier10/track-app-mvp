/**
 * Supabase Client
 *
 * Creates and exports Supabase client instances for browser and server use
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

/**
 * Browser-side Supabase client
 * Use this in Client Components and API routes
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Create a new Supabase client for server-side usage
 * Use this in Server Components, API routes, and server actions
 */
export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
