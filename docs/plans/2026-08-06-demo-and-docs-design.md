# Demo Script + User Guide — Design

**Date:** 2026-08-06
**Status:** Validated in brainstorm, ready for planning

## What this is

Two deliverables that turn P1–P3 into something a real coach can see and use. This is the companion to the traction fork, not a detour from it.

A demo script is a performance: time-boxed, narrative, you're in the room. User documentation is a reference: the coach is alone and stuck. Same source of truth, opposite shapes. They are scoped separately even if one agent builds both.

## Decisions (settled — do not reopen)

| Decision | Answer |
|---|---|
| Demo audience | Prospect chief instructor, ~10 minutes, goal is "yes to a pilot." Structured so a 30–40 min pilot walkthrough can extend acts later. |
| Docs audience | The committed pilot coach, alone and stuck. Operating reference, not a brochure. No doc for the evaluating coach. |
| Versioning | No product version number. Docs carry a doc date. The session→day reorganization is told as product thesis, not changelog. |
| Demo format | Full canon treatment: pre-demo checklist, timed acts, bracketed stage directions, verbatim narration. Rehearsable word-for-word. |
| Reset strategy | Seed refresh. `day_summaries.track_day_id` FK cascades on delete, and the generator's wholesale `track_days` delete sweeps all demo summaries. Rehearse freely on the six seeded drivers; refresh after. No sacrificial driver needed. |
| AI constraint rule | Headline feature in both artifacts, never a footnote. The AI observes and summarizes coach-directed work; it never authors driving instruction, readiness calls, or safety recommendations. Nothing publishes without coach approval; every summary carries provenance. |

## Deliverable 1: `docs/demo/DEMO_SCRIPT.md`

Canon format, written against seeded drivers **by name and by day** — never "navigate to a driver with a regression." The seed is deterministic and regenerable, which makes the demo repeatable and rehearsable. An abstract script drifts from the data on the first refresh.

### Pre-demo checklist (in the script)

- Seed refresh: `npx tsx scripts/seed/generate-demo-seed.ts --coach-email=...`, apply emitted `demo-seed.sql` via Supabase SQL editor (or psql — connection string from the Supabase dashboard; the old worktree `.env` is gone)
- Verify Elena's approved Aug 2 summary renders
- Verify all six drivers present
- Browser tabs staged

### The arc (~10 min, five acts)

Exact days, lap counts, and summary text come from `web/scripts/seed/demo-scenarios.ts` at writing time.

1. **The problem (60s).** Coach dashboard, six drivers. After a track day you have transponder CSVs and memories; coaching happens across days, but evidence lives in scattered sessions. Land the thesis: drivers develop across days, days progress through sessions, sessions contain the evidence.
2. **Seeing a day (2 min).** **Marcus**, the regression. One track day: sessions, laps, the day view showing him going backward. The day view answers "what happened?" faster than timing sheets.
3. **The coaching loop (2.5 min).** **Elena**, the showpiece. Focus-item arc across three days: assigned, carried, evidenced. Coach-directed development, not lap-time trivia. **Ava** (spread) gets one supporting beat if pacing allows.
4. **AI with a leash (2.5 min).** Elena's approved Aug 2 summary and its provenance. Then a **live Generate on Marcus's day** — real AI in the room. Narration hits the hard rule. Residue swept by post-demo refresh.
5. **Honesty at the edges + the ask (2 min).** **Jordan** at n=1, rendered gracefully, representativeness flagged — the app doesn't fake confidence. **Sam** gets one sentence as the quiet control. Close on the pilot ask: free, org-level, bring your CSVs.

**Kai** (fading) is held in reserve: natural Act 2 alternate and the seam where the pilot-walkthrough version expands.

### Post-demo

Same seed refresh. Cascade sweeps any live Generate/Approve residue; Elena's approved summary is re-inserted deterministically.

## Deliverable 2: `docs/USER_GUIDE.md`

Organized by what the coach is trying to do, not by feature:

1. **How TrackApp thinks** — day-centric thesis up front. One page, no marketing.
2. **Getting set up** — invite-only access, first login, adding drivers (verified against the shipped app, not assumed).
3. **Getting your data in** — opens with the day-of workflow: capture on device (RaceChrono / TrackAddict / AiM / timing system) → export → get the file to your machine (email, Dropbox, AirDrop) → upload when you have connectivity. TrackApp needs no internet at the track; import happens after the day, which matches the thesis — coaching happens reviewing the day, not mid-lap. Then the three per-app templates (`web/public/track-app-{racechrono,trackaddict,aim}-template.csv`) and generic format, and what failed/partial import looks like. Keep this practical, not a focus section.
4. **Reading a track day** — day view walkthrough: sessions, laps, trends, what a regression looks like on screen.
5. **Running the coaching loop** — focus items: creating, carrying across days, evidence. The operational heart of the doc.
6. **AI day summaries** — own top-level section: what Generate does, summary contents, provenance, the approval gate, superseding. Leads with the constraint as a promise.
7. **When the data is thin** — n=1 days, representativeness flags, why the app hedges.
8. **Troubleshooting** — only failure modes actually encountered walking the app.

## Production process

**Sourcing hierarchy** (both artifacts):
1. The running app — authoritative for behavior and UI
2. `demo-scenarios.ts` — authoritative for demo data
3. Four design docs for *why* only: `2026-07-17-trackapp-revival-design.md`, `2026-07-28-track-day-model-design.md`, `2026-08-01-ai-day-summary-design.md`, `2026-07-31-coaching-loop-phase2-design.md`
4. `*-plan.md` / `*-implementation.md` — never consulted

**Build order:** demo script first, then user guide. The script rehearsal doubles as feature verification for the guide, and the demo is what the traction fork needs soonest.

**Demo verification:** one clean end-to-end dress rehearsal is the bar. Seed refresh → every act against the live app → every named driver/day/number matches what renders → live Generate on Marcus works → refresh → Elena's summary restored.

**Guide verification:**
- Every section written by walking the feature, including the CSV round-trip (native export → template → import → day view)
- Verify whether native RaceChrono/TrackAddict exports parse as-is or need template massaging — document whichever is true
- AI-behavior claims checked against `web/src/lib/coaching-prompts.ts`, not design-doc intent
- Design-doc/app mismatches flagged to Scott, never silently resolved

**Prod caution:** rehearsals write to prod via the app, demo drivers only. Live demo beats stay on the six seeded drivers — the seed refresh only sweeps demo drivers' days.

## Out of scope this pass

- Pilot-partner walkthrough script (extends this one later)
- Talking points / skeptic Q&A companion docs (YAGNI until a prospect asks)
- Any doc for the evaluating coach
- Live timing / realtime ingest (deliberately not the product)
