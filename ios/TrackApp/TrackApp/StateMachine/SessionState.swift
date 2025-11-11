//
//  SessionState.swift
//  TrackApp
//
//  Represents the possible states of a track session
//

import Foundation

enum SessionState: Equatable {
    case disarmed
    case armed(track: Track)
    case recording(session: Session, startTime: Date, lapStartTime: Date)
    case pitsPause(session: Session, pauseStartTime: Date)
    case end(session: Session)

    /// Human-readable state name
    var name: String {
        switch self {
        case .disarmed:
            return "Disarmed"
        case .armed:
            return "Armed"
        case .recording:
            return "Recording"
        case .pitsPause:
            return "Paused"
        case .end:
            return "Ended"
        }
    }

    /// Detailed description for UI
    var description: String {
        switch self {
        case .disarmed:
            return "Not recording"
        case .armed(let track):
            return "Ready at \(track.name)"
        case .recording(let session, _, _):
            return "Recording - \(session.lapCount) laps"
        case .pitsPause(let session, _):
            return "Paused - \(session.lapCount) laps"
        case .end(let session):
            return "Completed - \(session.lapCount) laps"
        }
    }

    /// Whether this state is actively recording
    var isRecording: Bool {
        if case .recording = self {
            return true
        }
        return false
    }

    /// Whether this state is paused
    var isPaused: Bool {
        if case .pitsPause = self {
            return true
        }
        return false
    }

    /// Whether this state is armed
    var isArmed: Bool {
        if case .armed = self {
            return true
        }
        return false
    }

    /// Get the current session if in recording, paused, or ended state
    var currentSession: Session? {
        switch self {
        case .recording(let session, _, _),
             .pitsPause(let session, _),
             .end(let session):
            return session
        case .disarmed, .armed:
            return nil
        }
    }

    /// Get the track for armed or active session
    var currentTrack: Track? {
        switch self {
        case .armed(let track):
            return track
        case .recording(let session, _, _),
             .pitsPause(let session, _),
             .end(let session):
            // Note: In a real implementation, we'd need to look up the track
            // For now, this returns nil - ViewModels should handle track lookup
            return nil
        case .disarmed:
            return nil
        }
    }
}

// MARK: - Equatable
extension SessionState {
    static func == (lhs: SessionState, rhs: SessionState) -> Bool {
        switch (lhs, rhs) {
        case (.disarmed, .disarmed):
            return true
        case (.armed(let t1), .armed(let t2)):
            return t1.id == t2.id
        case (.recording(let s1, let st1, let lt1), .recording(let s2, let st2, let lt2)):
            return s1.id == s2.id && st1 == st2 && lt1 == lt2
        case (.pitsPause(let s1, let p1), .pitsPause(let s2, let p2)):
            return s1.id == s2.id && p1 == p2
        case (.end(let s1), .end(let s2)):
            return s1.id == s2.id
        default:
            return false
        }
    }
}
