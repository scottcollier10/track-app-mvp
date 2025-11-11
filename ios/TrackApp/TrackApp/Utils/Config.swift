//
//  Config.swift
//  TrackApp
//
//  App-wide configuration constants
//

import Foundation

struct Config {
    // MARK: - API
    /// Base URL for web API (change for production)
    static let apiBaseURL = "http://localhost:3000"

    // MARK: - Session State Machine
    /// Speed threshold (mph) to auto-start recording
    static let autoStartSpeedThreshold = 15.0

    /// Speed threshold (mph) to auto-stop/pause recording
    static let autoStopSpeedThreshold = 10.0

    /// Duration (seconds) below stop threshold before auto-pausing
    static let lowSpeedDuration = 30.0

    // MARK: - Persistence
    /// Directory name for app data in Documents
    static let appDirectoryName = "TrackApp"

    /// Filename for tracks list
    static let tracksFilename = "tracks.json"

    /// Directory name for sessions
    static let sessionsDirectoryName = "sessions"

    // MARK: - UI
    /// Number of recent sessions to show on home screen
    static let recentSessionsLimit = 10

    /// Dev mode activation gesture (number of taps)
    static let devModeActivationTaps = 3
}
