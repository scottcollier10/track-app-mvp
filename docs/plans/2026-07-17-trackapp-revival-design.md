# TrackApp Revival: Decision Packet and Pilot Design

Date: 2026-07-17
Status: Approved (brainstorm session, Scott + Claude)
Verdict: **Conditional GO. Free-first, org-level pilot. Six weeks of exposure, then a data-driven kill/continue decision.**

## 1. Decision framework

- Success = traction first, revenue second. Free/grassroots adoption counts as a win.
- Effort ceiling: 4-6 hours/week.
- iOS app is shelved. The product is the web portal: a CSV-first coaching layer over lap timers people already use (RaceChrono, TrackAddict, AiM, SoloStorm). Revisit iOS only if pilot retention says so.
- Distribution: Scott has direct relationships with instructors he can pitch this month.

## 2. Technical state (verified July 2026)

What exists:
- Polished Next.js/Supabase coach dashboard on Vercel: driver tables, consistency/behavior scores, session and lap analysis, working CSV import (RaceChrono, AiM, generic).
- Strong landing page positioning: not a lap timer, a coaching layer. "CSV-first, no new app mandate, works with partial adoption."
- Tenancy concept already in the data model (coach_id plumbing in API routes and schema), just never enforced.

What is missing:
- Zero auth. No RLS: all data publicly readable via anon key. Hardcoded DEMO_COACH_ID in the import route. No onboarding, billing, or iOS-to-web sync. AI coaching tables are empty scaffolding.
- Roughly 40% of a SaaS. The pilot needs far less than the missing 60%.

## 3. Competitive scan (July 2026): the niche is empty, with occupied borders

No product combines multi-student roster + cross-weekend progression + multi-source data aggregation for HPDE instructors.

| Player | What it is | Why it does not occupy the niche |
|---|---|---|
| Track Attack (~$50/yr Pro) | Analytics + cloud sharing, "teams" | Peer/team file sharing. No instructor dashboard, roster, or progress history |
| Garmin Catalyst 2 ($1,199, late 2025) | Self-coaching hardware | Single driver. Positioned as a supplement to instructors |
| Petrel Cloud "Coach" plan | Storage tier + sharing | A storage quota, not a workflow. Android-only logger |
| AiM Cloud (RaceStudio3) | File sharing between AiM users | AiM hardware only, no coach workflow |
| Trophi.ai / Track Titan ($5M seed) | AI coaching | Still sim-only. Track Titan is the watch item if they go real-world |
| Blayze (NASA coaching partner) | 1:1 video review marketplace (~$29 entry) | Monetizes pro coach time. No org tooling, no roster |
| NASA HPDE Passport / MotorsportReg | Progression logbook / registration + instructor assignment | Checkbox logbooks disconnected from telemetry. People sell paper HPDE logbooks on Etsy in 2026 |

Key insight: progression records and lap data both exist today. Nobody joins them. That seam is TrackApp's exact positioning.

## 4. Demand signals: latent, not screaming

- Continuity between events is a recognized, documented problem (Rennlist instructor threads), solved today with paper passbooks and eval sheets. Digitization at orgs stopped at liability waivers, never reached pedagogy.
- Nobody is begging for this tool in forums. Weigh that honestly: demand must be activated by a champion, not harvested.
- Warning quote from a Rennlist instructor: "If organizations start throwing barriers up... I'll stop completely." Volunteer instructors reject added workload. The tool must be zero-process for non-adopters.
- Market size: roughly 5,000-10,000 active US HPDE instructors (PCA ~155k members, 5,500+ trained instructors; SCCA ~65-70k members; MotorsportReg 10,500+ events). Small, dense, reachable. Never a Porsche-class SaaS.
- Who pays: volunteer instructors never (comped track time is their pay). Orgs are conditioned to free tooling (MotorsportReg is free-forever for organizers). Kart schools are the one segment where parents already fund coaching, so per-student tracking maps to revenue.
- Free-first is the proven wedge in this community: TrackAddict, RaceChrono, and MotorsportReg all won with free.

## 5. Reframes that change the pitch

1. The customer is the chief instructor/org, not the individual coach. Continuity is their problem. One champion onboards 20-50 instructors.
2. Free for instructors, forever. Monetize later (org tier or kart schools) only after retention proof.
3. Kart schools are pilot #2 for revenue validation, not pilot #1 for traction.
4. Language shift: "instructor corps and students," not "coach and drivers." Pitch language only, no code change now.

## 6. Build scope: pilot-safe in ~3 weeks (~15 hours)

Leverage: only ~9 API routes touch Supabase through one shared anon client (web/src/lib/supabase/client.ts). Single choke point, clean retrofit. No middleware exists to untangle.

- **Week 1, Auth**: Supabase magic-link login, login page, Next.js middleware protecting /coach, /drivers, /import. Link auth.users to coaches row.
- **Week 2, Tenancy**: RLS on drivers/sessions/laps (instructor sees only their students). Derive coachId from the auth session, not the URL param. Remove DEMO_COACH_ID from import-session route.
- **Week 3, Pilot polish**: CSV import auto-scoped to logged-in instructor. Simple "add student" flow (type a name, no student accounts). Delete backup page copies. Deploy, smoke test with a fake second account.

Explicitly excluded: billing, student logins, iOS, AI coaching, email invites, kart-school features.

Note: RLS is worth doing regardless of verdict. Data is currently publicly readable, and fixing it has standalone portfolio value.

## 7. Pilot plan

- **Phase 1 (weeks 1-3)**: Build, per above.
- **Phase 2 (parallel)**: Recruit one chief instructor champion at one org (PCA region, NASA region, or Chin) through direct contacts. Pitch: "Your instructors' student notes die at the end of every weekend. This keeps them. Free, no new app for students, CSVs they already have, zero added process for instructors who do not opt in."
- **Phase 3 (weeks 4-6)**: Pilot one event weekend. 3-5 instructors use it live, Scott on-call. Success metric: **do they open it at the next event without being asked?** Retention, not signups.

## 8. Kill/continue gates

- No chief instructor says yes after 3 asks: park as portfolio piece, write up for Sidera credibility.
- Pilot runs but nobody returns unprompted: same.
- Instructors return unprompted AND a second org asks about it: revisit iOS, kart-school revenue tier, and org pricing.

Total exposure: ~6 weeks at 4-6 hrs/week. Every outcome produces a clean answer.

## 9. Risks

- Latent demand fails to activate even with a champion (most likely failure mode).
- Track Titan's $5M could fund real-world expansion; they would arrive driver-facing, not coach-facing, so the seam likely survives.
- Free-first means revenue depends on a later kart-school or org tier that may never materialize. Accepted: traction is the goal.

## 10. Sources

Competitive: trackattack.io, garmin.com (Catalyst 2 press release), petreldata.com, trophi.ai, aimsports.com (RS3 Cloud), techfundingnews.com (Track Titan seed), apextrackcoach.com, blayze.io, drivenasa.com (HPDE Passport), kevinhoman.info (HPDE Analytics).

Demand: rennlist.com (thread 1306362), gprpca.com (HPDE advancement), mediaassets.pca.org (instructor training handbook), drivenasamidamerica.com, ews.bmwcca.org, pca.org, scca.com, newsroom.hagerty.com (MotorsportReg), motorsportreg.com, nomoneymotorsports.com, locktonmotorsports.com, speedsecrets.com, soflokc.com, grassrootsmotorsports.com, racechrono.com, etsy.com (paper HPDE logbook listing).
