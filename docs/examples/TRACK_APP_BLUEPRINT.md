# Track App Blueprint

> **Version:** 1.0
> **Last Updated:** 2025-11-17
> **Status:** In Development (MVP)

---

## 1. Project Overview

### Name & Tagline
**Project Name:** Track App

**Tagline:** AI-powered coaching insights for grassroots motorsport drivers

**Elevator Pitch:**
Track App helps amateur racing drivers improve their lap times by automatically recording track sessions via iOS, analyzing performance data, and providing personalized AI coaching feedback. Drivers get professional-level insights without needing a dedicated coach.

### Problem Statement
**The Problem:**
- Grassroots motorsport participants lack access to professional coaching
- Tracking lap times manually is tedious and error-prone
- Understanding how to improve requires expertise most hobbyists don't have
- Professional coaching is expensive ($200+/hour) and not accessible to most

**The Solution:**
Track App combines automatic lap timing with Claude AI to deliver personalized coaching insights based on each driver's experience level, track conditions, and performance patterns. It's like having a professional coach in your pocket for a fraction of the cost.

### Target Users
| User Type | Description | Key Needs | Usage Pattern |
|-----------|-------------|-----------|---------------|
| **Primary: Amateur Drivers** | Track day participants, HPDE students, weekend racers | Lap timing, performance insights, improvement tips | Active during track weekends (2-4x/month) |
| **Secondary: Coaches/Instructors** | Professional coaches at track events | View student sessions, add manual notes, track progress | Review sessions after track days |

---

## 2. Core Entities & Data Model

### Main Entities
Based on `/home/user/track-app-mvp/web/supabase/migrations/20240101_initial_schema.sql`

| Entity | Purpose | Key Attributes | Relationships |
|--------|---------|----------------|---------------|
| **drivers** | User accounts | id, name, email, created_at | 1:M with sessions, 1:1 with driver_profiles |
| **tracks** | Racing circuits | id, name, location, length_meters, map_image_url | 1:M with sessions |
| **sessions** | Individual track days | id, driver_id, track_id, date, best_lap_ms, ai_coaching_summary, source | M:1 with driver/track, 1:M with laps/notes |
| **laps** | Individual laps | id, session_id, lap_number, lap_time_ms, sector_data | M:1 with sessions |
| **coaching_notes** | Manual coach feedback | id, session_id, author, body, created_at | M:1 with sessions |
| **driver_profiles** | AI coaching context | id, driver_id, experience_level, total_sessions, goals, vehicle_info | 1:1 with drivers |

### Entity Relationships
```
drivers --1:M--> sessions
tracks --1:M--> sessions
sessions --1:M--> laps
sessions --1:M--> coaching_notes
drivers --1:1--> driver_profiles
```

### Schema Sketch
```sql
-- Core tables
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  length_meters INTEGER,
  config JSONB,
  map_image_url TEXT
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id),
  track_id UUID REFERENCES tracks(id),
  date DATE NOT NULL,
  total_time_ms BIGINT,
  best_lap_ms BIGINT,
  coach_notes TEXT,
  ai_coaching_summary TEXT,
  source VARCHAR(50) DEFAULT 'ios'
);

CREATE TABLE laps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  lap_number INTEGER NOT NULL,
  lap_time_ms BIGINT NOT NULL,
  sector_data JSONB
);

CREATE TABLE coaching_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  author VARCHAR(255),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) UNIQUE,
  experience_level VARCHAR(50),
  total_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. User Flows

### Primary Workflows

#### Flow 1: Record and Import Track Session
**Goal:** Driver records lap times at track and imports to web dashboard

**Steps:**
1. Driver opens iOS app → Selects track from list
2. Driver starts session → App uses GPS to auto-detect laps
3. Driver completes session → App saves laps locally as JSON
4. Driver taps "Upload" → iOS sends POST to `/api/import-session`
5. API creates/finds driver → Creates session → Bulk inserts laps
6. Success → iOS shows confirmation, web dashboard updates

**Decision Points:**
- **At Step 1:** If track not found, driver can request new track addition
- **At Step 4:** If no internet, session queued for later upload

**Success Criteria:**
- [ ] Session appears in web dashboard within 5 seconds
- [ ] All laps recorded correctly with timestamps
- [ ] Driver account auto-created if first session

#### Flow 2: Review Session with AI Coaching
**Goal:** Driver reviews performance and receives personalized coaching

**Steps:**
1. Driver navigates to `/sessions/[id]` → Views lap times table and chart
2. System displays insights panel → Shows consistency score, pace trend, driving behavior
3. Driver clicks "Generate AI Coaching" → POST to `/api/coaching/generate`
4. API fetches session data + driver profile → Calculates performance metrics
5. API sends prompt to Claude Sonnet 4 → Receives structured coaching feedback
6. AI coaching displayed in card → Driver reads strengths, improvements, next goals

**Decision Points:**
- **At Step 3:** Only visible in "Coach View" mode (toggle in UI)
- **At Step 5:** If API fails, show cached coaching or generic tips

**Success Criteria:**
- [ ] AI coaching generates in <5 seconds
- [ ] Feedback is relevant to driver's experience level
- [ ] Coaching includes 2-3 strengths, 2-3 improvements, 1-2 goals

#### Flow 3: Update Driver Profile for Better AI Context
**Goal:** Driver provides experience level to improve coaching quality

**Steps:**
1. Driver navigates to `/profile` → Sees current profile info
2. Driver updates experience level dropdown → "Beginner" to "Expert"
3. Driver saves → POST to `/api/profile/update`
4. API updates driver_profiles table → Returns success
5. Future AI coaching requests use updated profile context

**Success Criteria:**
- [ ] Profile updates persist across sessions
- [ ] AI coaching reflects experience level in tone and complexity

---

## 4. LLM Integration Points

### AI Usage Map
From `/home/user/track-app-mvp/web/src/app/api/coaching/generate/route.ts`

| Feature | Model | Purpose | Input | Output | Est. Cost/Call |
|---------|-------|---------|-------|--------|----------------|
| **AI Coaching Generation** | claude-sonnet-4-20250514 | Personalized coaching feedback | Session data, lap times, driver profile, performance metrics | Structured coaching (strengths, improvements, goals) | ~$0.015 |

### Prompt Templates

#### AI Coaching Prompt
**Model:** claude-sonnet-4-20250514
**Max Tokens:** 1500
**Temperature:** Default (not specified)

**Prompt Structure:**
```
You are an experienced motorsport coach analyzing a track session.

Driver Profile:
- Name: {driver.name}
- Experience Level: {profile.experience_level}
- Total Sessions: {profile.total_sessions}

Session Data:
- Track: {track.name} ({track.location})
- Date: {session.date}
- Total Laps: {laps.length}
- Best Lap Time: {formatTime(session.best_lap_ms)}

Performance Metrics:
- Consistency Score: {metrics.consistencyScore}/100
- Pace Trend: {metrics.paceTrend}
- Driving Behavior Score: {metrics.drivingBehaviorScore}/100

Lap Times:
{formatted table of lap numbers and times}

Based on this data, provide coaching feedback in 3 sections:

1. Strengths (2-3 specific things done well)
2. Areas for Improvement (2-3 actionable suggestions)
3. Next Session Goals (1-2 measurable targets)

Keep feedback appropriate for a {experience_level} driver.
```

**Example:**
```
Driver: John Smith (Intermediate, 12 total sessions)
Track: Laguna Seca
Best Lap: 1:42.3
Consistency: 87/100, Pace: Improving ↗

Output:
"## Strengths
- Your consistency score of 87/100 is excellent for an intermediate driver..."
```

### Cost Estimates
**Assumptions:**
- 100 drivers/month (MVP target)
- 3 sessions per driver per month
- 1 AI coaching call per session
- Average 1500 tokens input + 800 tokens output = 2300 tokens/call

**Monthly Cost Projection:**
- Model: Claude Sonnet 4 ($3 per million input tokens, $15 per million output tokens)
- Input usage: 100 drivers × 3 sessions × 1500 tokens = 450K input tokens
- Output usage: 100 drivers × 3 sessions × 800 tokens = 240K output tokens
- Input cost: 450K × $3/1M = $1.35
- Output cost: 240K × $15/1M = $3.60
- **Total:** ~$5/month (MVP)

**Scaling Considerations:**
- At 1K drivers: ~$50/month
- At 10K drivers: ~$500/month
- At 100K drivers: ~$5,000/month

### Fallback Strategies
| Scenario | Fallback Action |
|----------|-----------------|
| **API timeout** | Show cached coaching from previous generation or "Try again" message |
| **Rate limit hit** | Queue request and notify user via email when ready |
| **Model unavailable** | Switch to Claude Haiku (faster, cheaper, lower quality) |
| **Poor quality output** | Log for review, re-prompt with additional context constraints |

---

## 5. Technical Stack

### Architecture Overview
```
[iOS SwiftUI App] --> [Next.js API Routes] --> [Supabase PostgreSQL]
                            |
                            v
                    [Anthropic Claude API]
```

### Technology Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend (Web)** | Next.js 14 (App Router), React 18, TypeScript | Server components, SEO, full-stack in one framework |
| **Frontend (Mobile)** | SwiftUI (iOS 16+) | Native performance, modern declarative UI, zero dependencies |
| **Backend** | Next.js API Routes (Node.js) | Collocated with frontend, serverless-ready, TypeScript end-to-end |
| **Database** | Supabase (PostgreSQL) | Managed Postgres, built-in auth (future), real-time subscriptions |
| **LLM Provider** | Anthropic Claude | Best reasoning for coaching feedback, context window, cost-effective |
| **Hosting (Web)** | Vercel | Native Next.js support, automatic deployments, edge functions |
| **Hosting (Mobile)** | TestFlight → App Store | Standard iOS distribution |

### Third-Party Services
- **Supabase:** Database + future auth - Free tier (MVP), $25/month (Production)
- **Anthropic API:** Claude Sonnet 4 - Pay-as-you-go (~$5-50/month projected)
- **Vercel:** Web hosting - Free tier (MVP), $20/month (Production)

### Development Tools
- **Version Control:** Git + GitHub
- **Package Manager:** npm
- **Testing:** Jest + React Testing Library (unit tests in `/web/src/lib/__tests__/`)
- **Linting:** ESLint + next lint
- **CI/CD:** GitHub Actions (future)
- **Monitoring:** None (MVP), plan for Sentry

### Deployment Strategy
**Environments:**
- **Development:** Local Next.js dev server + Supabase cloud DB
- **Staging:** Vercel preview deployments (PR-based)
- **Production:** Vercel production deployment (main branch)

**Deployment Process:**
1. Commit to feature branch
2. Push to GitHub
3. Vercel auto-deploys preview URL
4. Manual testing on preview
5. Merge to main → Auto-deploy to production

---

## 6. Metrics & Success Criteria

### User Metrics
From `/home/user/track-app-mvp/web/src/lib/analytics.ts` and `/web/src/lib/insights.ts`

| Metric | Target | How to Measure | Why It Matters |
|--------|--------|----------------|----------------|
| **Active Drivers** | 100 drivers by month 3 | Count unique driver_id in sessions table | Product-market fit signal |
| **Sessions per Driver** | 3-4 sessions/month avg | COUNT(sessions) / COUNT(DISTINCT driver_id) | Engagement and retention |
| **AI Coaching Adoption** | 60% of sessions generate coaching | Count sessions with ai_coaching_summary | Feature value validation |
| **Retention (30-day)** | 40% return after first session | Cohort analysis (drivers with sessions >30 days apart) | Stickiness and utility |

### Business Metrics
| Metric | Target | Timeline |
|--------|--------|----------|
| **Monthly Operating Cost** | <$100/month | Month 1-6 (MVP) |
| **Cost per Driver** | <$1/driver/month | Month 6 |
| **Coaching Cost per Session** | <$0.05/session | Ongoing |

### Technical Metrics
Calculated in `/home/user/track-app-mvp/web/src/lib/insights.ts`

| Metric | Target | Acceptable Range | Alert Threshold |
|--------|--------|------------------|-----------------|
| **AI coaching latency (p95)** | <5 seconds | 3-7 seconds | >10 seconds |
| **LLM cost per request** | <$0.02 | $0.01-0.03 | >$0.05 |
| **Session import success rate** | >95% | 90-100% | <85% |
| **Web dashboard load time** | <2 seconds | 1-3 seconds | >5 seconds |

**Session Analytics Tracked:**
- **Consistency Score:** `(1 - (std_dev / mean)) * 100` - measures lap-to-lap stability
- **Pace Trend:** Compare first 3 vs last 3 laps - "Improving ↗", "Fading ↘", or "Consistent →"
- **Driving Behavior Score:** `100 - (std_dev * 0.02)` - smoother driving = higher score

### Success Criteria (MVP)
**Must achieve within 6 months:**
- [ ] 100 active drivers using the app
- [ ] 60%+ drivers generate at least one AI coaching session
- [ ] <$100/month total operating costs
- [ ] 40% 30-day retention rate
- [ ] <5 second AI coaching generation time

---

## 7. MVP Scope

### Must-Haves (P0)
**Core functionality that must work for launch:**

- [x] **iOS Session Recording:** GPS-based automatic lap detection
  - Why: Core value prop - drivers need easy lap timing
  - Done when: Can record 20+ lap session with accurate times
  - Status: ✅ Complete (`/ios/TrackApp/`)

- [x] **Session Import API:** iOS → Web data sync
  - Why: Connects mobile recording to web analytics
  - Done when: Sessions appear in dashboard within 5 seconds
  - Status: ✅ Complete (`/web/src/app/api/import-session/route.ts`)

- [x] **Session Detail View:** Lap times table + chart visualization
  - Why: Drivers need to review lap-by-lap performance
  - Done when: Displays all laps with delta to best lap
  - Status: ✅ Complete (`/web/src/app/sessions/[id]/page.tsx`)

- [x] **Performance Insights:** Consistency, pace trend, behavior scores
  - Why: Automated analysis saves drivers time
  - Done when: Calculations match test cases in insights.test.ts
  - Status: ✅ Complete (`/web/src/lib/insights.ts`)

- [x] **AI Coaching Generation:** Claude Sonnet 4 personalized feedback
  - Why: Differentiator - AI replaces expensive human coach
  - Done when: Generates relevant feedback in <5 seconds
  - Status: ✅ Complete (`/web/src/app/api/coaching/generate/route.ts`)

- [x] **Driver Profiles:** Experience level for AI context
  - Why: Coaching quality depends on knowing driver skill
  - Done when: Profile persists and affects coaching tone
  - Status: ✅ Complete (`/web/src/app/profile/page.tsx`)

### Nice-to-Haves (P1)
**Valuable but not required for initial launch:**

- [ ] **Manual Coaching Notes:** Coaches can add text feedback
  - Value: Human coaches can supplement AI insights
  - Effort: Small (2 days)
  - Status: 🚧 In progress (`/web/src/components/ui/CoachNotes.tsx`)

- [ ] **Track Comparison:** Compare performance across different tracks
  - Value: Helps drivers understand track-specific strengths
  - Effort: Medium (5 days)

- [ ] **Best Lap Video Replay:** Upload GoPro footage linked to best lap
  - Value: Visual review enhances learning
  - Effort: Large (2 weeks) - video storage costs

- [ ] **Session Sharing:** Share session link with coach or friends
  - Value: Social proof and collaboration
  - Effort: Small (3 days)

### Explicitly Out of Scope
**Not doing in MVP (to avoid scope creep):**

- ❌ **User Authentication:** Deferred until post-MVP, using driver_id without login
- ❌ **Multi-platform (Android):** iOS-only for MVP, validate before porting
- ❌ **Real-time Session Streaming:** Import after session ends, no live tracking
- ❌ **Social Features:** No leaderboards, following, or comments until PMF proven
- ❌ **Payment/Monetization:** Free for MVP, figure out pricing later
- ❌ **Advanced Telemetry:** No G-forces, throttle position, brake pressure (future hardware)

### MVP Timeline
| Phase | Duration | Deliverables | Status |
|-------|----------|--------------|--------|
| **Phase 1: Setup** | 1 week | Database, Next.js scaffold, iOS project | ✅ Complete |
| **Phase 2: Core Features** | 3 weeks | Session recording, import, dashboard | ✅ Complete |
| **Phase 3: LLM Integration** | 2 weeks | AI coaching API, driver profiles | ✅ Complete |
| **Phase 4: Polish** | 2 weeks | Testing, UX improvements, bug fixes | 🚧 In Progress |
| **Launch** | Week 9 | TestFlight beta with 10 drivers | 📅 Upcoming |

---

## 8. Open Questions & Risks

### Technical Unknowns
| Question | Impact | How to Resolve | Owner | Due Date |
|----------|--------|----------------|-------|----------|
| GPS accuracy on different tracks? | MEDIUM | Field test at 3+ tracks, measure lap detection error rate | iOS Dev | Before beta |
| Claude API rate limits in practice? | LOW | Monitor in production, implement queuing if needed | Backend Dev | Week 1 post-launch |
| Session import at scale (100+ laps)? | MEDIUM | Load test with large session JSON payloads | Backend Dev | Before launch |

### Risks & Mitigation

#### Risk 1: GPS Lap Detection Inaccurate
- **Likelihood:** MEDIUM - GPS can drift or lose signal
- **Impact:** HIGH - Core feature failure, drivers lose trust
- **Mitigation:**
  - Implement start/finish line geofencing with configurable radius
  - Allow manual lap marking as fallback
  - Test at multiple tracks with known lap counts
- **Contingency:** Add manual lap time entry mode in iOS app

#### Risk 2: AI Coaching Quality Too Generic
- **Likelihood:** MEDIUM - LLMs can generate vague feedback
- **Impact:** HIGH - Defeats main value proposition
- **Mitigation:**
  - Include driver profile context (experience level, past sessions)
  - Provide structured output format in prompt
  - A/B test different prompt templates with real drivers
  - Human review of first 50 coaching outputs
- **Contingency:** Offer "request human review" button for coaches to refine

#### Risk 3: Anthropic API Costs Spike Unexpectedly
- **Likelihood:** LOW - Pricing is transparent and stable
- **Impact:** MEDIUM - Could blow budget if usage 10x higher than expected
- **Mitigation:**
  - Set up billing alerts at $50, $100, $200 thresholds
  - Implement rate limiting (1 coaching generation per session per day)
  - Monitor token usage per request
- **Contingency:** Switch to Claude Haiku or cache coaching results for 24 hours

#### Risk 4: Driver Adoption Too Slow
- **Likelihood:** MEDIUM - Grassroots motorsport is niche
- **Impact:** HIGH - Can't validate PMF without users
- **Mitigation:**
  - Launch at local track day events with in-person demos
  - Partner with HPDE instructors to recommend app
  - Post in track day Facebook groups / Reddit (r/trackdays)
  - Offer free coaching to first 50 users
- **Contingency:** Pivot to motorcycle track days (larger market) or expand to autocross

### Dependencies
| Dependency | Type | Status | Blocker For | Mitigation |
|------------|------|--------|-------------|------------|
| Anthropic API access | External | ✅ Approved | AI Coaching | Use free tier during dev, upgrade when needed |
| Supabase database | External | ✅ Active | All features | Self-host Postgres if Supabase has issues |
| iOS TestFlight approval | External | 📅 Pending | Beta launch | Prepare alternate distribution (ad-hoc builds) |
| Track GPS coordinates | Internal | 🚧 Partial | Lap detection | Crowdsource from drivers, start with 10 popular tracks |

### Assumptions
**This plan assumes:**
- [x] Drivers have iPhone 12+ with GPS (iOS 16+ requirement)
- [x] Users are comfortable uploading session data (privacy not a blocker)
- [x] AI coaching is "good enough" to replace entry-level human coaching
- [ ] Drivers attend 2-4 track days per month (high engagement)
- [ ] Cost of Claude API stays stable (<$0.02/request)

**If these assumptions are wrong:**
- **If drivers have older iPhones:** Lower iOS version requirement to iOS 15, accept degraded GPS
- **If privacy concerns arise:** Add local-only mode, don't require upload
- **If AI quality insufficient:** Add human coach review layer (paid tier)
- **If attendance lower (1x/month):** Adjust retention targets and monetization timeline

---

## Appendix

### Related Documents
- [Main README](/home/user/track-app-mvp/README.md) - Project overview
- [Database Schema](/home/user/track-app-mvp/web/supabase/migrations/20240101_initial_schema.sql) - Full schema
- [iOS State Machine](/home/user/track-app-mvp/docs/state-machine.md) - Session recording logic
- [AI Coaching API](/home/user/track-app-mvp/web/src/app/api/coaching/generate/route.ts) - Implementation details

### Key Files Reference
- **AI Coaching:** `/web/src/app/api/coaching/generate/route.ts`
- **Session Import:** `/web/src/app/api/import-session/route.ts`
- **Analytics Engine:** `/web/src/lib/analytics.ts`, `/web/src/lib/insights.ts`
- **Session Detail Page:** `/web/src/app/sessions/[id]/page.tsx`
- **Driver Profile:** `/web/src/app/profile/page.tsx`
- **iOS Models:** `/ios/TrackApp/TrackApp/Models/`

### Changelog
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-17 | 1.0 | Initial blueprint based on current MVP state | System |
