/**
 * Authentication Actions
 *
 * Server actions for authentication flows
 * Use these in Server Components and Server Actions
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '../supabase/server';
import type {
  SignUpCredentials,
  SignInCredentials,
  ResetPasswordCredentials,
  UpdatePasswordCredentials,
} from './types';

/**
 * Sign up a new user with email and password
 */
export async function signUp(credentials: SignUpCredentials) {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        name: credentials.name,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(credentials: SignInCredentials) {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { data };
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Send password reset email
 */
export async function resetPassword(credentials: ResetPasswordCredentials) {
  const supabase = await createServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(credentials.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
  });

  if (error) {
    return { error: error.message };
  }

  return { message: 'Password reset email sent. Check your inbox.' };
}

/**
 * Update user password (requires active session)
 */
export async function updatePassword(credentials: UpdatePasswordCredentials) {
  const supabase = await createServerClient();

  const { error } = await supabase.auth.updateUser({
    password: credentials.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { message: 'Password updated successfully' };
}

/**
 * Sign in with OAuth provider (Google, Apple, etc.)
 */
export async function signInWithProvider(provider: 'google' | 'apple') {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { data };
}
