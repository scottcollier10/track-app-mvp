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

  const linked = await repo.findByAuthUserId(user.id);
  if (linked) return linked;

  const byEmail = await repo.findByEmail(user.email);
  if (byEmail) return repo.linkAuthUser(byEmail.id, user.id);

  return repo.create({
    name: user.email.split('@')[0],
    email: user.email,
    auth_user_id: user.id,
  });
}

export function supabaseCoachRepo(supabase: SupabaseClient<any>): CoachRepo {
  return {
    async findByAuthUserId(authUserId) {
      const { data } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      return data ?? null;
    },
    async findByEmail(email) {
      const { data } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('email', email)
        .maybeSingle();
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
