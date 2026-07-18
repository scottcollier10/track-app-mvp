# Pilot Auth Week 2 — Design: RLS, Client Migration, Invite-Only, token_hash

**Decisions (validated with Scott, 2026-07-17):**
1. **Full migration.** All API routes, data-layer files, and server pages move to the cookie-based `createServerSupabase()`. RLS flip is the point of the week; nothing may remain on the legacy anon client.
2. **Invite-only signup.** `shouldCreateUser: false`. Coaches are invited from the Supabase dashboard.
3. **token_hash flow.** New `/auth/confirm` route using `verifyOtp` so magic links work cross-browser/cross-device. `/auth/callback` (PKCE) stays as a fallback during transition.

## Context

- PR #6 (week 1: magic-link auth + coach linking) merged to main 2026-07-17. Week 2 branch: `pilot-rls` off updated main.
- Survey findings: 11 of 14 API routes, 8 data-layer files, and 3 server pages use the legacy `createServerClient()` from `src/lib/supabase/client.ts`. **No file imports the module-level `supabase` export**, and no client components query Supabase directly — migration is a mechanical per-file swap.
- No service-role key anywhere. All access is anon-key + `USING (true)` policies today.
- `DEMO_COACH_ID` active in exactly one file: `src/app/api/import-session/route.ts:14`.

## RLS design

Anon role gets **no policies** → unauthenticated sees nothing. RLS becomes the real boundary even if middleware is bypassed (closes week-1 matcher-hardening concern).

- **coaches**: SELECT/UPDATE `auth_user_id = (select auth.uid()) OR (auth_user_id IS NULL AND lower(email) = lower((select auth.jwt()->>'email')))` — second arm lets `ensureCoach` find and claim an unlinked invited row by email. UPDATE `WITH CHECK (auth_user_id = (select auth.uid()))`. INSERT `WITH CHECK (auth_user_id = (select auth.uid()))` (ensureCoach create-fallback).
- **drivers**: all ops scoped to `current_coach_id()` (SQL helper: coach id for `auth.uid()`).
- **sessions / driver_profiles**: EXISTS chain via drivers. **laps / coaching_notes**: EXISTS chain via sessions → drivers.
- **tracks**: shared reference data — authenticated SELECT/INSERT.
- **users / rag_documents / rag_chunks**: authenticated read. LLM telemetry table (check `llm-telemetry.ts` target): authenticated insert.
- All `auth.uid()` wrapped in `(select ...)` for initplan caching.
- Migration drops existing permissive policies dynamically (`pg_policies` loop), applied manually in dashboard **after** code deploy. Committed `rollback-rls.sql` restores `USING (true)`.

## Client migration & route auth

- Delete backup/dead files first, then swap `createServerClient()` → `createServerSupabase()` in data layer + pages. Signatures unchanged; RLS does the scoping. Finish by **deleting `client.ts`** — zero importers proves completion.
- Every data API route: `getCurrentCoach()` → `401 { error: 'Unauthorized' }` JSON if null.
- `/api/import-session`: coach from session, `DEMO_COACH_ID` deleted.
- `/api/coaches/[coachId]/*`: validate `params.coachId === coach.id` else 403 (honest error instead of RLS-empty).
- Middleware: unauthenticated `/api/*` → 401 JSON instead of 307 redirect (redirects break fetch-based CSV import).

## Auth flow changes

- Login page: `shouldCreateUser: false`; map the "signups not allowed" error to a friendly invite-only message.
- `/auth/confirm` route: accepts `token_hash` + `type` (`email` | `magiclink` | `invite`), `verifyOtp`, then same `ensureCoach` linking + error redirects as callback. Joins public-paths list.
- Login `emailRedirectTo` changes to `/auth/confirm`; email templates use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` so local dev and prod both work (single Supabase project). Invite template uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
- **Template changes are deploy-time steps** — changing them before the confirm route is live in prod breaks prod logins.

## Testing & rollout

- TDD for pure logic (public-paths additions, API-path helper). RLS verified by committed `supabase/verify-rls.sql` (impersonates two coaches via `request.jwt.claims`, asserts cross-tenant reads = 0 rows).
- Gate per task: `npm test -- --testPathIgnorePatterns=insights`, zero new failures (17 insights failures are known-stale baseline).
- Rollout: deploy code (works under permissive AND strict RLS) → dashboard: redirect URLs, email templates, apply RLS SQL → run verify script → invite a second test coach → two-coach smoke test.
