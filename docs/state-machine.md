# Session State Machine Specification

## Overview

The Track App session state machine manages the lifecycle of a track driving session. It handles automatic start/stop based on GPS and speed conditions, manual overrides, and lap detection.

## States

### 1. Disarmed
- **Description**: Not ready to record. Initial state or after session has ended.
- **UI Indication**: "Start Session" or "Arm Session" button
- **Valid Transitions**: → Armed

### 2. Armed
- **Description**: Ready to automatically start recording when trigger conditions are met.
- **UI Indication**: "Armed - Waiting for start" with cancel option
- **Valid Transitions**: → Recording, → Disarmed
- **Auto-triggers**:
  - Speed > 15 mph inside track geofence → Recording
  - Crossing start/finish geofence → Recording

### 3. Recording
- **Description**: Actively recording a session. Lap timer running, location being tracked.
- **UI Indication**: Large lap timer display, "Stop" button, "Mark Lap" button
- **Valid Transitions**: → PitsPause, → End
- **Auto-triggers**:
  - Crossing start/finish geofence → New lap recorded
  - Entering pit lane geofence → PitsPause
  - Speed < 10 mph for 30+ seconds → PitsPause

### 4. PitsPause
- **Description**: Session paused while in pit lane. Lap timer stopped but session continues.
- **UI Indication**: "Paused in Pits" with "Resume" button
- **Valid Transitions**: → Recording, → End
- **Auto-triggers**:
  - Speed > 15 mph → Recording
  - Exiting pit geofence → Recording

### 5. End
- **Description**: Session has ended. Summary screen displayed.
- **UI Indication**: Session summary with lap table, "Save" button
- **Valid Transitions**: → Disarmed
- **Behavior**: Session data is saved to persistence layer

## State Transition Diagram

```
┌───────────┐
│ Disarmed  │
└─────┬─────┘
      │ arm()
      ▼
┌───────────┐
│   Armed   │◄─────────┐
└─────┬─────┘          │
      │ auto-start     │ cancel()
      │ OR manual      │
      ▼                │
┌───────────┐          │
│ Recording │          │
└─────┬─────┘          │
      │ ┌──────────────┘
      │ │ manual stop
      ├─┤ OR
      │ └─ pit entry / low speed
      ▼
┌───────────┐
│PitsPause  │
└─────┬─────┘
      │ resume / speed up
      │
      ├──► (back to Recording)
      │
      │ end session
      ▼
┌───────────┐
│    End    │
└─────┬─────┘
      │ dismiss
      ▼
  (Disarmed)
```

## Events & Actions

### Manual Events
- **arm()**: Disarmed → Armed
- **start()**: Armed → Recording (manual override)
- **stop()**: Recording → End
- **pause()**: Recording → PitsPause (manual)
- **resume()**: PitsPause → Recording
- **markLap()**: Create lap while in Recording state
- **cancel()**: Armed → Disarmed
- **dismiss()**: End → Disarmed

### Automatic Events (Dev Mode Simulatable)
- **crossStartFinish()**: Recording → New lap recorded
- **speedAboveThreshold(speed: Double)**: Armed or PitsPause → Recording
- **speedBelowThreshold(speed: Double, duration: TimeInterval)**: Recording → PitsPause
- **enterPitGeofence()**: Recording → PitsPause
- **exitPitGeofence()**: PitsPause → Recording
- **enterTrackGeofence()**: Armed + speed check → Recording

## Business Rules

### Auto-Start Conditions
1. **Primary**: Crossing start/finish line geofence while Armed
2. **Fallback**: Speed exceeds 15 mph while inside track geofence and Armed

### Auto-Lap Detection
- Every time the start/finish geofence is crossed while Recording
- Lap time is calculated from previous crossing
- First crossing starts Lap 1 (no complete lap yet)

### Auto-Pause Conditions
1. **Pit Entry**: Entering pit lane geofence → immediate pause
2. **Low Speed**: Speed < 10 mph continuously for 30 seconds → pause

### Auto-Resume Conditions
1. Speed exceeds 15 mph while in PitsPause
2. Exiting pit lane geofence while in PitsPause

## Dev Mode Simulation

For MVP testing without actual GPS/geofence hardware, Dev Mode provides UI controls to trigger:

### Simulatable Events
- ✅ **Cross Start/Finish**: Simulates geofence crossing
- ✅ **Speed Change**: Slider to set simulated speed (0-120 mph)
- ✅ **Enter Pits**: Simulates pit lane geofence entry
- ✅ **Exit Pits**: Simulates pit lane geofence exit
- ✅ **Enter Track**: Simulates track geofence entry
- ✅ **Low Speed Timer**: Fast-forward the 30-second low-speed timer

### Dev Mode Access
- Hidden by default
- Triple-tap on session state indicator to enable/disable
- Shows as overlay panel in Live Session screen

## Implementation Notes

### State Machine Design
```swift
enum SessionState {
    case disarmed
    case armed(trackId: UUID)
    case recording(session: Session, startTime: Date, lapStartTime: Date)
    case pitsPause(session: Session, pauseStartTime: Date)
    case end(session: Session)
}
```

### Thread Safety
- All state transitions must happen on main thread
- Location/speed updates processed on background queue, then dispatch state changes to main

### Persistence
- Auto-save session on every lap completion
- Final save on End state transition
- Keep in-memory session during Recording to minimize I/O

### Testing
- State machine logic isolated in pure Swift class
- UI/location/persistence injected via protocols
- Unit tests can simulate sequences without SwiftUI or GPS

## Future Enhancements

### Planned (Post-MVP)
- Sector timing (3 intermediate geofences per lap)
- Out-lap / In-lap detection (flag first/last laps)
- Multiple session types (practice, qualifying, race)
- Weather condition triggers
- Flag conditions (red flag → auto-pause)

### Voice/Remote Control (Hooks Only in MVP)
Intents to expose:
- "Arm track session"
- "Start track session"
- "Stop track session"
- "Mark lap"
- "Announce last lap time"

These will map to state machine methods but voice recognition not implemented in MVP.
