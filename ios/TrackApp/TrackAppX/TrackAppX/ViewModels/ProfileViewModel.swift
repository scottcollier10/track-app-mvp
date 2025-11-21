//
//  ProfileViewModel.swift
//  TrackApp
//
//  ViewModel for the profile view showing driver statistics
//

import Foundation

@Observable
class ProfileViewModel {
    var sessions: [Session] = []
    var tracks: [Track] = []
    var errorMessage: String?

    private let persistence: PersistenceService

    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    /// Load all sessions and tracks
    func loadData() {
        do {
            sessions = try persistence.loadSessions()
            tracks = try persistence.loadTracks()
            errorMessage = nil
        } catch {
            errorMessage = "Failed to load data: \(error.localizedDescription)"
            print("⚠️ Error loading data: \(error)")
        }
    }

    // MARK: - Statistics

    /// Total number of sessions
    var totalSessions: Int {
        sessions.count
    }

    /// Total number of laps across all sessions
    var totalLaps: Int {
        sessions.reduce(0) { $0 + $1.lapCount }
    }

    /// Best lap time across all sessions
    var allTimeBestLap: (time: String, track: String)? {
        guard !sessions.isEmpty else { return nil }

        var bestSession: Session?
        var bestTime = Int.max

        for session in sessions {
            if let lapTime = session.bestLapMs, lapTime < bestTime {
                bestTime = lapTime
                bestSession = session
            }
        }

        guard let session = bestSession,
              let lapMs = session.bestLapMs,
              let track = track(for: session) else {
            return nil
        }

        return (TimeFormatter.formatLapTime(milliseconds: lapMs), track.name)
    }

    /// Most frequently visited track
    var favoriteTrack: String? {
        guard !sessions.isEmpty else { return nil }

        // Count sessions per track
        var trackCounts: [UUID: Int] = [:]
        for session in sessions {
            trackCounts[session.trackId, default: 0] += 1
        }

        // Find track with most sessions
        guard let favoriteTrackId = trackCounts.max(by: { $0.value < $1.value })?.key else {
            return nil
        }

        return tracks.first { $0.id == favoriteTrackId }?.name
    }

    /// Recent 5 sessions
    var recentSessions: [Session] {
        Array(sessions.prefix(5))
    }

    /// Get track for a session
    func track(for session: Session) -> Track? {
        tracks.first { $0.id == session.trackId }
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    /// Check if there's any data
    var hasData: Bool {
        !sessions.isEmpty
    }
}
