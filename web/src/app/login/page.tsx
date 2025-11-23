/**
 * Login Page
 *
 * Public page for user authentication
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Login | Track App',
  description: 'Sign in to your Track App account',
};

export default async function LoginPage() {
  // Redirect if already authenticated
  const user = await getUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <LoginForm />
    </div>
  );
}
