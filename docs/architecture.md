# Architecture Decisions

## Overview

This document explains key architectural choices made for Track App MVP and the rationale behind them.

---

## 1. Monorepo Structure

**Decision**: Use a single repository with `/ios` and `/web` subdirectories.

**Rationale**:
- Simplifies coordination between mobile and web development
- Single source of truth for documentation
- Easier to keep data models in sync
- Simpler CI/CD setup for MVP
- Can split later if needed

**Trade-offs**:
- Larger repo size
- Need clear separation of dependencies
- Different toolchains (Xcode vs npm) in one repo

---

## 2. iOS Architecture: MVVM

**Decision**: Use Model-View-ViewModel pattern for iOS app.

**Rationale**:
- Natural fit for SwiftUI's reactive paradigm
- Clear separation of concerns:
  - **Models**: Pure data structures (Track, Session, Lap)
  - **ViewModels**: Business logic and state management (`@Observable`)
  - **Views**: SwiftUI views that observe ViewModels
- Testable: ViewModels can be unit tested without UI
- Standard pattern in SwiftUI community

**Structure**:
```
Models/          # Codable structs
ViewModels/      # Observable classes with business logic
Views/           # SwiftUI views
StateMachine/    # Pure Swift state machine (no UI dependencies)
Services/        # External integrations (API, location)
Persistence/     # Storage abstraction
```

---

## 3. iOS Persistence: FileManager + JSON

**Decision**: Use JSON files stored via FileManager instead of CoreData.

**Rationale**:
- **Simplicity**: No CoreData stack or migration complexity
- **Debuggable**: JSON files are human-readable
- **Portable**: Easy to serialize for API upload
- **Sufficient scale**: MVP will have <100 sessions locally
- **Future-proof**: Easy to migrate to sync-based storage later

**Implementation**:
```swift
protocol PersistenceService {
    func saveSessions(_ sessions: [Session]) throws
    func loadSessions() throws -> [Session]
    func saveSession(_ session: Session) throws
}
```

**Trade-offs**:
- No complex queries (but don't need them for MVP)
- No automatic sync (planned for future)
- Manual array operations vs automatic object graph management

---

## 4. State Machine: Pure Swift Class

**Decision**: Implement session state machine as a pure Swift class separate from UI.

**Rationale**:
- **Testability**: Can unit test all state transitions without SwiftUI
- **Reusability**: Could be used in widget, watch app, or background service
- **Clarity**: State logic isolated from view code
- **Safety**: Exhaustive switch statements prevent invalid states

**Design Pattern**:
```swift
@Observable
class SessionStateMachine {
    private(set) var state: SessionState = .disarmed

    func arm(track: Track) { /* transition logic */ }
    func start() { /* transition logic */ }
    // ...
}
```

Uses Swift's `@Observable` macro for SwiftUI integration while keeping logic testable.

---

## 5. Web Framework: Next.js App Router

**Decision**: Use Next.js 14+ with App Router (not Pages Router).

**Rationale**:
- **Modern**: App Router is the current standard for Next.js
- **Server Components**: Better performance and SEO
- **Co-located API routes**: Route handlers in same directory as pages
- **Streaming**: Can stream data for better UX
- **TypeScript**: First-class TypeScript support

**Structure**:
```
src/app/
  layout.tsx              # Root layout
  page.tsx                # Home dashboard
  sessions/
    page.tsx              # Sessions list
    [id]/page.tsx         # Session detail
  api/
    import-session/
      route.ts            # POST endpoint
```

---

## 6. Backend: Supabase

**Decision**: Use Supabase (PostgreSQL + Auth) instead of custom backend.

**Rationale**:
- **Fast setup**: Database, auth, and APIs in minutes
- **SQL**: Postgres is proven, scalable, and queryable
- **Free tier**: Generous for MVP
- **RLS**: Row-level security built-in
- **Real-time**: Can add live updates later
- **TypeScript client**: Good DX

**Trade-offs**:
- Vendor lock-in (mitigated: it's just Postgres underneath)
- Less control than custom backend
- Need to learn Supabase-specific patterns

---

## 7. Styling: Tailwind CSS

**Decision**: Use Tailwind CSS for web dashboard styling.

**Rationale**:
- **Fast development**: No context switching to CSS files
- **Consistency**: Design system in utility classes
- **Small bundle**: Only used classes are included
- **Customizable**: Easy to extend theme
- **Next.js integration**: Official support

**Alternatives considered**:
- Plain CSS: More verbose, harder to maintain
- CSS-in-JS (Emotion, styled-components): Extra runtime cost
- Component library (MUI, Chakra): Too heavy for MVP

---

## 8. Zero Third-Party Dependencies (iOS)

**Decision**: Avoid third-party iOS libraries for MVP.

**Rationale**:
- **Simplicity**: No dependency management
- **Security**: No supply chain risks
- **Long-term maintenance**: No breaking changes from external libs
- **Learning**: Good practice to understand fundamentals
- **Small scope**: MVP doesn't need complex libraries

**What we're building ourselves**:
- State machine
- JSON persistence
- Simple HTTP client (URLSession)
- No analytics, crash reporting, or fancy UI components yet

---

## 9. Dev Mode for Geofence Simulation

**Decision**: Build a dev mode to simulate GPS/geofence events rather than requiring real track testing during development.

**Rationale**:
- **Velocity**: Can test state machine without driving
- **Reproducibility**: Same test scenarios every time
- **Safety**: Develop without distraction
- **Cost**: No track fees during development

**Implementation**:
- Hidden UI panel (triple-tap to activate)
- Buttons to trigger: crossing start/finish, pit entry/exit, speed changes
- Fast-forward timer for low-speed detection

**Future**: Real GPS integration post-MVP.

---

## 10. Offline-First iOS, Online-Only Web

**Decision**: iOS works fully offline; web requires internet connection.

**Rationale**:
- **iOS**: Must work at track (often no/poor cell service)
- **Web**: Dashboard used in office/home with reliable internet
- **Simplicity**: Don't need offline-first web for MVP

**Sync Strategy (MVP)**:
- Manual "upload session" button in iOS
- Simple HTTP POST to web API
- Future: Automatic sync when connected

---

## 11. Testing Strategy

**Decision**: Focus unit tests on state machine; light integration tests for API.

**Test Coverage Goals**:
- **iOS**: >80% coverage on state machine
- **iOS**: Basic smoke tests for ViewModels
- **Web**: Test API route handlers
- **Web**: Test utility functions (delta calculations, etc.)

**What we're NOT testing in MVP**:
- SwiftUI views (require UI testing, high maintenance)
- Supabase client (trust the library)
- End-to-end tests (too slow for MVP)

**Tools**:
- iOS: XCTest
- Web: Jest + React Testing Library

---

## 12. Authentication: Supabase Email Auth

**Decision**: Use Supabase email/password auth (no social login for MVP).

**Rationale**:
- **Simplest**: One provider, one flow
- **Sufficient**: Drivers can use email
- **No OAuth setup**: Avoid Google/Apple developer account complexity
- **Can add later**: Easy to add social login post-MVP

**Auth Flow**:
- Sign up: Email + password → Supabase creates user
- Login: Email + password → Supabase returns session token
- Protected pages: Check session, redirect if not authenticated

---

## 13. No Real-Time Features (MVP)

**Decision**: Defer real-time updates, live tracking, and WebSockets to post-MVP.

**Rationale**:
- **Complexity**: Real-time adds significant development time
- **MVP scope**: Not required for core functionality
- **Supabase ready**: Easy to add Supabase real-time subscriptions later

**What this means**:
- Web dashboard shows static data (refresh to update)
- No live session viewing while driver is on track
- Coaching notes don't appear live to others

---

## 14. API Design: RESTful JSON

**Decision**: Use simple REST endpoints with JSON payloads.

**Rationale**:
- **Universal**: Works with any HTTP client
- **Simple**: No GraphQL complexity for MVP
- **Debuggable**: Easy to test with curl/Postman
- **Sufficient**: Limited API surface area

**Endpoints** (MVP):
```
POST /api/import-session    # Upload session from iOS
GET  /api/sessions          # List sessions (future)
GET  /api/sessions/:id      # Get session detail (future)
```

Most reads happen directly via Supabase client in server components.

---

## 15. Version Control Strategy

**Decision**: Feature branches with descriptive names, squash merges to main.

**Branch Naming**:
- `feature/state-machine`
- `feature/web-dashboard`
- `fix/lap-timer-bug`

**Commit Message Style**:
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`
- Descriptive body when needed

---

## 16. Environment Variables

**Decision**: Use `.env.local` for web, hardcoded config for iOS MVP.

**Web** (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

**iOS** (hardcoded in `Config.swift` for MVP):
```swift
struct Config {
    static let apiBaseURL = "http://localhost:3000"
    // Change to production URL when deploying
}
```

**Future**: iOS settings screen to configure API URL.

---

## Technology Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| iOS UI | SwiftUI | iOS 17+ |
| iOS Language | Swift | 5.9+ |
| iOS Persistence | FileManager + JSON | N/A |
| iOS Testing | XCTest | Built-in |
| Web Framework | Next.js | 14+ |
| Web Language | TypeScript | 5+ |
| Web Styling | Tailwind CSS | 3+ |
| Web Testing | Jest | Latest |
| Database | PostgreSQL (Supabase) | 15+ |
| Auth | Supabase Auth | N/A |
| Hosting | TBD | Vercel (recommended) |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-01 | Monorepo | Simpler coordination for MVP |
| 2024-01 | MVVM for iOS | Standard SwiftUI pattern |
| 2024-01 | FileManager persistence | Simplest for MVP, easy to migrate |
| 2024-01 | Next.js App Router | Modern Next.js standard |
| 2024-01 | Supabase | Fastest backend setup |
| 2024-01 | Tailwind CSS | Best DX for utility-first styling |
| 2024-01 | Dev mode geofence simulation | Enable testing without driving |

---

## Future Architecture Considerations

**When to refactor/change**:

1. **iOS → CoreData**: If local query complexity increases
2. **iOS → SwiftData**: When iOS 17+ is minimum target
3. **Custom backend**: If Supabase limitations encountered
4. **GraphQL**: If API complexity grows significantly
5. **Separate repos**: If team grows and coordination overhead is high
6. **Real-time**: When live tracking becomes priority
7. **Native sync**: When offline→online sync becomes critical

For now, keep it simple and ship the MVP.
