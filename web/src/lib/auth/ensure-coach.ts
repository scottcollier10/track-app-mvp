import type { SupabaseClient } from '@supabase/supabase-js';

export interface CoachRow {
  id: string;
  name: string;
  email: string;
}

export interface CoachRepo {
  findByAuthUserId(authUserId: string): Promise<CoachRow | null>;
  findByEmail(email: string): Promise<CoachRow | null>;
  linkAuthUser(coachId: string, authUserId: string): Promise<CoachRow>;
  create(input: { name: string; email: string; auth_user_id: string }): Promise<CoachRow>;
}

export interface AuthUserLike {
  id: string;
  email: string | undefined;
}

export async function ensureCoach(repo: CoachRepo, user: AuthUserLike): Promise<CoachRow> {
  if (!user.email) {
    throw new Error('Auth user has no email; cannot link coach');
  }

  // Supabase Auth lowercases emails; normalize so seeded mixed-case rows still match.
  const email = user.email.toLowerCase();

  // Concurrent first-login races are backstopped by DB unique constraints on
  // email and auth_user_id (no retry logic — intentional).
  const linked = await repo.findByAuthUserId(user.id);
  if (linked) return linked;

  const byEmail = await repo.findByEmail(email);
  if (byEmail) return repo.linkAuthUser(byEmail.id, user.id);

  return repo.create({
    name: email.split('@')[0],
    email,
    auth_user_id: user.id,
  });
}

export function supabaseCoachRepo(supabase: SupabaseClient<any>): CoachRepo {
  return {
    async findByAuthUserId(authUserId) {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async findByEmail(email) {
      // Case-insensitive match: coaches.email is plain text and may be seeded
      // with mixed case. Escape ilike wildcards so the email is matched literally.
      const escaped = email.replace(/([%_\\])/g, '\\$1');
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name, email')
        .ilike('email', escaped)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async linkAuthUser(coachId, authUserId) {
      const { data, error } = await supabase
        .from('coaches')
        .update({ auth_user_id: authUserId })
        .eq('id', coachId)
        .select('id, name, email')
        .single();
      if (error) throw error;
      return data;
    },
    async create(input) {
      const { data, error } = await supabase
        .from('coaches')
        .insert(input)
        .select('id, name, email')
        .single();
      if (error) throw error;
      return data;
    },
  };
}
