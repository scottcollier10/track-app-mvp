'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  auth: "That sign-in link didn't work. It may have expired or been opened in a different browser — request a new one below.",
  link: "We couldn't finish setting up your account. Request a new link below; if it keeps happening, contact us.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get('error');
  const callbackErrorMsg = callbackError
    ? CALLBACK_ERROR_MESSAGES[callbackError] ?? CALLBACK_ERROR_MESSAGES.auth
    : null;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      const inviteOnly =
        error.status === 422 || /signups? not allowed/i.test(error.message);
      setErrorMsg(
        inviteOnly
          ? 'This pilot is invite-only. Contact Scott to get access.'
          : error.message
      );
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90 p-8 shadow-[0_22px_50px_rgba(0,0,0,0.60)]">
        <h1 className="mb-2 text-xl font-semibold text-white">Track App</h1>
        <p className="mb-6 text-sm text-slate-400">
          Instructor portal. Sign in with your email — no password needed.
        </p>
        {callbackErrorMsg && status !== 'sent' && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {callbackErrorMsg}
          </p>
        )}
        {status === 'sent' ? (
          <p role="status" aria-live="polite" className="text-sm text-emerald-300">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              autoComplete="email"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {status === 'error' && (
              <p role="alert" className="text-sm text-red-400">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
