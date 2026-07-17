# Pilot Auth (Week 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase magic-link authentication to the TrackApp web portal so only logged-in coaches can reach it, with each auth user linked to a `coaches` row.

**Architecture:** Introduce `@supabase/ssr` cookie-based clients (browser + server), a Next.js middleware that refreshes the session and redirects unauthenticated visitors to `/login`, a magic-link login page, and an `/auth/callback` route that exchanges the code and links/creates the coach row. Existing anon-key API routes keep working (RLS tightening is Week 2). All work happens in the `web/` directory of the `pilot-auth` worktree.

**Tech Stack:** Next.js 14.1 (App Router), `@supabase/ssr` 0.7.0 (already in package.json), Supabase Auth (email OTP/magic link), Jest.

**Working directory:** `/Users/scottcollier/dev/track-app-mvp/.worktrees/pilot-auth/web`

---

## Context the executor needs

- **Live DB is the source of truth, not the committed migrations.** `web/supabase/migrations/20240101_initial_schema.sql` is drifted. The real schema is documented in `web/src/reference/track-app-supabase-schema_v2.4.txt`: `coaches(id uuid PK, name text, email text unique, created_at)`, `drivers.coach_id uuid FK → coaches.id`, `sessions → drivers`, `laps → sessions`. RLS is enabled everywhere but with permissive `USING (true)` policies.
- **SQL changes are applied manually** in the Supabase dashboard SQL editor (no CLI link is configured). Still commit each migration file to `web/supabase/migrations/` for the record.
- **Known-failing baseline:** 17 tests in `src/lib/__tests__/insights.test.ts` fail on main. Ignore them. The gate for every task is: no NEW failures. Use `npm test -- --testPathIgnorePatterns=insights` for a clean signal (expect 37+ passing, 0 failing).
- **Existing client:** `src/lib/supabase/client.ts` exports a shared anon `supabase` and `createServerClient()`. Do NOT delete or modify it this week — ~9 API routes and many components import it. Week 2 migrates them.
- **Known consequence, accepted:** after middleware ships, the public portal (and the landing page "Live Demo" CTA at trackapp-portal.vercel.app) requires login. Scott demos from his own seeded account.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` already exist in `web/.env.local` (present locally, gitignored).

---

### Task 0: Manual Supabase dashboard prep (Scott or executor with dashboard access)

No code. In the Supabase project dashboard:

1. Authentication → Providers → Email: ensure Email provider is ON. Passwordless magic links work out of the box; no password config needed.
2. Authentication → URL Configuration:
   - Site URL: `https://trackapp-portal.vercel.app`
   - Additional redirect URLs: `http://localhost:3000/auth/callback`, `https://trackapp-portal.vercel.app/auth/callback`
3. SQL editor — run and verify no error:

```sql
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id);
```

**Step 0.1:** Save the same SQL to `supabase/migrations/20260717_add_auth_user_id_to_coaches.sql` (create the file even though it is applied manually).

**Step 0.2: Commit**

```bash
git add supabase/migrations/20260717_add_auth_user_id_to_coaches.sql
git commit -m "feat(auth): add auth_user_id column to coaches"
```

---

### Task 1: SSR Supabase clients

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`

**Step 1.1: Create the browser client**

```typescript
// src/lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 1.2: Create the server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../types/database';

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

Note: the function is named `createServerSupabase` (not `createServerClient`) to avoid colliding with the legacy export in `client.ts`.

**Step 1.3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: same errors as baseline (run on a clean tree first if unsure), no NEW errors mentioning `supabase/browser` or `supabase/server`.

**Step 1.4: Commit**

```bash
git add src/lib/supabase/browser.ts src/lib/supabase/server.ts
git commit -m "feat(auth): add @supabase/ssr browser and server clients"
```

---

### Task 2: Public-path logic (TDD)

The middleware needs to know which paths skip auth. Pure function, so test it first.

**Files:**
- Create: `src/lib/auth/public-paths.ts`
- Test: `src/lib/auth/__tests__/public-paths.test.ts`

**Step 2.1: Write the failing test**

```typescript
// src/lib/auth/__tests__/public-paths.test.ts
import { isPublicPath } from '../public-paths';

describe('isPublicPath', () => {
  it.each(['/login', '/auth/callback', '/auth/callback?code=abc'])(
    'allows %s without auth',
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(['/', '/coach', '/drivers', '/import', '/sessions/123', '/api/sessions'])(
    'requires auth for %s',
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    }
  );
});
```

**Step 2.2: Run test to verify it fails**

Run: `npm test -- public-paths`
Expected: FAIL, "Cannot find module '../public-paths'"

**Step 2.3: Write minimal implementation**

```typescript
// src/lib/auth/public-paths.ts
const PUBLIC_PREFIXES = ['/login', '/auth/callback'];

export function isPublicPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
```

**Step 2.4: Run test to verify it passes**

Run: `npm test -- public-paths`
Expected: PASS (8 tests)

**Step 2.5: Commit**

```bash
git add src/lib/auth/public-paths.ts src/lib/auth/__tests__/public-paths.test.ts
git commit -m "feat(auth): add public path matcher"
```

---

### Task 3: Middleware

**Files:**
- Create: `src/middleware.ts` (must live in `src/` because the app uses `src/app`)

**Step 3.1: Write the middleware**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/auth/public-paths';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 3.2: Verify redirect behavior manually**

Run: `npm run dev`
- Visit `http://localhost:3000/coach` → expect redirect to `/login` (404 for now — page comes in Task 4; the redirect itself is the check)
- Visit `http://localhost:3000/login` → expect 404 but NO redirect loop

**Step 3.3: Run test suite**

Run: `npm test -- --testPathIgnorePatterns=insights`
Expected: all pass, 0 new failures

**Step 3.4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): protect all routes with session middleware"
```

---

### Task 4: Login page (magic link)

**Files:**
- Create: `src/app/login/page.tsx`

**Step 4.1: Write the page**

```tsx
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="mb-2 text-xl font-semibold text-white">Track App</h1>
        <p className="mb-6 text-sm text-slate-400">
          Instructor portal. Sign in with your email — no password needed.
        </p>
        {status === 'sent' ? (
          <p className="text-sm text-emerald-400">
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
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {status === 'error' && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
```

Match styling to the existing app if it differs — check `src/app/page.tsx` for the actual palette/classes in use and mirror them.

Note: the page now also surfaces callback failures — it reads `?error=auth|link` (set by `/auth/callback`) via `useSearchParams()` (wrapped in `<Suspense>`) and shows an explanatory banner above the form.

**Step 4.2: Manual check**

Run: `npm run dev`, visit `/login`, submit your real email.
Expected: "Check your email" state appears; magic-link email arrives (link will land on `/auth/callback`, which 404s until Task 5 — that is fine).

**Step 4.3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): add magic-link login page"
```

---

### Task 5: Coach linking logic (TDD)

When a user completes the magic link, link them to a `coaches` row: match by `auth_user_id`, else by `email` (backfill link), else create a new coach. Pure decision logic, injected data access — testable without Supabase.

**Files:**
- Create: `src/lib/auth/ensure-coach.ts`
- Test: `src/lib/auth/__tests__/ensure-coach.test.ts`

**Step 5.1: Write the failing test**

```typescript
// src/lib/auth/__tests__/ensure-coach.test.ts
import { ensureCoach, type CoachRepo } from '../ensure-coach';

function makeRepo(overrides: Partial<CoachRepo> = {}): CoachRepo {
  return {
    findByAuthUserId: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    linkAuthUser: jest.fn().mockImplementation(async (id) => ({ id, name: 'X', email: 'x@x.com' })),
    create: jest.fn().mockResolvedValue({ id: 'new-id', name: 'scott', email: 's@x.com' }),
    ...overrides,
  };
}

const user = { id: 'auth-1', email: 'scott@example.com' };

describe('ensureCoach', () => {
  it('returns existing coach already linked to auth user', async () => {
    const coach = { id: 'c-1', name: 'Scott', email: 'scott@example.com' };
    const repo = makeRepo({ findByAuthUserId: jest.fn().mockResolvedValue(coach) });
    expect(await ensureCoach(repo, user)).toEqual(coach);
    expect(repo.findByEmail).not.toHaveBeenCalled();
  });

  it('links an existing coach row by email on first login', async () => {
    const coach = { id: 'c-2', name: 'Scott', email: 'scott@example.com' };
    const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue(coach) });
    await ensureCoach(repo, user);
    expect(repo.linkAuthUser).toHaveBeenCalledWith('c-2', 'auth-1');
  });

  it('creates a coach when no match exists', async () => {
    const repo = makeRepo();
    await ensureCoach(repo, user);
    expect(repo.create).toHaveBeenCalledWith({
      name: 'scott',
      email: 'scott@example.com',
      auth_user_id: 'auth-1',
    });
  });

  it('throws when auth user has no email', async () => {
    await expect(ensureCoach(makeRepo(), { id: 'auth-1', email: undefined })).rejects.toThrow();
  });
});
```

**Step 5.2: Run test to verify it fails**

Run: `npm test -- ensure-coach`
Expected: FAIL, "Cannot find module '../ensure-coach'"

**Step 5.3: Write the implementation**

```typescript
// src/lib/auth/ensure-coach.ts
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

  // Supabase Auth lowercases emails; normalize so seeded mixed-case rows still match.
  const email = user.email.toLowerCase();

  // Concurrent first-login races are backstopped by DB unique constraints on
  // email and auth_user_id (no retry logic — intentional).
  const linked = await repo.findByAuthUserId(user.id);
  if (linked) return linked;

  const byEmail = await repo.findByEmail(email);
  if (byEmail) return repo.linkAuthUser(byEmail.id, user.id);

  return repo.create({
    name: email.split('@')[0],
    email,
    auth_user_id: user.id,
  });
}
```

**Step 5.4: Run test to verify it passes**

Run: `npm test -- ensure-coach`
Expected: PASS (4 tests)

**Step 5.5: Add the Supabase-backed repo (same file)**

```typescript
// append to src/lib/auth/ensure-coach.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export function supabaseCoachRepo(supabase: SupabaseClient<any>): CoachRepo {
  return {
    async findByAuthUserId(authUserId) {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async findByEmail(email) {
      // Case-insensitive match: coaches.email is plain text and may be seeded
      // with mixed case. Escape ilike wildcards so the email is matched literally.
      const escaped = email.replace(/([%_\\])/g, '\\$1');
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name, email')
        .ilike('email', escaped)
        .maybeSingle();
      if (error) throw error;
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
```

Typing note: `coaches` is likely missing from `src/lib/types/database.ts` (schema drift). Use `SupabaseClient<any>` here as shown rather than fighting the generated types; regenerating types is a Week 2 cleanup.

**Step 5.6: Run full suite**

Run: `npm test -- --testPathIgnorePatterns=insights`
Expected: all pass, 0 new failures

**Step 5.7: Commit**

```bash
git add src/lib/auth/ensure-coach.ts src/lib/auth/__tests__/ensure-coach.test.ts
git commit -m "feat(auth): add coach linking logic with tests"
```

---

### Task 6: Auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

**Step 6.1: Write the route**

```typescript
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
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=link`);
      }
      return NextResponse.redirect(`${origin}/coach`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**Step 6.2: End-to-end manual test**

1. `npm run dev`
2. Visit `/login`, submit your email
3. Click the magic link in the email
4. Expected: redirected to `/coach`, page loads (still shows all demo data — RLS is Week 2)
5. In Supabase dashboard, Table editor → `coaches`: your email now has a row with `auth_user_id` set. If your email matched an existing seeded coach, that row got linked instead of a new one being created.

**Step 6.3: Run suite, commit**

Run: `npm test -- --testPathIgnorePatterns=insights` → 0 new failures

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): add auth callback with coach linking"
```

---

### Task 7: Current-coach helper + sign out

**Files:**
- Create: `src/lib/auth/current-coach.ts`
- Create: `src/app/logout/route.ts`
- Modify: `src/app/layout.tsx` (add a small sign-out link to the existing nav — read the file first and follow its structure)

**Step 7.1: Current-coach helper (used by Week 2 API migration; created now so the contract exists)**

```typescript
// src/lib/auth/current-coach.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo, type CoachRow } from './ensure-coach';

export async function getCurrentCoach(): Promise<CoachRow | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureCoach(supabaseCoachRepo(supabase), {
    id: user.id,
    email: user.email,
  });
}
```

**Step 7.2: Logout route**

```typescript
// src/app/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 302 });
}
```

**Step 7.3: Add sign-out to the nav**

Read `src/app/layout.tsx` first. Add a minimal form-based button wherever the nav items live:

```tsx
<form action="/logout" method="post">
  <button type="submit" className="text-sm text-slate-400 hover:text-white">
    Sign out
  </button>
</form>
```

**Step 7.4: Manual test**

Sign out → lands on `/login`. Visit `/coach` → redirected to `/login`. Sign back in → works.

**Step 7.5: Run suite, commit**

Run: `npm test -- --testPathIgnorePatterns=insights` → 0 new failures

```bash
git add src/lib/auth/current-coach.ts src/app/logout/route.ts src/app/layout.tsx
git commit -m "feat(auth): add current-coach helper and sign out"
```

---

### Task 8: Build check + deploy notes

**Step 8.1:** Run: `npm run build`
Expected: build succeeds (baseline TS state; no new errors from auth files).

**Step 8.2:** Deployment checklist (do NOT deploy without Scott's go-ahead — this locks the public demo behind login):
- Vercel project `trackapp-portal`: no new env vars needed (`NEXT_PUBLIC_SUPABASE_*` already set)
- Supabase redirect URLs from Task 0 must include the production callback
- After deploy: full magic-link round trip on production

**Step 8.3: Final commit if anything outstanding, then report**

Suite state to report: `npm test` → 17 known insights failures only; everything else green.

---

## Out of scope (Week 2+, do not do now)

- **Invite-only signup (from Task 4 code review):** `signInWithOtp` defaults to `shouldCreateUser: true`, so any email can create an auth user + coach row. Fine for open pilot; if pilot should be invite-only, set `shouldCreateUser: false` and pre-create coaches.
- **Middleware matcher hardening (from Task 3 code review):** the static-asset extension exclusion is bypassable via dynamic segments (e.g. `/sessions/123.png` skips middleware). Middleware must not remain the only auth boundary — week 2's route-level auth closes this. Also: API routes should return 401 JSON instead of 307 redirects once migrated.
- RLS policy replacement (`USING (true)` → coach-scoped) and migrating the 9 API routes off the legacy anon client to `createServerSupabase()`
- Deriving `coachId` from session in `/api/coaches/[coachId]/*` and removing `DEMO_COACH_ID` from `src/app/api/import-session/route.ts`
- Deleting backup page copies (`src/app/coach/page*.backup*`, `page-original-backup.tsx`, `page-dashboard-b.tsx`)
- Regenerating `database.ts` types
- Fixing the 17 stale `insights.test.ts` failures (optional warm-up if time allows, separate commit)
- Consider token_hash/verifyOtp flow instead of PKCE code exchange — magic links opened in a different browser than the requesting one fail with the current flow (code_verifier cookie missing)
