//
//  SessionStateMachine.swift
//  TrackApp
//
//  Core state machine for managing track session lifecycle
//  Pure Swift class - no UI dependencies for testability
//

import Foundation
import Observation

@Observable
class SessionStateMachine {
    // MARK: - State
    private(set) var state: SessionState = .disarmed

    // MARK: - Configuration
    private let autoStartSpeedThreshold: Double
    private let autoStopSpeedThreshold: Double
    private let lowSpeedDuration: TimeInterval

    // MARK: - Callbacks
    /// Called when state changes
    var onStateChange: ((SessionState, SessionState) -> Void)?

    /// Called when a lap is completed
    var onLapCompleted: ((Lap) -> Void)?

    // MARK: - Initialization
    init(
        autoStartSpeedThreshold: Double = Config.autoStartSpeedThreshold,
        autoStopSpeedThreshold: Double = Config.autoStopSpeedThreshold,
        lowSpeedDuration: TimeInterval = Config.lowSpeedDuration
    ) {
        self.autoStartSpeedThreshold = autoStartSpeedThreshold
        self.autoStopSpeedThreshold = autoStopSpeedThreshold
        self.lowSpeedDuration = lowSpeedDuration
    }

    // MARK: - Public API
    /// Handle an event and potentially transition state
    func handle(_ event: SessionEvent) {
        let oldState = state
        state = transition(from: state, on: event)

        if state != oldState {
            onStateChange?(oldState, state)
        }
    }

    /// Reset to disarmed state
    func reset() {
        state = .disarmed
    }

    // MARK: - State Transitions
    private func transition(from currentState: SessionState, on event: SessionEvent) -> SessionState {
        switch (currentState, event) {

        // MARK: Disarmed Transitions
        case (.disarmed, .arm(let track)):
            return .armed(track: track)

        // MARK: Armed Transitions
        case (.armed(let track), .manualStart):
            return startRecording(for: track)

        case (.armed(let track), .speedAboveThreshold(let mph)) where mph >= autoStartSpeedThreshold:
            return startRecording(for: track)

        case (.armed(let track), .crossStartFinish):
            return startRecording(for: track)

        case (.armed, .cancel):
            return .disarmed

        // MARK: Recording Transitions
        case (.recording(var session, let startTime, _), .crossStartFinish):
            // Complete current lap and start new one
            let lapTime = Date().timeIntervalSince(session.date) * 1000 // ms since session start
            let lap = Lap(
                lapNumber: session.lapCount + 1,
                lapTimeMs: Int(lapTime)
            )
            session.addLap(lap)
            onLapCompleted?(lap)
            return .recording(session: session, startTime: startTime, lapStartTime: Date())

        case (.recording(var session, let startTime, let lapStartTime), .manualMarkLap):
            // Manually mark a lap
            let lapTime = Date().timeIntervalSince(lapStartTime).milliseconds
            let lap = Lap(
                lapNumber: session.lapCount + 1,
                lapTimeMs: lapTime
            )
            session.addLap(lap)
            onLapCompleted?(lap)
            return .recording(session: session, startTime: startTime, lapStartTime: Date())

        case (.recording(let session, _, _), .enterPitLane):
            return .pitsPause(session: session, pauseStartTime: Date())

        case (.recording(let session, _, _), .speedBelowThreshold(let mph, let duration))
            where mph < autoStopSpeedThreshold && duration >= lowSpeedDuration:
            return .pitsPause(session: session, pauseStartTime: Date())

        case (.recording(let session, _, _), .manualPause):
            return .pitsPause(session: session, pauseStartTime: Date())

        case (.recording(var session, let startTime, _), .manualStop):
            // End the session
            session.totalTimeMs = Date().timeIntervalSince(startTime).milliseconds
            return .end(session: session)

        case (.recording(var session, let startTime, _), .timerTick):
            // Update total time
            session.totalTimeMs = Date().timeIntervalSince(startTime).milliseconds
            return .recording(session: session, startTime: startTime, lapStartTime: Date())

        // MARK: PitsPause Transitions
        case (.pitsPause(let session, _), .resume):
            return .recording(session: session, startTime: Date(), lapStartTime: Date())

        case (.pitsPause(let session, _), .speedAboveThreshold(let mph)) where mph >= autoStartSpeedThreshold:
            return .recording(session: session, startTime: Date(), lapStartTime: Date())

        case (.pitsPause(let session, _), .exitPitLane):
            return .recording(session: session, startTime: Date(), lapStartTime: Date())

        case (.pitsPause(var session, let pauseStart), .manualStop):
            // End session from pause
            session.totalTimeMs = Date().timeIntervalSince(pauseStart).milliseconds
            return .end(session: session)

        // MARK: End Transitions
        case (.end, .dismiss):
            return .disarmed

        // MARK: Invalid/Ignored Transitions
        default:
            // No state change for invalid or ignored events
            return currentState
        }
    }

    // MARK: - Helper Methods
    private func startRecording(for track: Track) -> SessionState {
        let now = Date()
        let session = Session(
            trackId: track.id,
            date: now
        )
        return .recording(session: session, startTime: now, lapStartTime: now)
    }
}

// MARK: - TimeInterval Extension
private extension TimeInterval {
    var milliseconds: Int {
        Int(self * 1000)
    }
}
