# Track App - iOS

SwiftUI app for recording track driving sessions with automatic lap detection.

## Requirements

- macOS 14+ (Sonoma)
- Xcode 15+
- iOS 17+ (target deployment)
- Swift 5.9+

## Project Setup

Since this project was scaffolded without Xcode, you'll need to create the Xcode project:

### Option 1: Create New Xcode Project (Recommended)

1. Open Xcode
2. File → New → Project
3. Choose "iOS" → "App"
4. Configure:
   - **Product Name**: TrackApp
   - **Organization Identifier**: com.yourcompany (or your identifier)
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None (we use custom persistence)
5. Save to `ios/TrackApp/`
6. Add all source files from `TrackApp/` folder to the project:
   - Drag the folders into Xcode's project navigator
   - Ensure "Copy items if needed" is UNCHECKED (files are already in place)
   - Select "Create groups" (not folder references)
   - Add to TrackApp target
7. Add test files from `TrackAppTests/` to the test target

### Option 2: Import Existing Files

If you have an existing project:
1. Copy all `.swift` files from this repository to your project
2. Ensure file structure matches Xcode groups for organization

## Project Structure

```
TrackApp/
├── TrackAppApp.swift           # App entry point
├── Models/                     # Data models
│   ├── Track.swift
│   ├── Session.swift
│   └── Lap.swift
├── ViewModels/                 # MVVM ViewModels
│   ├── HomeViewModel.swift
│   ├── TrackSelectionViewModel.swift
│   ├── LiveSessionViewModel.swift
│   └── SessionSummaryViewModel.swift
├── Views/                      # SwiftUI Views
│   ├── Home/
│   │   └── HomeView.swift
│   ├── TrackSelection/
│   │   └── TrackSelectionView.swift
│   ├── LiveSession/
│   │   ├── LiveSessionView.swift
│   │   └── DevModePanel.swift
│   └── SessionSummary/
│       └── SessionSummaryView.swift
├── StateMachine/              # Session state machine
│   ├── SessionStateMachine.swift
│   ├── SessionState.swift
│   └── SessionEvent.swift
├── Services/                  # External services
│   ├── APIService.swift
│   └── LocationService.swift (future)
├── Persistence/               # Local storage
│   ├── PersistenceService.swift
│   └── FileManagerPersistence.swift
└── Utils/                     # Helpers
    ├── Config.swift
    ├── TimeFormatter.swift
    └── Extensions.swift

TrackAppTests/
├── StateMachine/
│   └── SessionStateMachineTests.swift
└── Persistence/
    └── PersistenceTests.swift
```

## Running the App

1. Open `TrackApp.xcodeproj`
2. Select a simulator (iPhone 15 recommended) or physical device
3. Press Cmd+R to build and run
4. For physical device: Update bundle identifier and signing in project settings

## Running Tests

### Via Xcode
1. Cmd+U to run all tests
2. Cmd+6 to open Test Navigator and run individual tests

### Via Command Line
```bash
cd ios/TrackApp
xcodebuild test \
  -scheme TrackApp \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -resultBundlePath TestResults
```

## Features

### Dev Mode

The app includes a **Dev Mode** for testing without GPS/geofence hardware:

1. Run the app
2. Navigate to Live Session screen
3. Triple-tap the state indicator
4. Dev Mode panel appears with controls:
   - Speed slider (0-120 mph)
   - "Cross Start/Finish" button
   - "Enter Pits" / "Exit Pits" buttons
   - "Fast-forward low speed timer"

This allows full testing of the state machine transitions.

### Session States

- **Disarmed**: Not recording
- **Armed**: Ready to auto-start
- **Recording**: Active session, lap timer running
- **PitsPause**: Paused in pits
- **End**: Session complete, summary shown

See [docs/state-machine.md](../docs/state-machine.md) for detailed state machine documentation.

## Configuration

Edit `Utils/Config.swift` to configure:

```swift
struct Config {
    static let apiBaseURL = "http://localhost:3000"  // Change for production
    static let autoStartSpeedThreshold = 15.0        // mph
    static let autoStopSpeedThreshold = 10.0         // mph
    static let lowSpeedDuration = 30.0               // seconds
}
```

## Persistence

Sessions are stored locally as JSON:
- Location: `Documents/TrackApp/`
- Files:
  - `tracks.json` - List of tracks
  - `sessions/<session-id>.json` - Individual session files

To inspect:
- Simulator: `~/Library/Developer/CoreSimulator/Devices/<device-id>/data/Containers/Data/Application/<app-id>/Documents/TrackApp/`
- Use Xcode → Window → Devices and Simulators → Download Container

## Uploading Sessions to Web

1. Complete a session (End state)
2. On Session Summary screen, tap "Upload to Dashboard"
3. Session is sent to configured API endpoint
4. Requires web server to be running (see `/web/README.md`)

## Troubleshooting

### "No such module" errors
- Ensure all files are added to the TrackApp target
- Clean build folder: Shift+Cmd+K

### Tests not found
- Ensure test files are added to TrackAppTests target
- Check Test Navigator (Cmd+6)

### Simulator crashes
- Reset simulator: Device → Erase All Content and Settings
- Clean derived data: rm -rf ~/Library/Developer/Xcode/DerivedData

### JSON persistence errors
- Check console logs for file path errors
- Ensure Documents directory is writable
- Use Xcode debugger to inspect file paths

## Next Steps

1. **GPS Integration**: Replace dev mode with real `CLLocationManager`
2. **Geofence Setup**: Add track geofence coordinates to `Track` model
3. **Background Recording**: Enable background location updates
4. **Apple Watch**: Extend state machine to WatchOS app
5. **Siri Integration**: Add voice intents for hands-free control
6. **Auto Sync**: Background upload when WiFi available

## Architecture Notes

- **MVVM**: Clear separation between views and business logic
- **Observable**: ViewModels use `@Observable` macro for SwiftUI reactivity
- **Protocols**: Services use protocols for testability
- **Pure State Machine**: State logic isolated from UI for testing
- **No Dependencies**: Zero third-party libraries

See [docs/architecture.md](../docs/architecture.md) for detailed architectural decisions.
