# Track Day Model — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce the `track_days` entity (implicitly created on import, backfilled for existing data) and reorganize navigation around it: driver page lists days, new day page shows the S1→S4 progression, session page gains day context.

**Architecture:** Additive migration (new table + nullable FK + flag columns), auto-upsert in the existing import route, pure helpers in `lib/track-days.ts` (TDD), server data functions mirroring `getSessionWithLaps`, three UI touches (new `/days/[id]` page, driver page day list, session page header). No behavior removed; session page stays the lap-evidence view per design doc `docs/plans/2026-07-28-track-day-model-design.md`.

**Tech Stack:** Next.js 14 app router, Supabase (Postgres + coach-scoped RLS via `public.current_coach_id()`), Jest (`npm test` in `web/`), Tailwind tokens (surface/subtle/primary/muted/accent — never `dark:` variants, see issue #28).

**Worktree:** `.worktrees/track-day-model`, branch `feat/track-day-model` (already created, design doc committed).

---

## Task 0: Workspace baseline

**Step 1:** `cd .worktrees/track-day-model/web && npm install`
**Step 2:** Copy `.env.local` from the main checkout: `cp ../../../web/.env.local .env.local` (NEVER commit it; also never commit `package-lock.json` peer-flag drift caused by npm).
**Step 3:** Run `npm test`. Expected: all suites pass. If failures: STOP and report before proceeding.

---

## Task 1: Migration — `track_days`, session columns, backfill

**Files:**
- Create: `web/supabase/migrations/20260728_track_days.sql`

**Step 1: Write the migration** (complete file):

```sql
-- Track days: explicit entity, implicitly created (design doc 2026-07-28).
-- Additive + idempotent. Safe to apply before app code deploys.
begin;

-- Track timezone drives "local date" for day grouping. Nullable; UTC fallback.
alter table public.tracks add column if not exists timezone text;

create table if not exists public.track_days (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique (driver_id, track_id, date)
);
create index if not exists idx_track_days_driver on public.track_days(driver_id);

comment on table public.track_days is
  'One driver''s day at a track. Auto-upserted on import from (driver, track, local date).';

alter table public.sessions
  add column if not exists track_day_id uuid references public.track_days(id),
  add column if not exists representativeness text
    check (representativeness in ('representative', 'partial', 'not_representative')),
  add column if not exists representativeness_note text;
create index if not exists idx_sessions_track_day on public.sessions(track_day_id);

comment on column public.sessions.representativeness is
  'Coach-set context flag. NULL = representative. UI lands in Phase 2.';

-- RLS: same driver->coach chain as sessions_all (20260718_coach_scoped_rls.sql).
alter table public.track_days enable row level security;
drop policy if exists track_days_all on public.track_days;
create policy track_days_all on public.track_days for all to authenticated
  using (exists (select 1 from public.drivers d
                 where d.id = track_days.driver_id
                   and d.coach_id = public.current_coach_id()))
  with check (exists (select 1 from public.drivers d
                      where d.id = track_days.driver_id
                        and d.coach_id = public.current_coach_id()));

-- Backfill: group existing sessions by (driver, track, local date). Idempotent.
insert into public.track_days (driver_id, track_id, date)
select distinct s.driver_id, s.track_id,
       (s.date at time zone coalesce(t.timezone, 'UTC'))::date
from public.sessions s
join public.tracks t on t.id = s.track_id
on conflict (driver_id, track_id, date) do nothing;

update public.sessions s
set track_day_id = td.id
from public.tracks t, public.track_days td
where t.id = s.track_id
  and td.driver_id = s.driver_id
  and td.track_id = s.track_id
  and td.date = (s.date at time zone coalesce(t.timezone, 'UTC'))::date
  and s.track_day_id is null;

-- Self-verify (project pattern: counts-first, fail loudly).
do $$
declare
  orphan_sessions int;
  day_count int;
begin
  select count(*) into orphan_sessions from public.sessions where track_day_id is null;
  select count(*) into day_count from public.track_days;
  raise notice 'track_days: % rows; sessions without day: %', day_count, orphan_sessions;
  if orphan_sessions > 0 then
    raise exception 'Backfill incomplete: % sessions lack track_day_id', orphan_sessions;
  end if;
end $$;

commit;
```

**Step 2: STOP — get Scott's explicit approval before applying.** The dev environment points at the hosted (prod) database. The migration is additive and idempotent, but prod DDL requires his go-ahead. Apply via Supabase SQL editor or CLI, per how 20260718 was applied.

**Step 3: Verify** — in SQL editor: `select count(*) from track_days;` and `select count(*) from sessions where track_day_id is null;` (must be 0).

**Step 4: Commit**

```bash
git add web/supabase/migrations/20260728_track_days.sql
git commit -m "feat(days): track_days migration — table, session columns, RLS, backfill"
```

---

## Task 2: Types

**Files:**
- Modify: `web/src/lib/types/database.ts` (sessions Row/Insert/Update; tracks Row/Insert/Update; new track_days table entry)
- Modify: `web/src/lib/types/index.ts`

**Step 1:** In `database.ts`, add to the `sessions` Row type (and optional fields on Insert/Update):
```typescript
track_day_id: string | null;
representativeness: 'representative' | 'partial' | 'not_representative' | null;
representativeness_note: string | null;
```
Add `timezone: string | null;` to `tracks` Row/Insert/Update. Add a `track_days` table entry following the existing shape:
```typescript
track_days: {
  Row: {
    id: string;
    driver_id: string;
    track_id: string;
    date: string;
    created_at: string | null;
  };
  Insert: {
    id?: string;
    driver_id: string;
    track_id: string;
    date: string;
    created_at?: string | null;
  };
  Update: { /* all optional, same fields */ };
  Relationships: []; // match file's existing convention if present
};
```

**Step 2:** In `index.ts`, next to `SessionWithRelations` (index.ts:17-22):
```typescript
export type TrackDay = Database['public']['Tables']['track_days']['Row'];

export interface TrackDayWithSessions extends TrackDay {
  driver: Driver;
  track: Track;
  sessions: SessionWithLapTimes[];
}

export interface SessionWithLapTimes extends Session {
  laps: Pick<Lap, 'lap_number' | 'lap_time_ms'>[];
}
```

**Step 3:** `npx tsc --noEmit` (from `web/`). Expected: clean.

**Step 4: Commit** — `git commit -m "feat(days): TrackDay types"`

---

## Task 3: Pure helpers — `lib/track-days.ts` (TDD)

**Files:**
- Create: `web/src/lib/track-days.ts`
- Test: `web/src/lib/__tests__/track-days.test.ts`

**Step 1: Write the failing tests** (complete file):

```typescript
import {
  localDateForTimezone,
  dayBestLapMs,
  dayConsistencyTrend,
  sessionDelta,
} from '@/lib/track-days';

describe('localDateForTimezone', () => {
  it('converts a UTC timestamp to the track-local calendar date', () => {
    // 2026-07-12 03:30 UTC is still 2026-07-11 in Chicago (UTC-5)
    expect(localDateForTimezone('2026-07-12T03:30:00Z', 'America/Chicago')).toBe('2026-07-11');
  });
  it('falls back to UTC when timezone is null', () => {
    expect(localDateForTimezone('2026-07-12T03:30:00Z', null)).toBe('2026-07-12');
  });
  it('falls back to UTC on an invalid timezone', () => {
    expect(localDateForTimezone('2026-07-12T03:30:00Z', 'Not/AZone')).toBe('2026-07-12');
  });
});

describe('dayBestLapMs', () => {
  it('returns the fastest best lap across sessions', () => {
    expect(dayBestLapMs([{ best_lap_ms: 95200 }, { best_lap_ms: 94100 }, { best_lap_ms: null }])).toBe(94100);
  });
  it('returns null when no session has a best lap', () => {
    expect(dayBestLapMs([{ best_lap_ms: null }])).toBeNull();
  });
});

describe('dayConsistencyTrend', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060]; // ~±0.03s, 6 laps
  const loose = [90000, 92000, 91000, 90500, 93000, 90800]; // wider, 6 laps
  it('returns first and last eligible session sigma', () => {
    const trend = dayConsistencyTrend([loose, tight]);
    expect(trend).not.toBeNull();
    expect(trend!.firstSeconds).toBeGreaterThan(trend!.lastSeconds);
  });
  it('ignores sessions under the lap gate', () => {
    expect(dayConsistencyTrend([[90000, 90100], tight])).toBeNull(); // only 1 eligible
  });
  it('returns null with fewer than two eligible sessions', () => {
    expect(dayConsistencyTrend([tight])).toBeNull();
  });
});

describe('sessionDelta', () => {
  const tight = [90000, 90100, 90050, 90080, 90020, 90060];
  const loose = [90000, 92000, 91000, 90500, 93000, 90800];
  it('computes best-lap and consistency deltas vs previous session', () => {
    const d = sessionDelta(
      { bestLapMs: 95000, lapTimesMs: loose },
      { bestLapMs: 94200, lapTimesMs: tight }
    );
    expect(d.bestLapDeltaMs).toBe(-800);
    expect(d.consistencyDeltaSeconds).toBeLessThan(0);
  });
  it('nulls the consistency delta when either session is under the lap gate', () => {
    const d = sessionDelta(
      { bestLapMs: 95000, lapTimesMs: [90000, 90100] },
      { bestLapMs: 94200, lapTimesMs: tight }
    );
    expect(d.bestLapDeltaMs).toBe(-800);
    expect(d.consistencyDeltaSeconds).toBeNull();
  });
});
```

**Step 2:** Run `npm test -- track-days`. Expected: FAIL (module not found).

**Step 3: Implement** (complete file):

```typescript
/**
 * Track-day helpers. Pure functions only — day grouping math lives here,
 * honesty gates reuse MIN_LAPS_FOR_INSIGHTS and sessionConsistencySeconds.
 */
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';

export function localDateForTimezone(isoTimestamp: string, timezone: string | null): string {
  const date = new Date(isoTimestamp);
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // en-CA -> YYYY-MM-DD
  try {
    return format(timezone ?? 'UTC');
  } catch {
    return format('UTC'); // invalid IANA name
  }
}

export function dayBestLapMs(sessions: Array<{ best_lap_ms: number | null }>): number | null {
  const bests = sessions
    .map((s) => s.best_lap_ms)
    .filter((b): b is number => b !== null);
  return bests.length ? Math.min(...bests) : null;
}

export interface ConsistencyTrend {
  firstSeconds: number;
  lastSeconds: number;
}

/** σ of the first and last sessions that clear the lap gate; null if <2 qualify. */
export function dayConsistencyTrend(lapTimesBySession: number[][]): ConsistencyTrend | null {
  const sigmas = lapTimesBySession
    .filter((laps) => laps.length >= MIN_LAPS_FOR_INSIGHTS)
    .map((laps) => sessionConsistencySeconds(laps))
    .filter((s): s is number => s !== null);
  if (sigmas.length < 2) return null;
  return { firstSeconds: sigmas[0], lastSeconds: sigmas[sigmas.length - 1] };
}

export interface SessionDelta {
  bestLapDeltaMs: number | null;
  consistencyDeltaSeconds: number | null;
}

export interface SessionForDelta {
  bestLapMs: number | null;
  lapTimesMs: number[];
}

export function sessionDelta(prev: SessionForDelta, curr: SessionForDelta): SessionDelta {
  const bestLapDeltaMs =
    prev.bestLapMs !== null && curr.bestLapMs !== null ? curr.bestLapMs - prev.bestLapMs : null;

  let consistencyDeltaSeconds: number | null = null;
  if (
    prev.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS &&
    curr.lapTimesMs.length >= MIN_LAPS_FOR_INSIGHTS
  ) {
    const prevSigma = sessionConsistencySeconds(prev.lapTimesMs);
    const currSigma = sessionConsistencySeconds(curr.lapTimesMs);
    if (prevSigma !== null && currSigma !== null) {
      consistencyDeltaSeconds = currSigma - prevSigma;
    }
  }
  return { bestLapDeltaMs, consistencyDeltaSeconds };
}
```

**Step 4:** `npm test -- track-days`. Expected: PASS. Check `sessionConsistencySeconds`'s actual signature (`Array<number | null>` per analytics-v2.ts) — adjust call sites with a cast only if tsc complains.

**Step 5: Commit** — `git commit -m "feat(days): pure day-grouping helpers with honesty gates"`

---

## Task 4: Import route upserts the track day

**Files:**
- Modify: `web/src/app/api/import-session/route.ts` (track validation ~lines 79-90, session insert ~lines 100-108, success response ~lines 168-174)

**Step 1:** In the track validation query, add `timezone` to the selected columns.

**Step 2:** After track validation, before the session insert:

```typescript
import { localDateForTimezone } from '@/lib/track-days';
// ...
const localDate = localDateForTimezone(payload.date, track.timezone ?? null);
const { data: trackDay, error: trackDayError } = await supabase
  .from('track_days')
  .upsert(
    { driver_id: driver.id, track_id: payload.trackId, date: localDate },
    { onConflict: 'driver_id,track_id,date' }
  )
  .select()
  .single();

if (trackDayError || !trackDay) {
  console.error('[Import] track_day upsert failed:', trackDayError);
  return NextResponse.json({ error: 'Failed to resolve track day' }, { status: 500 });
}
```

**Step 3:** Add `track_day_id: trackDay.id` to `sessionInsert`, and `trackDayId: trackDay.id` to the 201 response body.

**Step 4: Verify manually** — `npm run dev`, import a CSV via `/import` UI, then in Supabase SQL editor confirm the new session row has `track_day_id` and re-importing another session for the same driver/track/date reuses the same day (no duplicate `track_days` row).

**Step 5: Commit** — `git commit -m "feat(days): import upserts track day, sessions attach on create"`

---

## Task 5: Data layer — `src/data/track-days.ts`

**Files:**
- Create: `web/src/data/track-days.ts`

Mirror the patterns in `src/data/sessions.ts` (see `getSessionWithLaps`, sessions.ts:166-218 — same client creation, same error-tuple return shape; copy its conventions exactly).

**Step 1: Implement two functions:**

```typescript
import type { TrackDayWithSessions } from '@/lib/types';
// use the same supabase client import/creation as src/data/sessions.ts

export async function getTrackDayWithSessions(id: string) {
  const supabase = /* same as sessions.ts */;
  const { data, error } = await supabase
    .from('track_days')
    .select(
      `*,
       driver:drivers(*),
       track:tracks(*),
       sessions(*, laps(lap_number, lap_time_ms))`
    )
    .eq('id', id)
    .single();
  if (error || !data) return { data: null, error };
  // Order sessions by timestamp — this ordering IS the Session 1..N numbering.
  data.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  data.sessions.forEach((s) => s.laps.sort((a, b) => a.lap_number - b.lap_number));
  return { data: data as TrackDayWithSessions, error: null };
}

export async function getTrackDaysForDriver(driverId: string) {
  const supabase = /* same as sessions.ts */;
  const { data, error } = await supabase
    .from('track_days')
    .select(`*, track:tracks(*), sessions(*, laps(lap_number, lap_time_ms))`)
    .eq('driver_id', driverId)
    .order('date', { ascending: false });
  if (error || !data) return { data: null, error };
  data.forEach((d) => d.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  return { data, error: null };
}
```

**Step 2:** `npx tsc --noEmit`. Expected: clean.

**Step 3: Commit** — `git commit -m "feat(days): track-day data layer"`

---

## Task 6: Day page — `/days/[id]`

**Files:**
- Create: `web/src/app/days/[id]/page.tsx`
- Create: `web/src/components/days/SessionProgressionStrip.tsx`

**Step 1: SessionProgressionStrip** (client-agnostic presentational component; complete):

```tsx
import Link from 'next/link';
import { sessionConsistencySeconds } from '@/lib/analytics-v2';
import { MIN_LAPS_FOR_INSIGHTS } from '@/lib/insights';
import { sessionDelta } from '@/lib/track-days';
import { formatLapTime } from '@/lib/utils/formatters';
import type { SessionWithLapTimes } from '@/lib/types';

function deltaChip(deltaMs: number | null) {
  if (deltaMs === null) return null;
  const seconds = deltaMs / 1000;
  const improved = seconds < 0;
  return (
    <span className={improved ? 'text-status-success' : 'text-status-warn'}>
      {improved ? '' : '+'}{seconds.toFixed(3)}s
    </span>
  );
}

export default function SessionProgressionStrip({ sessions }: { sessions: SessionWithLapTimes[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sessions.map((session, i) => {
        const lapTimes = session.laps.map((l) => l.lap_time_ms);
        const sigma = lapTimes.length >= MIN_LAPS_FOR_INSIGHTS ? sessionConsistencySeconds(lapTimes) : null;
        const prev = i > 0 ? sessions[i - 1] : null;
        const delta = prev
          ? sessionDelta(
              { bestLapMs: prev.best_lap_ms, lapTimesMs: prev.laps.map((l) => l.lap_time_ms) },
              { bestLapMs: session.best_lap_ms, lapTimesMs: lapTimes }
            )
          : null;
        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="block rounded-lg border border-subtle bg-surface p-4 hover:border-strong"
          >
            <p className="text-sm text-muted">Session {i + 1}</p>
            <p className="mt-1 text-xl font-semibold text-primary">
              {session.best_lap_ms ? formatLapTime(session.best_lap_ms) : '—'}
              {delta && <span className="ml-2 text-sm">{deltaChip(delta.bestLapDeltaMs)}</span>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {sigma !== null ? `±${sigma.toFixed(1)}s` : `${lapTimes.length} laps — too few for consistency`}
              {delta?.consistencyDeltaSeconds !== null && delta && (
                <span className="ml-2 text-text-subtle">
                  ({delta.consistencyDeltaSeconds > 0 ? '+' : ''}{delta.consistencyDeltaSeconds.toFixed(1)}s)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-text-subtle">{lapTimes.length} laps</p>
          </Link>
        );
      })}
    </div>
  );
}
```

**Step 2: Day page** — server component. Mirror the layout skeleton of `web/src/app/sessions/[id]/page.tsx` (TrackAppHeader, HeroBurst, container widths, notFound() on missing row). Content: header block (track name + `formatDate(day.date)` + driver name, back-link to `/drivers/${day.driver_id}`), day KPIs (session count, `dayBestLapMs`, `dayConsistencyTrend` rendered as "±X.Xs → ±X.Xs" or an honest "not enough data" line), then `<SessionProgressionStrip sessions={day.sessions} />`.

**Step 3: Verify** — `npm run dev`, open a demo driver's day (query a `track_days.id` from SQL editor), confirm progression renders, deltas match hand math, <6-lap sessions show no σ claim.

**Step 4: Commit** — `git commit -m "feat(days): day page with session progression strip"`

---

## Task 7: Driver page lists days

**Files:**
- Modify: `web/src/data/sessions.ts` — add `track_day_id: string | null` to `SessionWithDetails` (sessions.ts:9-20) and include it in the query's selected columns if they're explicit.
- Create: `web/src/components/drivers/TrackDayList.tsx`
- Modify: `web/src/app/drivers/[driverId]/page.tsx` (SessionHistoryTable usage at ~line 408)

**Step 1: TrackDayList** — groups `SessionWithDetails[]` by `track_day_id` client-side (the page already has all sessions + lap times; no new fetch). Each group renders one row: `formatDate` of earliest session, track name, session count, day best (`dayBestLapMs`), σ trend (`dayConsistencyTrend` over lap-time arrays, ordered by session date), linking to `/days/${trackDayId}`. Sessions with `track_day_id === null` (shouldn't exist post-backfill) fall back to a `date+track` group key and link to the first session instead — degraded, not broken.

**Step 2:** In the driver page, replace `<SessionHistoryTable sessions={...} />` with `<TrackDayList sessions={...} />`. Keep `SessionHistoryTable.tsx` on disk untouched this phase (its "Event" grouping concept is what TrackDayList formalizes; delete when Phase 2 confirms nothing else uses it).

**Step 3:** ProgressCharts "Consistency by Event": inspect how `progressData.events` is built (`/api/drivers/[id]/profile` or `driverProgress.ts`). If events are already keyed by date+track, they now coincide with track days — verify and leave. Only change grouping keys if they differ from the day definition.

**Step 4: Verify** — driver page shows day rows; a demo driver with N sessions on one date shows one row with N sessions; row navigates to the day page.

**Step 5: Commit** — `git commit -m "feat(days): driver page organized by track day"`

---

## Task 8: Session page day context

**Files:**
- Modify: `web/src/data/sessions.ts` (`getSessionWithLaps`, lines 166-218)
- Modify: `web/src/app/sessions/[id]/page.tsx` (header, lines 113-139)

**Step 1:** In `getSessionWithLaps`, after the main fetch, when `session.track_day_id` is set, fetch siblings:

```typescript
const { data: siblings } = await supabase
  .from('sessions')
  .select('id, date')
  .eq('track_day_id', session.track_day_id)
  .order('date', { ascending: true });
```

Attach `dayContext: { trackDayId, index, count, prevSessionId, nextSessionId } | null` to the returned object (index from position of `session.id` in `siblings`).

**Step 2:** In the session page header: back-link goes to `/days/${dayContext.trackDayId}` (label: track name + date) when day context exists, else current `/sessions` fallback. Add under the h1: `Session {index + 1} of {count}` with prev/next chevron links when defined.

**Step 3: Verify** — from a day page, click Session 2: header reads "Session 2 of N", prev/next navigate correctly, back-link returns to the day.

**Step 4: Commit** — `git commit -m "feat(days): session page day header and prev/next nav"`

---

## Task 9: Import success links to the day

**Files:**
- Modify: `web/src/components/import/CsvImport.tsx` (success handling ~lines 133-151 and the success-state render)

**Step 1:** Collect `data.trackDayId` alongside `data.sessionId` into a `trackDayIds: string[]` (deduplicated) in `importResults`.

**Step 2:** In the success panel, render a "View track day" link per unique day (`/days/${id}`); keep existing session links/summary intact.

**Step 3: Verify** — import a CSV, success panel links to the day page.

**Step 4: Commit** — `git commit -m "feat(days): import success links to track day"`

---

## Task 10: Final verification & PR

**Step 1:** `npm test` (all suites) and `npm run build` from `web/`. Expected: pass/clean. (`npm run lint` is unusable repo-wide — pre-existing, skip.)
**Step 2: Manual QA sweep** (Playwright or browser, port 3011): coach dashboard → driver page (day rows) → day page (progression, deltas, honesty gates) → session page (day header, prev/next) → import flow (new session joins existing day). Confirm zero `/100` language and dark styling intact.
**Step 3:** Verify no `.env.local` or `package-lock.json` drift staged: `git status` must show only intended files.
**Step 4:** Push and open PR against `main` titled "feat: track day model (Phase 1)" — body references the design doc and issue list; **do not merge** (Scott merges).

---

## Notes for the implementer

- **Honesty rules are non-negotiable:** consistency claims only at ≥`MIN_LAPS_FOR_INSIGHTS` laps; σ always from `sessionConsistencySeconds` (single source); deltas compare, coaches conclude — no "improved!" copy, just signed numbers.
- **Styling:** design tokens only (`bg-surface`, `border-subtle`, `text-primary/muted/text-subtle`, `text-status-*`). Never introduce `dark:` variants (issue #28).
- **Language:** students/instructor voice in UI copy, per existing conventions.
- **`representativeness` columns ship in this migration but have NO UI in Phase 1** — do not build flag controls; that's Phase 2's debrief workflow.
- **Migration timing:** additive and idempotent, applied to the hosted DB before the PR merges — but only after Scott's explicit go-ahead (Task 1 Step 2).
