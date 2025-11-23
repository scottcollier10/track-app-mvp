/**
 * Supabase Browser Client
 *
 * Browser-side Supabase client with auth session management
 * Use this in Client Components
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

/**
 * Browser-side Supabase client with cookie-based auth
 * Automatically handles auth sessions via cookies
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use createClient() instead
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
