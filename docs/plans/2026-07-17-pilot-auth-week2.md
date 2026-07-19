# Pilot Auth (Week 2) Implementation Plan — RLS + Full Client Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RLS the real tenant boundary: coach-scoped policies on every table, all code migrated off the legacy anon client, `DEMO_COACH_ID` removed, invite-only signup, and cross-device magic links via token_hash.

**Architecture:** Swap every `createServerClient()` (legacy anon, `src/lib/supabase/client.ts`) call for the cookie-based `createServerSupabase()` (`src/lib/supabase/server.ts`), guard API routes with `getCurrentCoach()`, then flip RLS from `USING (true)` to coach-scoped policies keyed on `coaches.auth_user_id = auth.uid()`. RLS SQL is committed but applied manually in the dashboard AFTER deploy (new code works under both permissive and strict policies).

**Tech Stack:** Next.js 14.1 (App Router), `@supabase/ssr` 0.7.0, Supabase Auth + RLS, Jest.

**Working directory:** `/Users/scottcollier/dev/track-app-mvp/.worktrees/pilot-auth/web` (branch `pilot-rls`)

**Design doc:** `docs/plans/2026-07-17-pilot-auth-week2-design.md`

---

## Context the executor needs

- **Live DB is the source of truth.** Real schema: `web/src/reference/track-app-supabase-schema_v2.4.txt`. FK chain: `laps → sessions → drivers → coaches`; `coaching_notes → sessions`; `driver_profiles → drivers`; `tracks`, `users`, `rag_documents`, `rag_chunks`, `llm_logs` have no coach FK. `coaches.auth_user_id uuid UNIQUE → auth.users(id)` was added in week 1.
- **SQL is applied manually** in the Supabase dashboard SQL editor. Commit every migration file to `web/supabase/migrations/` anyway.
- **Known-failing baseline:** 17 tests in `src/lib/__tests__/insights.test.ts` fail on main. Ignore them. Gate for every task: `npm test -- --testPathIgnorePatterns=insights` → 0 new failures.
- **Week-1 building blocks (already on main):** `createServerSupabase()` in `src/lib/supabase/server.ts`, `getCurrentCoach()` in `src/lib/auth/current-coach.ts` (returns `CoachRow | null`), `ensureCoach`/`supabaseCoachRepo` in `src/lib/auth/ensure-coach.ts`, `isPublicPath` in `src/lib/auth/public-paths.ts`, middleware in `src/middleware.ts`, PKCE callback at `src/app/auth/callback/route.ts`.
- All legacy usage is `const supabase = createServerClient();` inside function bodies — the swap is mechanical (change import + call). `createServerSupabase()` is also synchronous.
- **Do NOT apply RLS SQL to the live DB during development.** It is a deploy-time step (Task 10). Code must work under today's permissive policies.
- **Do NOT change Supabase email templates until Task 10.** Prod logins depend on the current templates.

---

### Task 1: Delete backup/dead files

**Files (delete):**
- `src/data/_sessions.ts`
- `src/data/coachDashboard.backup.ts`
- `src/lib/queries/driver-progress backup.ts`
- `src/app/coach/page.tsx.backup`
- `src/app/coach/page-original-backup.tsx`
- `src/app/coach/page-dashboard-b.tsx`

**Step 1.1:** Confirm nothing imports them: `grep -rn "_sessions\|coachDashboard.backup\|driver-progress backup\|page-original-backup\|page-dashboard-b" src --include='*.ts*' -l` — expect only the files themselves (backup page files may fail the build if they are `.tsx` at routable paths; they are not routable — `page.tsx.backup` and non-`page.tsx` names are ignored by the router).

**Step 1.2:** Delete the six files with `git rm`.

**Step 1.3:** Run: `npx tsc --noEmit` (expect baseline errors only) and `npm test -- --testPathIgnorePatterns=insights` (0 new failures).

**Step 1.4: Commit**
```bash
git commit -m "chore: delete backup and dead files (incl. stale DEMO_COACH_ID copies)"
```

---

### Task 2: Migrate data layer + server pages to createServerSupabase

**Files (modify, same recipe each):**
- `src/data/drivers.ts`, `src/data/sessions.ts`, `src/data/tracks.ts`, `src/data/driverProfiles.ts`, `src/data/driverProgress.ts`, `src/data/coachDashboard.ts`
- `src/lib/queries/driver-progress.ts`, `src/lib/llm-telemetry.ts`
- `src/app/page.tsx`, `src/app/profile/page.tsx`, `src/app/test-progress/page.tsx`

**Step 2.1:** In each file replace:
```typescript
import { createServerClient } from '@/lib/supabase/client';
```
with
```typescript
import { createServerSupabase } from '@/lib/supabase/server';
```
and every `createServerClient()` call with `createServerSupabase()`. No other changes — function signatures stay; RLS will do the scoping.

**Step 2.2:** Verify no data/page file still uses the legacy client:
Run: `grep -rn "supabase/client" src/data src/lib/queries src/lib/llm-telemetry.ts src/app --include='*.ts*' | grep -v src/app/api`
Expected: no output.

**Step 2.3:** Run: `npx tsc --noEmit` → baseline only. Run: `npm run build`. If a page errors with "cookies was called outside a request scope", add `export const dynamic = 'force-dynamic';` to that page and re-run.

**Step 2.4:** Run: `npm test -- --testPathIgnorePatterns=insights` → 0 new failures.

**Step 2.5: Commit**
```bash
git commit -am "refactor(auth): migrate data layer and pages to cookie-based supabase client"
```

---

### Task 3: Migrate simple API routes + add 401 guards

**Files (modify):**
- `src/app/api/tracks/route.ts`
- `src/app/api/add-note/route.ts`
- `src/app/api/sessions/[id]/notes/route.ts`
- `src/app/api/drivers/[id]/stats/route.ts`
- `src/app/api/drivers/[id]/progress/route.ts`
- `src/app/api/coaching/generate/route.ts`
- Routes using the data layer only (`/api/drivers`, `/api/sessions`, `/api/profile/update`, `/api/drivers/[id]/progress-summary`, `/api/tracks/[id]`): guard only, no client swap needed.
- Skip: `src/app/api/templates/[template]/route.ts` (static CSV generation, no DB).

**Step 3.1:** In each route, swap client import/call as in Task 2, and add at the top of each handler (before any DB work):
```typescript
import { getCurrentCoach } from '@/lib/auth/current-coach';
// ...inside the handler:
const coach = await getCurrentCoach();
if (!coach) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```
Where the handler has a try/catch, put the guard inside the try.

**Step 3.2:** Manual spot check: `npm run dev`, then `curl -i http://localhost:3000/api/tracks` (no cookie) → expect 307 today (middleware still redirects; becomes 401 in Task 6 — the route-level guard is defense in depth).

**Step 3.3:** Run: `npx tsc --noEmit` and `npm test -- --testPathIgnorePatterns=insights` → clean.

**Step 3.4: Commit**
```bash
git commit -am "feat(auth): require session in API routes, migrate to cookie client"
```

---

### Task 4: import-session — kill DEMO_COACH_ID

**Files:**
- Modify: `src/app/api/import-session/route.ts`

**Step 4.1:** Delete line 14 (`const DEMO_COACH_ID = ...`). Swap the client import/call as in Task 2. Add the `getCurrentCoach()` 401 guard at the top of the `try`. Replace line 51:
```typescript
coach_id: DEMO_COACH_ID, // Auto-assign to demo coach
```
with
```typescript
coach_id: coach.id,
```
Also scope the driver lookup (line 36-40) to the coach so one coach cannot attach sessions to another coach's driver with the same email:
```typescript
const { data: existingDriver } = await (supabase
  .from('drivers') as any)
  .select('*')
  .eq('email', payload.driverEmail)
  .eq('coach_id', coach.id)
  .single();
```

**Step 4.2:** Verify: `grep -rn "DEMO_COACH_ID" src` → no output.

**Step 4.3:** Manual test: sign in locally, import a CSV via the UI → session appears; new driver rows get your coach id (check Supabase table editor).

**Step 4.4:** Run gate suite → clean.

**Step 4.5: Commit**
```bash
git commit -am "feat(auth): derive import-session coach from session, remove DEMO_COACH_ID"
```

---

### Task 5: coaches/[coachId] routes — validate ownership, then delete client.ts

**Files:**
- Modify: `src/app/api/coaches/[coachId]/drivers/route.ts`
- Modify: `src/app/api/coaches/[coachId]/comparison/route.ts`
- Delete: `src/lib/supabase/client.ts`

**Step 5.1:** In both routes: swap client, add guard, and after the guard:
```typescript
if (params.coachId !== coach.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```
(Adapt to the file's actual params access pattern — read the file first.)

**Step 5.2:** Verify zero importers remain: `grep -rn "supabase/client" src` → no output. Then `git rm src/lib/supabase/client.ts`.

**Step 5.3:** Run: `npx tsc --noEmit`, `npm run build`, gate suite → clean. The deleted file is the proof the migration is complete.

**Step 5.4: Commit**
```bash
git commit -am "feat(auth): enforce coach ownership on coachId routes, delete legacy anon client"
```

---

### Task 6: Middleware returns 401 JSON for APIs (TDD)

**Files:**
- Modify: `src/lib/auth/public-paths.ts`
- Modify: `src/lib/auth/__tests__/public-paths.test.ts`
- Modify: `src/middleware.ts`

**Step 6.1: Write the failing test** (append to public-paths.test.ts):
```typescript
import { isApiPath } from '../public-paths';

describe('isApiPath', () => {
  it.each(['/api/sessions', '/api/import-session', '/api/coaches/c-1/drivers'])(
    'treats %s as API',
    (path) => expect(isApiPath(path)).toBe(true)
  );
  it.each(['/', '/login', '/coach', '/apiary'])(
    'treats %s as non-API',
    (path) => expect(isApiPath(path)).toBe(false)
  );
});
```

**Step 6.2:** Run: `npm test -- public-paths` → FAIL ("isApiPath is not a function" or module error).

**Step 6.3: Implement** (append to public-paths.ts):
```typescript
export function isApiPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return pathname === '/api' || pathname.startsWith('/api/');
}
```

**Step 6.4:** Run: `npm test -- public-paths` → PASS.

**Step 6.5:** In `src/middleware.ts`, import `isApiPath` and change the unauthenticated branch:
```typescript
if (!user && !isPublicPath(request.nextUrl.pathname)) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}
```

**Step 6.6:** Manual: `curl -i http://localhost:3000/api/tracks` (no cookie) → `401` JSON, not 307. Gate suite → clean.

**Step 6.7: Commit**
```bash
git commit -am "feat(auth): return 401 JSON for unauthenticated API requests"
```

---

### Task 7: Invite-only signup

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 7.1:** In `handleSubmit`, change the `signInWithOtp` options (note `emailRedirectTo` now points at `/auth/confirm` for Task 8's flow):
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: `${window.location.origin}/auth/confirm`,
  },
});
```
And map the unknown-email error to a friendly message:
```typescript
if (error) {
  const inviteOnly =
    error.status === 422 || /signups? not allowed/i.test(error.message);
  setErrorMsg(
    inviteOnly
      ? 'This pilot is invite-only. Contact Scott to get access.'
      : error.message
  );
  setStatus('error');
}
```

**Step 7.2:** Manual: `npm run dev`, `/login`, submit an email with no auth user → invite-only message. Submit your real (already-registered) email → "Check your email".

**Step 7.3:** Gate suite → clean.

**Step 7.4: Commit**
```bash
git commit -am "feat(auth): invite-only signup with friendly error"
```

---

### Task 8: /auth/confirm route (token_hash) + public path (TDD)

**Files:**
- Modify: `src/lib/auth/public-paths.ts` + test
- Create: `src/app/auth/confirm/route.ts`

**Step 8.1: Failing test** — add `'/auth/confirm', '/auth/confirm?token_hash=abc&type=email'` to the public-paths `it.each` allow list. Run `npm test -- public-paths` → FAIL.

**Step 8.2:** Add `'/auth/confirm'` to `PUBLIC_PREFIXES`. Run → PASS.

**Step 8.3: Write the route:**
```typescript
// src/app/auth/confirm/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureCoach, supabaseCoachRepo } from '@/lib/auth/ensure-coach';

// Mirrors /auth/callback (PKCE). Callback stays as a fallback during the
// template transition; delete it once token_hash is proven in prod.
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
```

**Step 8.4:** Run: `npx tsc --noEmit` + gate suite → clean. Full e2e of this route happens at Task 10 (needs the email-template change; current templates still route to `/auth/callback`, which keeps working).

**Step 8.5: Commit**
```bash
git commit -am "feat(auth): add token_hash /auth/confirm route for cross-device magic links"
```

---

### Task 9: RLS migration + rollback + verification script (committed, NOT applied)

**Files:**
- Create: `supabase/migrations/20260718_coach_scoped_rls.sql`
- Create: `supabase/rollback-rls.sql`
- Create: `supabase/verify-rls.sql`

**Step 9.1: Migration SQL:**
```sql
-- Coach-scoped RLS. Anon role gets NO policies: unauthenticated sees nothing.
-- Applied manually in the dashboard AFTER the week-2 code deploy.

-- 1. Drop all existing (permissive) policies on affected tables
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('coaches','drivers','sessions','laps','coaching_notes',
                        'driver_profiles','tracks','users','rag_documents',
                        'rag_chunks','llm_logs')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 2. Helper: coach id for the current auth user
create or replace function public.current_coach_id()
returns uuid language sql stable as $$
  select id from public.coaches where auth_user_id = (select auth.uid())
$$;

-- 3. coaches — email arm lets an invited coach claim their unlinked row
create policy coaches_select on public.coaches for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (auth_user_id is null
        and lower(email) = lower((select auth.jwt()->>'email')))
  );
create policy coaches_update on public.coaches for update to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (auth_user_id is null
        and lower(email) = lower((select auth.jwt()->>'email')))
  )
  with check (auth_user_id = (select auth.uid()));
create policy coaches_insert on public.coaches for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

-- 4. drivers
create policy drivers_all on public.drivers for all to authenticated
  using (coach_id = public.current_coach_id())
  with check (coach_id = public.current_coach_id());

-- 5. sessions / driver_profiles (chain via drivers)
create policy sessions_all on public.sessions for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = sessions.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = sessions.driver_id
                        and d.coach_id = public.current_coach_id()));
create policy driver_profiles_all on public.driver_profiles for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = driver_profiles.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = driver_profiles.driver_id
                        and d.coach_id = public.current_coach_id()));

-- 6. laps / coaching_notes (chain via sessions -> drivers)
create policy laps_all on public.laps for all to authenticated
  using (exists (select 1 from public.sessions s
                 join public.drivers d on d.id = s.driver_id
                 where s.id = laps.session_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.sessions s
                      join public.drivers d on d.id = s.driver_id
                      where s.id = laps.session_id
                        and d.coach_id = public.current_coach_id()));
create policy coaching_notes_all on public.coaching_notes for all to authenticated
  using (exists (select 1 from public.sessions s
                 join public.drivers d on d.id = s.driver_id
                 where s.id = coaching_notes.session_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.sessions s
                      join public.drivers d on d.id = s.driver_id
                      where s.id = coaching_notes.session_id
                        and d.coach_id = public.current_coach_id()));

-- 7. Shared / non-tenant tables
create policy tracks_select on public.tracks for select to authenticated using (true);
create policy tracks_insert on public.tracks for insert to authenticated with check (true);
create policy users_select on public.users for select to authenticated using (true);
create policy rag_documents_select on public.rag_documents for select to authenticated using (true);
create policy rag_chunks_select on public.rag_chunks for select to authenticated using (true);
create policy llm_logs_select on public.llm_logs for select to authenticated using (true);
create policy llm_logs_insert on public.llm_logs for insert to authenticated with check (true);
```
**Executor note:** before committing, cross-check the table list against the live schema reference (`src/reference/track-app-supabase-schema_v2.4.txt`) and `.from('...')` calls in `src` — if `llm_logs` or `users` does not exist in the live DB, drop those statements rather than letting the migration fail; if extra tables exist with RLS enabled, add authenticated-read policies for them.

**Step 9.2: rollback-rls.sql** — same drop-all `do $$` block, then for each table in the list: `create policy <table>_permissive on public.<table> for all using (true) with check (true);` (restores pre-week-2 behavior; anon access returns because permissive policies apply to all roles).

**Step 9.3: verify-rls.sql** — template with placeholders Scott fills in from the dashboard:
```sql
-- Run in the SQL editor AFTER applying the migration.
-- Fill in the two auth user ids + emails first.
begin;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"<COACH_A_AUTH_USER_ID>","email":"<coach-a-email>","role":"authenticated"}';
select 'A sees own drivers' as check, count(*) > 0 as pass from drivers;
select 'A sees own sessions' as check, count(*) > 0 as pass from sessions;
rollback;

begin;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"<COACH_B_AUTH_USER_ID>","email":"<coach-b-email>","role":"authenticated"}';
select 'B cannot see A drivers' as check, count(*) = 0 as pass
  from drivers where coach_id <> public.current_coach_id();
select 'B cannot see A coaches row' as check, count(*) = 0 as pass
  from coaches where auth_user_id is distinct from auth.uid();
rollback;

begin;
set local role anon;
select 'anon sees nothing' as check, count(*) = 0 as pass from drivers;
rollback;
```

**Step 9.4: Commit**
```bash
git add supabase/migrations/20260718_coach_scoped_rls.sql supabase/rollback-rls.sql supabase/verify-rls.sql
git commit -m "feat(auth): add coach-scoped RLS migration, rollback, and verification scripts"
```

---

### Task 10: Build, deploy, and the manual dashboard flip (Scott-gated)

**Step 10.1:** `npm run build` → succeeds. Local e2e under permissive RLS: login (existing callback flow), dashboard, CSV import, sign out.

**Step 10.2:** Open PR `pilot-rls → main`. **STOP — everything below needs Scott's go-ahead and dashboard access.**

**Step 10.3: Post-merge/deploy manual sequence (in order):**
1. Vercel deploy of main (no new env vars).
2. Supabase → Auth → URL Configuration: add `http://localhost:3000/auth/confirm` and `https://trackapp-portal.vercel.app/auth/confirm` to Additional Redirect URLs.
3. Auth → Email Templates:
   - **Magic Link**: link href → `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
   - **Invite user**: link href → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
4. SQL editor: run `supabase/migrations/20260718_coach_scoped_rls.sql`.
5. SQL editor: run `supabase/verify-rls.sql` (fill placeholders; invite a second test coach first via Auth → Invite user). All `pass` columns must be `true`.
6. Prod e2e: request magic link on desktop, open on phone → signs in (token_hash win). Invite-flow e2e with the test coach: accept invite → lands linked to own empty tenant, sees none of Scott's data.
7. Unknown email on `/login` → invite-only message.

**Rollback:** run `supabase/rollback-rls.sql`; revert email templates to `{{ .ConfirmationURL }}`.

---

## Out of scope (week 3+)

- Deleting `/auth/callback` (keep until token_hash proven in prod)
- Regenerating `src/lib/types/database.ts` (remove `as any` casts)
- Fixing the 17 stale insights tests
- `users` table cleanup (likely dead)
- **LLM telemetry is a silent no-op**: `llm-telemetry.ts` writes to `llm_logs`, which does not exist in the DB (discovered when the RLS migration 42P01'd on it, 2026-07-18). Decide: create the table (then re-run the RLS migration — its guarded llm_logs block applies policies automatically) or delete the dead telemetry writes.
- Regenerate `web/src/reference/track-app-supabase-schema_v2.4.txt` — stale vs prod (claims global UNIQUE on drivers.email; prod has UNIQUE(coach_id, email))
- Custom SMTP for auth emails — Supabase built-in email service rate-limits to a few emails/hour, which blocks multi-coach pilot logins (hit 2026-07-18)
- Show logged-in coach identity (name when available, else email) in the header — needed when testing with multiple coaches, better UX generally (Scott, 2026-07-19)
- Unknown-email invite-only message says "request invite from Scott" — consider including a contact email address
- Profile page uses demo-era `.from('drivers').limit(1).single()` (`src/app/profile/page.tsx:15`) — errors with "Cannot coerce the result to a single JSON object" for any coach with zero drivers
