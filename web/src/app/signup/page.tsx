/**
 * Signup Page
 *
 * Public page for user registration
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import SignupForm from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Sign Up | Track App',
  description: 'Create a new Track App account',
};

export default async function SignupPage() {
  // Redirect if already authenticated
  const user = await getUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <SignupForm />
    </div>
  );
}
