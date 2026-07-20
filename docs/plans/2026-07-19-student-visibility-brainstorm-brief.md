# Student Visibility (Driver-Facing Views) — Brainstorm Brief

> **For Claude:** This is the starting brief for a brainstorming session. Use the superpowers:brainstorming skill — one question at a time, explore the approaches below plus any better ones, present the design in sections, then write a design doc and (if scoped in) an implementation plan. The FIRST question to settle is strategic sequencing, not architecture.

**Goal:** Decide whether — and in what form — students (drivers) get visibility into their own data: coach notes, progress, graphs, profile, sessions. Filtered views only; no admin/instructor surfaces.

## Origin and tension

- **Origin (Dec 2025 vision):** coach account owns drivers; each driver gets their own login with filtered views. Scott: "that was the goal and it makes a lot of sense."
- **Tension (July 2026 revival framework, docs/plans/2026-07-17-trackapp-revival-design.md + project memory):** student accounts were explicitly deferred "unless pilot retention justifies it." The pilot kill-gate metric is *instructors returning unprompted* — not student logins. Building tier 2 before tier 1 is validated is the known trap.
- **What changed since that deferral:** week-2 shipped the entire tenancy pattern — coach-scoped RLS on all tables, `coaches.auth_user_id` linking with email-claim backfill, invite-only magic-link signup, middleware gating. Driver accounts are structurally "the same thing again, one level down," so the build cost dropped substantially. Also: 10-20 students per instructor seeing the product is a viral/traction loop the instructor-only version lacks — and traction is the pilot's success currency.

## The sequencing question (answer FIRST)

Does student visibility strengthen the champion pitch ("your students see their progress") or dilute the pilot (more surface, more support, metric confusion)? Options: before pilot / during pilot as fast-follow / gated on pilot retention. The brainstorm should force an explicit choice with Scott.

## Candidate shapes (cheapest first — explore trade-offs, don't assume)

1. **Read-only share links (no accounts).** Signed/tokenized URL per driver → filtered progress page (progress, graphs, sessions, coach notes marked shareable). Instructor texts a student their link after an event. No invites, no roles, no login support burden. ~10% of the cost of accounts, most of the visibility value, and it IS the viral exposure. Design questions: token revocation/rotation, whether coach notes are shared by default or per-note opt-in, public-page SEO/noindex, RLS interaction (anon fails closed today — a share page needs a deliberate access path, e.g., server-side service-role fetch keyed by token, NOT an RLS loosening).
2. **Email digests (zero new surface).** Post-event summary email to the driver: best lap, deltas, coach note. Rides the existing SMTP. No pages at all. Weakest product pull, cheapest test of "do students even care?"
3. **Full driver accounts (the Dec 2025 vision).** `drivers.auth_user_id` (mirror the coaches pattern incl. email-claim linking), role concept (user is coach OR driver — decide: separate portals vs role-branched nav), RLS policies extended per table ("driver sees own rows"; notes visibility flag), invite flow (who invites — instructor? auto on import?), middleware/nav gating of all instructor surfaces. Roughly week-2-sized effort. Right answer eventually; the question is when.

Hybrid worth considering: ship 1 now as the pilot's student story, keep 3 as the post-validation upgrade path (tokens migrate to accounts naturally: "claim your page").

## Constraints

- Pilot posture: 4-6 hrs/week ceiling, traction-first, minimal surface (see memory + revival design doc).
- Language: "instructor corps / students" in product copy.
- RLS is live and fails closed for anon — any no-login option must NOT weaken policies; use explicit server-side access paths.
- Coach notes may contain candid instructor commentary — visibility to the student must be an explicit instructor choice (per-note or per-driver toggle), whatever shape wins.
- Email infra: Gmail SMTP via Supabase (auth emails). App-sent digest emails would need their own send path — Supabase SMTP is for auth only.
- No billing/tiers — free pilot.
- `drivers.email` is UNIQUE(coach_id, email) — the same student under two instructors is two rows. Full accounts must handle this (or explicitly punt).

## Prior art in this codebase

- Coach linking pattern to mirror: `web/src/lib/auth/ensure-coach.ts` (port/adapter, email-claim backfill, case-insensitive).
- Invite-only: `shouldCreateUser: false` + dashboard invites (week-2 decision).
- RLS policies: committed migration from week 2 (13 policies, authenticated-only).
- Middleware/public paths: `web/src/middleware.ts`, `web/src/lib/auth/public-paths.ts`.

## Process

Brainstorm (sequencing → shape → design) → design doc `docs/plans/YYYY-MM-DD-student-visibility-design.md` → plan only if scoped for build now. Execution: feature branch off main → implementer subagent → spec review → quality review → PR → Scott merges. Full `npm test` is the gate (78/78+ at time of writing).
