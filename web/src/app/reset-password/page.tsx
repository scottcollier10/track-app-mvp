/**
 * Password Reset Page
 *
 * Public page for password reset requests and updates
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import PasswordResetForm from '@/components/auth/PasswordResetForm';

export const metadata = {
  title: 'Reset Password | Track App',
  description: 'Reset your Track App password',
};

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isRecovery = params.type === 'recovery';

  // Only redirect if not in recovery mode
  if (!isRecovery) {
    const user = await getUser();
    if (user) {
      redirect('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <PasswordResetForm isRecovery={isRecovery} />
    </div>
  );
}
