// src/lib/auth/current-coach.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo, type CoachRow } from './ensure-coach';

/**
 * The signed-in coach, ensured (linked or created) on first sight.
 *
 * NOT wrapped in React `cache()`, though the root layout and a page in the same
 * render both call it. `cache` is not exported by the react this repo installs
 * (18.3.1) — only by the canary React that Next.js vendors for the server
 * layer. Jest resolves the installed one, so the wrap turns every suite that
 * loads a route through this module into "cache is not a function". A duplicate
 * auth round trip is cheaper than a jest shim or a React bump.
 *
 * The typecheck gate cannot catch this for you: `@types/react` ships the canary
 * `cache` declaration, so `import { cache } from 'react'` compiles clean and
 * the production build succeeds. Only jest objects, and only at runtime.
 */
export async function getCurrentCoach(): Promise<CoachRow | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureCoach(supabaseCoachRepo(supabase), {
    id: user.id,
    email: user.email,
  });
}
