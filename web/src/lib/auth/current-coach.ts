// src/lib/auth/current-coach.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo, type CoachRow } from './ensure-coach';

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
