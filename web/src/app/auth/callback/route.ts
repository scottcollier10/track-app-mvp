// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo } from '@/lib/auth/ensure-coach';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      try {
        await ensureCoach(supabaseCoachRepo(supabase), {
          id: data.user.id,
          email: data.user.email,
        });
      } catch (e) {
        console.error('[auth/callback] coach linking failed', e);
        return NextResponse.redirect(`${origin}/login?error=link`);
      }
      return NextResponse.redirect(`${origin}/coach`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
