# Demo Script + User Guide — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce two committed artifacts — `docs/demo/DEMO_SCRIPT.md` (a rehearsable ~10-minute prospect demo) and `docs/USER_GUIDE.md` (an operating reference for the committed pilot coach) — both written by walking the running app, not by reading design docs.

**Architecture:** This is a writing project with an engineering verification bar. Every claim in both artifacts is sourced from the running application against live demo seed data. The demo script is built first: rehearsing it walks most of the product, and those walk notes become the raw material for the guide. Each act / each guide section is a task: draft → verify against the live app → commit.

**Tech Stack:** Next.js app under `web/`, hosted Supabase (production), deterministic demo seed generator under `web/scripts/seed/`, Anthropic SDK for AI day summaries. Deliverables are Markdown.

---

## Read this before Task 1

### Where you are

Worktree: `/Users/scottcollier/dev/track-app-mvp/.worktrees/demo-docs`, on branch `main`. Do **not** work in the root checkout `/Users/scottcollier/dev/track-app-mvp` — it is parked on another branch where `docs/plans/` is nearly empty, and an agent starting there concludes the product was barely designed.

The design this plan implements: `docs/plans/2026-08-06-demo-and-docs-design.md`. **Read it first, in full.** Its decisions table is settled. If you find yourself about to write "open question" about something that table answers, quote the table and build it instead.

### Sourcing hierarchy (both artifacts, in priority order)

1. **The running app** — authoritative for behavior, UI labels, and button text.
2. **`web/scripts/seed/demo-scenarios.ts`** — authoritative for demo data (cast, lap times, focus items, Elena's approved summary text).
3. **`web/src/lib/coaching-prompts.ts`** — authoritative for what the AI is actually instructed to do. All AI-behavior claims check here, not against design-doc intent.
4. Four design docs, for **why only** — `2026-07-17-trackapp-revival-design.md`, `2026-07-28-track-day-model-design.md`, `2026-08-01-ai-day-summary-design.md`, `2026-07-31-coaching-loop-phase2-design.md`.
5. **Never** open any `*-plan.md` or `*-implementation.md` (including this one, once you're executing it — follow it, don't quote it into deliverables).

### Traps that will bite you

- **Demo dates are relative, not fixed.** `demo-scenarios.ts` stores `weeksAgo`, and `weekendDate()` (demo-scenarios.ts:100-106) resolves it against the clock **at seed generation time**. `weeksAgo: 0` = the weekend just past. Every seed refresh moves every date. **Therefore: never write an absolute date into `DEMO_SCRIPT.md`.** Name days relatively and by track — "Marcus's most recent Sunday at Sonoma," "Elena's Laguna Seca weekend, the Sunday." Narration should speak the way a coach speaks anyway ("two weekends ago… then last weekend…"), which is both more natural and refresh-proof.
- **Design ≠ shipped.** Design docs carry Deferred / Out of scope / Phase 4 sections — video clips on focus items, `focus_item_media`, multi-driver "today at the track." None of it is built. Do not narrate unbuilt features. (A flat session list at `/sessions` *is* built, despite appearing in a deferred discussion — check the app, always.)
- **`demo-seed.golden.sql` is a jest fixture. Never apply it to any database.** The runnable artifact is `web/scripts/seed/demo-seed.sql`.
- **Rehearsals write to production.** `web/.env.local` points at hosted Supabase. Live Generate/Approve beats stay on the six seeded demo drivers only — the seed refresh sweep reaches demo drivers and nobody else. Never Generate or Approve on a personal test driver or a real import while rehearsing.
- **`$DATABASE_URL` is not in your shell.** It lives in `web/.env.local`, which nothing auto-sources into bash. Before any `psql` command in this plan, extract it: `DATABASE_URL=$(grep '^DATABASE_URL' web/.env.local | cut -d= -f2-)` (run from the worktree root, adjust the path if you're already in `web/`). Without this, every psql call fails.
- **Never kill a process on port 3000 you did not start.** If 3000 is occupied, run `PORT=3001 npm run dev` instead.
- **The AI constraint has two halves, and they are not the same half.** Both features are observation-only — the model may summarize coach-directed work and may never author a driving instruction, readiness call, or safety recommendation. But only the **day summary** carries the approval gate and a provenance row. Session-level AI coaching (`/api/coaching/generate`, `AICoachingCard`) is deliberately ephemeral: one overwritten column, no approval, no provenance — permitted *because* its output contract forbids instructions (documented at `web/src/app/api/coaching/generate/route.ts:1-24`). Write both artifacts precisely: "never authors instruction" covers both features; "nothing publishes without coach approval" is a claim about day summaries. Blurring these makes the guide wrong.
- **No product version number anywhere.** Both artifacts carry a doc date only. The session→day reorganization is told as product thesis, never as a changelog.

### Permission posture

Gated actions — **stop and ask Scott before**: applying SQL with `psql`, `git push`, opening a PR, deleting anything. Read-only `psql -c "select ..."` is fine. Everything else (file edits, `npm run dev`, git add/commit, tests) proceeds.

---

## Phase A — Foundation

### Task 1: Bring up a verified environment

**Files:**
- Check: `web/.env.local` (must exist in *this worktree* — env has died with a deleted worktree before)

**Step 1: Confirm your location and branch**

```bash
cd /Users/scottcollier/dev/track-app-mvp/.worktrees/demo-docs
git status --short && git log --oneline -1
```

Expected: on `main`, at or ahead of `17bc887 docs: correct stale facts in demo+docs design`, with both `docs/plans/2026-08-06-demo-and-docs-design.md` and this plan present.

**Step 2: Confirm env**

```bash
cd web && grep -o '^[A-Z_]*' .env.local | sort
```

Expected five keys: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. If the file is missing, copy it from the root checkout: `cp /Users/scottcollier/dev/track-app-mvp/web/.env.local web/.env.local`.

**Step 3: Install and start the dev server**

```bash
cd web && npm install && npm run dev
```

If port 3000 is taken by a process you did not start, use `PORT=3001 npm run dev`. Do not kill it.

**Step 4: Find the coach email the seed needs**

```bash
psql "$DATABASE_URL" -c "select email from coaches;"
```

Read-only, safe. If more than one row, ask Scott which account he demos from.

**Step 5: Commit nothing yet** — this task changes no tracked files.

---

### Task 2: Refresh the demo seed and establish the dated cast sheet

**Files:**
- Generates: `web/scripts/seed/demo-seed.sql` (gitignored or regenerable — do not fight over it in git)

**Step 1: Regenerate the seed**

```bash
cd web && npx tsx scripts/seed/generate-demo-seed.ts --coach-email=<email from Task 1>
```

Expected: writes `web/scripts/seed/demo-seed.sql`. `--coach-email` is required and must match an existing coach.

**Step 2: STOP. Ask Scott to approve the apply.**

The apply command, once approved:

```bash
psql "$DATABASE_URL" -f web/scripts/seed/demo-seed.sql
```

This deletes all demo-driver `track_days` wholesale (generate-demo-seed.ts:409-417); `day_summaries` cascade away with them. That is intended and is the entire reset mechanism. **Never** substitute `demo-seed.golden.sql`.

**Step 3: Verify the seed landed, in the browser**

Log in, open `/coach`. Confirm all six drivers render: Kai Garcia, Marcus Webb, Ava Torres, Elena Ross, Jordan Lee, Sam Whitaker.

**Step 4: Build the cast sheet as working notes**

Create a scratch file at `/tmp/trackapp-walk-notes.md` — **not committed**. For each driver record: the resolved dates now showing in the app, track, session count per day, best lap per session as rendered, focus items and their status, any flags/chips shown. This is your ground truth for every number you will write. Confirm it against the app, not against `demo-scenarios.ts` alone — the app is authoritative for what renders.

Expected shape (verify, don't assume): Kai — 2 Saturdays at Thunderhill, fade not sustained. Marcus — 2 Sundays at Sonoma, regression sustained, baseline still building. Ava — 2 Sundays at Buttonwillow, spread / off-baseline, one paused focus item and one with no origin session. Elena — 3 days at Laguna Seca (a Saturday two weeks back, then a Sat+Sun weekend), focus items carrying across days, approved summary on her latest Sunday. Jordan — 1 Saturday at Streets of Willow, 2 sessions, no focus items. Sam — 3 Sundays at Thunderhill, no flags, no focus items, no notes.

**Step 5: Verify Elena's approved summary renders**

Open Elena's latest day (`/days/[id]`) and confirm the day summary slot shows her approved summary with provenance. Note the exact on-screen labels — you will narrate them verbatim in Act 4.

---

## Phase B — Demo script

Format reference (structure only, not content): `/Users/scottcollier/dev/demos/canon/DEMO_SCRIPT.md`. Read it before Task 3. Canon treatment means: pre-demo checklist, acts with time budgets, `[bracketed stage directions]`, and verbatim narration a presenter can rehearse word-for-word.

### Task 3: Create the script skeleton

**Files:**
- Create: `docs/demo/DEMO_SCRIPT.md`

**Step 1: Write the skeleton** — title, doc date (2026-08-07 or the day you write it), a one-paragraph "what this is / who it's for" (prospect chief instructor, ~10 min, goal is yes-to-a-pilot), the pre-demo checklist, and five act headers with time budgets: Act 1 (60s), Act 2 (2 min), Act 3 (2.5 min), Act 4 (2.5 min), Act 5 (2 min). Add stub headers for "Kai in reserve" and "Appendix: cast & data reference."

**Step 2: Write the pre-demo checklist in full.** It must include, as runnable steps: regenerate seed (exact command, with the coach email as a placeholder), apply `demo-seed.sql` via psql or the Supabase SQL editor, confirm all six drivers on `/coach`, confirm Elena's approved summary renders on her latest day, **refresh in the same week as the demo** (dates are relative — if the refresh and the demo straddle a weekend, refresh again), browser tabs staged, and a note that the live Generate in Act 4 needs `ANTHROPIC_API_KEY` working.

**Step 3: Commit**

```bash
git add docs/demo/DEMO_SCRIPT.md
git commit -m "docs(demo): add demo script skeleton and pre-demo checklist"
```

---

### Task 4: Act 1 — The problem (60s)

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Walk it.** Open `/coach`. Note the exact KPI strip labels, how the roster groups, what the triage queue surfaces.

**Step 2: Write the act.** Stage directions for what's on screen; verbatim narration that lands the thesis — drivers develop across days, days progress through sessions, sessions contain the evidence. The problem framing: after a track day you have transponder CSVs and memories; coaching happens across days, but the evidence lives in scattered sessions.

**Step 3: Verify** every element you named is on screen at `/coach`. Numbers match the cast sheet.

**Step 4: Commit** — `docs(demo): write Act 1 — the problem`

---

### Task 5: Act 2 — Seeing a day (2 min), Marcus

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Walk it.** `/coach` → Marcus → his most recent Sunday at Sonoma (`/days/[id]`). Note the session progression strip, what the regression looks like on screen, and how the day view reads faster than a timing sheet. Drill into one session (`/sessions/[id]`) if it strengthens the beat.

**Step 2: Write the act,** naming Marcus by name and his day relatively ("his most recent Sunday at Sonoma"). Never "navigate to a driver with a regression." Never an absolute date.

**Step 3: Verify** click path and every number against the live app.

**Step 4: Commit** — `docs(demo): write Act 2 — seeing a day`

---

### Task 6: Act 3 — The coaching loop (2.5 min), Elena

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Walk it.** Elena across all three Laguna Seca days. Focus items assigned → carried → evidenced: the `FocusPanel` on `/days/[id]`, the `EvidenceBanner` on `/sessions/[id]`, and the assessment history. This is the showpiece and the differentiator — coach-directed development, not lap-time trivia.

**Step 2: Write the act.** Include one supporting Ava beat (spread / off-baseline) marked `[if pacing allows]`.

**Step 3: Verify** the full click path end to end, including that the carry-across-days really renders as described.

**Step 4: Commit** — `docs(demo): write Act 3 — the coaching loop`

---

### Task 7: Act 4 — AI with a leash (2.5 min)

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Read `web/src/lib/coaching-prompts.ts`** before writing a word of narration. Whatever you claim the AI does must match what it is instructed to do.

**Step 2: Walk it.** Elena's approved summary and its provenance on her latest day. Then a **live Generate on Marcus's most recent Sonoma day** — actually run it, confirm it works and how long it takes. Note the draft → edit → approve flow in `DaySummarySlot`.

**Step 3: Write the act.** Narration hits the hard rule as a headline, never a footnote: the AI observes and summarizes coach-directed work; it never authors driving instruction, readiness calls, or safety recommendations. Nothing publishes without the coach approving it, and every summary carries provenance. Include a `[if the API call fails]` fallback direction so a dead network doesn't kill the demo.

**Step 4: Note the residue.** The Marcus draft you just generated is swept by the post-demo seed refresh. Say so in the script's post-demo section.

**Step 5: Verify** — the live Generate succeeded on a demo driver, and only on a demo driver.

**Step 6: Commit** — `docs(demo): write Act 4 — AI with a leash`

---

### Task 8: Act 5 — Honesty at the edges + the ask (2 min)

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Walk it.** Jordan at n=1 — confirm the page renders gracefully and note the exact representativeness language the app shows. Sam as the quiet control.

**Step 2: Write the act.** Jordan is the honesty beat: the app doesn't fake confidence on thin data. Sam gets one sentence. Close on the pilot ask — free, org-level, bring your CSVs.

**Step 3: Verify** the hedging language you quoted matches the app verbatim.

**Step 4: Commit** — `docs(demo): write Act 5 — honesty at the edges and the ask`

---

### Task 9: Kai in reserve + appendix

**Files:** Modify `docs/demo/DEMO_SCRIPT.md`

**Step 1: Write the Kai reserve section** — a drop-in Act 2 alternate (fade, not sustained: a different failure shape than Marcus's regression), and mark it explicitly as the seam where the longer pilot-partner walkthrough will expand later.

**Step 2: Write the appendix** — cast and data reference. Six drivers, their narrative role, their days named *relatively* (weekends-ago + weekday + track), session counts, and the numbers a presenter should expect to see. This is what a presenter checks after a refresh. **No absolute dates.**

**Step 3: Commit** — `docs(demo): add Kai reserve act and cast appendix`

---

### Task 10: Dress rehearsal (the done bar)

The rehearsal has two runners with different jobs. The executor verifies the script against reality; only Scott can produce a real spoken runtime. Do not claim "done" on the executor pass alone.

**Step 1: Refresh the seed** (Task 2 steps 1–2, gated apply).

**Step 2: Executor verification pass — run the whole script start to finish against the live app.** Every click path executed, every named driver, day, and number checked against what renders. The live Generate on Marcus must work. Estimate runtime per act: narration word count at ~140 wpm plus observed click/load time; flag any act whose estimate blows its time budget.

**Step 3: Record every drift** in `/tmp/trackapp-walk-notes.md` — anything that didn't match, any act estimated long, any click path that was awkward.

**Step 4: Fix the script** to match reality. If estimated total runtime exceeds ~11 minutes, cut — the Ava beat is the designated first cut.

**Step 5: Refresh the seed again** and confirm Elena's approved summary is restored (it is re-inserted deterministically with `model = 'seed'`) and the Marcus draft is gone.

**Step 6: Commit** — `docs(demo): correct script against dress rehearsal`

**Step 7: Hand to Scott for the timed spoken run.** Scott runs the script out loud against the live app, timed. His drift notes (real runtime, lines that don't speak well, awkward transitions) feed one more fix round: apply, commit — `docs(demo): correct script against Scott's timed run`. The demo script is done only after Scott's run comes in at ~10 minutes clean.

**Step 8: Report to Scott.** Estimated vs. actual runtime, what drifted in each pass, anything that needs his call.

---

## Phase C — User guide

Audience: the committed pilot coach, alone and stuck. Operating reference, not a brochure. Organized by what the coach is trying to do. Doc date, no version number.

**Standing rule for every task in this phase:** write the section by *walking the feature*. If a design doc and the app disagree, **flag it to Scott — never silently resolve it.**

### Task 11: Guide skeleton

**Files:** Create `docs/USER_GUIDE.md`

**Step 1: Write the skeleton** — title, doc date, and the eight section headers: (1) How TrackApp thinks, (2) Getting set up, (3) Getting your data in, (4) Reading a track day, (5) Running the coaching loop, (6) AI day summaries, (7) When the data is thin, (8) Troubleshooting.

**Step 2: Commit** — `docs: add user guide skeleton`

---

### Task 12: Sections 1–2 — How TrackApp thinks; Getting set up

**Step 1: Write section 1.** One page, day-centric thesis, no marketing. Told as product thesis — never as "we reorganized from sessions to days."

**Step 2: Walk setup.** Invite-only access, first login (magic link / OTP at `/login`, callback at `/auth/confirm`), adding drivers. Verify against the shipped app — do not assume a signup flow that doesn't exist.

**Step 3: Write section 2** from what you actually did.

**Step 4: Commit** — `docs: write user guide sections 1-2`

---

### Task 13: Section 3 — Getting your data in

**Step 1: Open with the day-of workflow,** because that's the coach's real sequence: capture on device (RaceChrono / TrackAddict / AiM / timing system) → export → get the file to your machine (email, Dropbox, AirDrop) → upload when you have connectivity. TrackApp needs no internet at the track. Keep this practical — it is not a focus section, and it is not a philosophy section.

**Step 2: Answer the open ingest question empirically.** Do native RaceChrono / TrackAddict / AiM exports parse as-is, or do they need the template? Test it: download each template from `/api/templates/racechrono|trackaddict|aim|generic`, and check `web/src/lib/csv-parser.ts` for what it actually requires. As of writing, required columns are `session_date`, `track_name`, `driver_name`, `lap_number`, `lap_time_ms`, `timestamp`; `source` is optional and defaults to `csv_import`. **Document whichever is true.** If native exports need massaging, say exactly what massaging.

**Step 3: Do the CSV round trip.** Build a small CSV, import it at `/import`, confirm it lands on a day view. **Import as a demo driver or clean up after yourself** — a stray real import is not swept by the seed refresh. Ask Scott before importing anything that will persist.

**Step 4: Document failure modes you actually hit** — bad import, partial import (the API returns 207 when laps partially fail). Only document what you saw.

**Step 5: Commit** — `docs: write user guide section 3 — getting your data in`

---

### Task 14: Section 4 — Reading a track day

**Step 1: Walk `/days/[id]`** on Marcus (regression) and on Elena (clean progression). Session progression strip, laps, trends, notes.

**Step 2: Write the section,** including what a regression looks like on screen.

**Step 3: Commit** — `docs: write user guide section 4 — reading a track day`

---

### Task 15: Section 5 — Running the coaching loop

This is the operational heart of the guide. Give it the most care.

**Step 1: Walk the full loop yourself** on a demo driver: create a focus item, carry it to the next day, record an assessment against a session as evidence, and move it through a status change. Use `FocusPanel` on the day page and `EvidenceBanner` on the session page.

**Step 2: Write the section** — creating, carrying, evidencing, and the status vocabulary the app actually uses.

**Step 3: Clean up** any focus items you created on demo drivers, or note that the next seed refresh sweeps them (it does — `focus_items` are deleted wholesale for demo drivers at generate-demo-seed.ts:409).

**Step 4: Commit** — `docs: write user guide section 5 — running the coaching loop`

---

### Task 16: Section 6 — AI day summaries

**Step 1: Re-read `web/src/lib/coaching-prompts.ts`.** Every behavioral claim in this section is checked against it.

**Step 2: Lead with the constraint as a promise,** not a disclaimer. Then: what Generate does, what a summary contains, provenance, the approval gate, editing `final_text`, and superseding on regeneration.

**Step 3: Be precise about scope.** The approval gate and provenance row are day-summary properties. Session-level AI coaching is deliberately ephemeral and has neither — permitted because its output contract forbids instructions. If you mention session coaching at all, say this accurately; if it muddies the section, give it its own short subsection rather than blurring the promise.

**Step 4: Verify** by generating and approving a summary on a demo driver's day, end to end.

**Step 5: Commit** — `docs: write user guide section 6 — AI day summaries`

---

### Task 17: Sections 7–8 — Thin data; Troubleshooting

**Step 1: Section 7** — walk Jordan (n=1) and Marcus (baseline still building). Explain n=1 days, representativeness flags, and *why* the app hedges: it would rather say less than fake confidence.

**Step 2: Section 8** — troubleshooting, from the list of failures you actually encountered across Tasks 12–16. If you hit nothing, the section says so honestly and stays short. Do not invent failure modes.

**Step 3: Commit** — `docs: write user guide sections 7-8`

---

### Task 18: Guide verification pass and handoff

**Step 1: Re-walk every section against the app,** top to bottom, as if you were the pilot coach following it cold. Every instruction must be executable exactly as written.

**Step 2: Fix everything that drifted.** Commit — `docs: correct user guide against full walkthrough`.

**Step 3: Refresh the seed one final time** (gated) so prod is left in a clean demo state.

**Step 4: Report to Scott:**
- Any design-doc / app mismatches found (flagged, not resolved)
- The empirical answer on native CSV exports vs templates
- Anything in either artifact that needs his judgment
- Then ask before `git push` and before opening a PR.

---

## Definition of done

- `docs/demo/DEMO_SCRIPT.md` exists, has survived the executor verification pass AND Scott's timed spoken run against the live app, and contains no absolute dates.
- `docs/USER_GUIDE.md` exists, and every section was written by walking the feature — including the CSV round trip.
- Neither artifact names a product version, promises an unbuilt feature, or blurs the AI constraint.
- Production is left with a fresh seed and no rehearsal residue.
- Nothing pushed and no PR opened without Scott's go-ahead.
