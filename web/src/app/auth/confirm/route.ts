// src/app/auth/confirm/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo } from '@/lib/auth/ensure-coach';

// Mirrors /auth/callback (PKCE). Callback stays as a fallback during the
// email-template transition; delete it once token_hash is proven in prod.
const ALLOWED_TYPES: EmailOtpType[] = ['email', 'magiclink', 'invite'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error && data.user) {
      try {
        await ensureCoach(supabaseCoachRepo(supabase), {
          id: data.user.id,
          email: data.user.email,
        });
      } catch (e) {
        console.error('[auth/confirm] coach linking failed', e);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=link`);
      }
      return NextResponse.redirect(`${origin}/coach`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
