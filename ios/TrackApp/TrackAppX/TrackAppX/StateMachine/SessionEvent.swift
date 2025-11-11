//
//  SessionEvent.swift
//  TrackApp
//
//  Events that trigger state machine transitions
//

import Foundation

enum SessionEvent {
    // MARK: - Manual Events
    /// User arms the session for a specific track
    case arm(track: Track)

    /// User manually starts recording
    case manualStart

    /// User manually stops recording
    case manualStop

    /// User manually pauses recording
    case manualPause

    /// User resumes from pause
    case resume

    /// User manually marks a lap
    case manualMarkLap

    /// User cancels armed state
    case cancel

    /// User dismisses end screen
    case dismiss

    // MARK: - Automatic Events (Dev Mode Simulatable)
    /// Speed exceeded threshold
    case speedAboveThreshold(mph: Double)

    /// Speed dropped below threshold for duration
    case speedBelowThreshold(mph: Double, duration: TimeInterval)

    /// Crossed start/finish line
    case crossStartFinish

    /// Entered pit lane
    case enterPitLane

    /// Exited pit lane
    case exitPitLane

    /// Entered track geofence
    case enterTrack

    // MARK: - Timer Events
    /// Periodic timer tick while recording (for updating elapsed time)
    case timerTick(elapsedMs: Int)
}

// MARK: - Description
extension SessionEvent {
    var description: String {
        switch self {
        case .arm(let track):
            return "Arm(\(track.name))"
        case .manualStart:
            return "ManualStart"
        case .manualStop:
            return "ManualStop"
        case .manualPause:
            return "ManualPause"
        case .resume:
            return "Resume"
        case .manualMarkLap:
            return "ManualMarkLap"
        case .cancel:
            return "Cancel"
        case .dismiss:
            return "Dismiss"
        case .speedAboveThreshold(let mph):
            return "SpeedAbove(\(mph) mph)"
        case .speedBelowThreshold(let mph, let duration):
            return "SpeedBelow(\(mph) mph for \(duration)s)"
        case .crossStartFinish:
            return "CrossStartFinish"
        case .enterPitLane:
            return "EnterPitLane"
        case .exitPitLane:
            return "ExitPitLane"
        case .enterTrack:
            return "EnterTrack"
        case .timerTick(let elapsedMs):
            return "TimerTick(\(elapsedMs)ms)"
        }
    }
}
