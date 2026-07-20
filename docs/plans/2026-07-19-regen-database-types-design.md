# Regenerate database.ts Types — Design

**Date:** 2026-07-19
**Status:** Approved by Scott

## Problem

`web/src/lib/types/database.ts` is hand-written and stale (missing `coaches`, `llm_logs`, `drivers.coach_id`, etc.). Every Supabase query works around it with `(supabase.from('x') as any)` casts — ~20 across the data layer — plus secondary casts (`data as any`, `session as any`) that exist only because the primary casts collapse result types to `never`. A second file, `web/src/lib/types/supabase.ts`, is a previously generated snapshot that is also stale and imported nowhere.

## Decisions

1. **Regenerate into `database.ts`** (Option A). Both Supabase clients (`server.ts`, `browser.ts`) already import from it, so zero import churn. Command:
   ```
   npx supabase gen types typescript --project-id soaymczvnfdsrzhnqmsy > web/src/lib/types/database.ts
   ```
   Requires supabase CLI auth (token in `~/.supabase/access-token`; pass via `SUPABASE_ACCESS_TOKEN` env var — direct CLI keychain access hangs in non-TTY shells).
2. **Never hand-edit the generated file.** Header comment marks it generated and records the regen command.
3. **Delete `web/src/lib/types/supabase.ts`** — stale, unused twin.
4. **Strip casts:** remove all `(supabase.from('x') as any)` casts and the secondary casts that papered over `never` types. Casts unrelated to Supabase typing (Anthropic content-block casts, test fixtures) stay.
5. **Narrow at the boundary:** codegen emits `string` where the hand-written file had literal unions (e.g. `driver_profiles.experience_level`). Keep an app-level `ExperienceLevel` union and narrow at the read boundary where call sites need it. Same pattern for any other loosened column.

## Gate

- 41/41 tests pass
- `tsc` shows no new errors outside `__tests__` (241-error baseline, all jest-types noise)

## Out of scope

- 17 stale insights tests, users table cleanup (remaining week-3 backlog)
- Any query-logic changes; this is types-only
