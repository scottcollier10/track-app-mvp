//
//  LiveSessionViewModel.swift
//  TrackApp
//
//  ViewModel for Live Session screen
//

import Foundation
import Observation

@Observable
class LiveSessionViewModel {
    // MARK: - State
    let stateMachine: SessionStateMachine
    private(set) var currentLapTime: TimeInterval = 0
    private(set) var lastLapTime: TimeInterval?
    private(set) var sessionElapsedTime: TimeInterval = 0

    // Dev Mode
    var isDevModeEnabled = false
    var simulatedSpeed: Double = 0

    private var timer: Timer?
    private var lapTimer: Timer?
    private var sessionStartTime: Date?
    private var currentLapStartTime: Date?

    // MARK: - Dependencies
    private let persistence: PersistenceService

    // MARK: - Initialization
    init(
        stateMachine: SessionStateMachine = SessionStateMachine(),
        persistence: PersistenceService = FileManagerPersistence()
    ) {
        self.stateMachine = stateMachine
        self.persistence = persistence

        // Set up state machine callbacks
        stateMachine.onStateChange = { [weak self] oldState, newState in
            self?.handleStateChange(from: oldState, to: newState)
        }

        stateMachine.onLapCompleted = { [weak self] lap in
            self?.handleLapCompleted(lap)
        }
    }

    // MARK: - Timer Management
    private func startTimers() {
        sessionStartTime = Date()
        currentLapStartTime = Date()

        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateTimers()
        }
    }

    private func stopTimers() {
        timer?.invalidate()
        timer = nil
        lapTimer?.invalidate()
        lapTimer = nil
    }

    private func updateTimers() {
        if stateMachine.state.isRecording {
            if let sessionStart = sessionStartTime {
                sessionElapsedTime = Date().timeIntervalSince(sessionStart)
            }
            if let lapStart = currentLapStartTime {
                currentLapTime = Date().timeIntervalSince(lapStart)
            }
        }
    }

    // MARK: - State Change Handling
    private func handleStateChange(from oldState: SessionState, to newState: SessionState) {
        switch newState {
        case .recording:
            if !oldState.isRecording {
                startTimers()
            }
        case .pitsPause, .end:
            stopTimers()
        case .disarmed:
            reset()
        default:
            break
        }

        // Auto-save session on state changes
        if case .recording(let session, _, _) = newState {
            try? persistence.saveSession(session)
        } else if case .end(let session) = newState {
            try? persistence.saveSession(session)
        }
    }

    private func handleLapCompleted(_ lap: Lap) {
        lastLapTime = lap.lapTime
        currentLapStartTime = Date()
        currentLapTime = 0

        // Save session after each lap
        if case .recording(let session, _, _) = stateMachine.state {
            try? persistence.saveSession(session)
        }
    }

    private func reset() {
        currentLapTime = 0
        lastLapTime = nil
        sessionElapsedTime = 0
        sessionStartTime = nil
        currentLapStartTime = nil
    }

    // MARK: - Dev Mode Actions
    func toggleDevMode() {
        isDevModeEnabled.toggle()
    }

    func simulateCrossStartFinish() {
        stateMachine.handle(.crossStartFinish)
    }

    func simulateEnterPitLane() {
        stateMachine.handle(.enterPitLane)
    }

    func simulateExitPitLane() {
        stateMachine.handle(.exitPitLane)
    }

    func updateSimulatedSpeed(_ speed: Double) {
        simulatedSpeed = speed

        if speed >= Config.autoStartSpeedThreshold {
            stateMachine.handle(.speedAboveThreshold(mph: speed))
        } else if speed < Config.autoStopSpeedThreshold {
            stateMachine.handle(.speedBelowThreshold(mph: speed, duration: 31.0))
        }
    }

    // MARK: - Computed Properties
    var formattedCurrentLapTime: String {
        TimeFormatter.formatLapTime(seconds: currentLapTime)
    }

    var formattedLastLapTime: String? {
        guard let time = lastLapTime else { return nil }
        return TimeFormatter.formatLapTime(seconds: time)
    }

    var formattedSessionTime: String {
        TimeFormatter.formatDuration(seconds: sessionElapsedTime)
    }

    var bestLapTime: String? {
        guard case .recording(let session, _, _) = stateMachine.state,
              let bestMs = session.bestLapMs else {
            return nil
        }
        return TimeFormatter.formatLapTime(milliseconds: bestMs)
    }

    var lapCount: Int {
        guard let session = stateMachine.state.currentSession else {
            return 0
        }
        return session.lapCount
    }

    // MARK: - Cleanup
    deinit {
        stopTimers()
    }
}
