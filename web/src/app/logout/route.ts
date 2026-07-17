// src/app/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 302 });
}
