//
//  ProfileViewModel.swift
//  TrackApp
//
//  ViewModel for Profile screen showing driver statistics
//

import Foundation
import Observation

@Observable
class ProfileViewModel {
    // MARK: - State
    private(set) var sessions: [Session] = []
    private(set) var tracks: [Track] = []
    var driverEmail: String?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    // MARK: - Dependencies
    private let persistence: PersistenceService

    // MARK: - Initialization
    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    // MARK: - Actions
    func loadData() {
        isLoading = true
        errorMessage = nil

        do {
            sessions = try persistence.loadSessions()
            tracks = try persistence.loadTracks()
            isLoading = false
        } catch {
            errorMessage = "Failed to load data: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Computed Statistics
    var totalSessions: Int {
        sessions.count
    }

    var totalLaps: Int {
        sessions.reduce(0) { $0 + $1.lapCount }
    }

    var allTimeBestLap: (time: String, track: String)? {
        var bestLapMs: Int?
        var bestSession: Session?

        for session in sessions {
            if let sessionBest = session.bestLapMs {
                if bestLapMs == nil || sessionBest < bestLapMs! {
                    bestLapMs = sessionBest
                    bestSession = session
                }
            }
        }

        guard let ms = bestLapMs, let session = bestSession else { return nil }
        let trackName = track(for: session)?.name ?? "Unknown Track"
        return (TimeFormatter.formatLapTime(milliseconds: ms), trackName)
    }

    var favoriteTrack: Track? {
        // Count sessions per track
        var trackCounts: [UUID: Int] = [:]
        for session in sessions {
            trackCounts[session.trackId, default: 0] += 1
        }

        // Find track with most sessions
        guard let mostVisitedId = trackCounts.max(by: { $0.value < $1.value })?.key else {
            return nil
        }

        return tracks.first { $0.id == mostVisitedId }
    }

    var favoriteTrackSessionCount: Int {
        guard let track = favoriteTrack else { return 0 }
        return sessions.filter { $0.trackId == track.id }.count
    }

    var recentSessions: [Session] {
        Array(sessions.sorted { $0.date > $1.date }.prefix(5))
    }

    /// Get track for a given session
    func track(for session: Session) -> Track? {
        tracks.first { $0.id == session.trackId }
    }
}
