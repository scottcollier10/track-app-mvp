/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmation redirects from Supabase
 * Exchanges auth code for session and redirects to appropriate page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createServerClient();

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
  }

  // Handle different callback types
  if (type === 'recovery') {
    // Password recovery - redirect to reset password page
    return NextResponse.redirect(new URL('/reset-password?type=recovery', requestUrl.origin));
  }

  // Default: redirect to home or specified next URL
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
