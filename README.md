# Track App MVP

A grassroots motorsport app for recording track sessions and providing coaching insights.

## Overview

Track App is a monorepo containing:

- **iOS App** (`/ios`): SwiftUI mobile app that records track driving sessions with automatic lap detection
- **Web Dashboard** (`/web`): Next.js coaching dashboard for reviewing sessions and adding notes

## Quick Start

### Prerequisites

- **iOS**: Xcode 15+ with Swift 5.9+
- **Web**: Node.js 18+, npm or yarn
- **Backend**: Supabase account (free tier works)

### Running the iOS App

```bash
cd ios/TrackApp
open TrackApp.xcodeproj
```

Then build and run in Xcode (Cmd+R). See [ios/README.md](ios/README.md) for details.

### Running the Web Dashboard

```bash
cd web
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [web/README.md](web/README.md) for details.

## Architecture

### Mobile (/ios)

- **Language**: Swift 5.9+
- **UI**: SwiftUI with MVVM architecture
- **State Management**: Custom session state machine
- **Persistence**: FileManager + JSON (designed for future sync)
- **Dependencies**: Zero third-party dependencies

### Web (/web)

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Postgres + Auth)
- **Testing**: Jest + React Testing Library

## Key Features

### iOS Session State Machine

The app implements a robust state machine with these states:

- **Disarmed**: Not ready to record
- **Armed**: Ready to auto-start when conditions are met
- **Recording**: Actively recording session and laps
- **PitsPause**: Paused in pits
- **End**: Session finished

**Auto-start triggers**:
- Crossing start-line geofence, OR
- Speed > 15 mph inside track geofence

**Auto-stop triggers**:
- Entering pit lane geofence, OR
- Speed < 10 mph for 30 seconds

**Dev Mode**: Simulate geofence/speed events for testing without driving

### Web Dashboard

- View all sessions with filtering by track/date
- Detailed lap analysis with delta comparisons
- Lap time charts
- Coaching notes per session
- Track and driver management

## Documentation

- [State Machine Specification](docs/state-machine.md)
- [Data Model & Schema](docs/data-model.md)
- [Architecture Decisions](docs/architecture.md)

## Project Structure

```
track-app-mvp/
├── ios/                    # iOS SwiftUI Application
│   └── TrackApp/
│       ├── TrackApp/       # Source code
│       │   ├── Models/
│       │   ├── ViewModels/
│       │   ├── Views/
│       │   ├── StateMachine/
│       │   ├── Services/
│       │   ├── Persistence/
│       │   └── Utils/
│       └── TrackAppTests/  # Unit tests
├── web/                    # Next.js Web Dashboard
│   ├── src/
│   │   ├── app/           # App Router pages & API routes
│   │   ├── lib/           # Utilities, types, Supabase client
│   │   └── components/    # React components
│   └── supabase/          # Database migrations
└── docs/                   # Documentation
```

## Testing

### iOS Tests

```bash
cd ios/TrackApp
xcodebuild test -scheme TrackApp -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Web Tests

```bash
cd web
npm test
```

## Deployment

- **iOS**: Submit to TestFlight/App Store via Xcode
- **Web**: Deploy to Vercel (recommended) or any Node.js host
- **Database**: Supabase handles hosting and scaling

## Development Roadmap

**MVP (Current)**:
- ✅ Core state machine
- ✅ Local persistence
- ✅ Basic web dashboard
- ✅ Manual session import

**Future Enhancements**:
- Real GPS/geofence integration
- Automatic session sync
- Siri/Apple Watch integration
- Sector timing
- Advanced analytics
- Multiple driver support
- Video integration

## License

See [LICENSE](LICENSE) for details.

## Support

For issues or questions, please open an issue in the repository.
