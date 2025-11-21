//
//  ProfileViewModel.swift
//  TrackApp
//
//  ViewModel for Profile screen
//

import Foundation
import Observation

@Observable
class ProfileViewModel {
    // MARK: - State
    private(set) var sessions: [Session] = []
    private(set) var tracks: [Track] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private(set) var driverEmail: String?

    // MARK: - Dependencies
    private let persistence: PersistenceService
    private let apiService: APIService

    // MARK: - Initialization
    init(
        persistence: PersistenceService = FileManagerPersistence(),
        apiService: APIService = APIService()
    ) {
        self.persistence = persistence
        self.apiService = apiService
    }

    // MARK: - Computed Properties
    var totalSessions: Int {
        sessions.count
    }

    var totalLaps: Int {
        sessions.reduce(0) { $0 + $1.lapCount }
    }

    var allTimeBestLap: (time: String, track: String)? {
        // Find the best lap across all sessions
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

        guard let lapMs = bestLapMs,
              let session = bestSession,
              let track = track(for: session) else {
            return nil
        }

        let time = TimeFormatter.formatLapTime(milliseconds: lapMs)
        return (time: time, track: track.displayName)
    }

    var favoriteTrack: Track? {
        // Find the track with most sessions
        guard !sessions.isEmpty else { return nil }

        var trackCounts: [UUID: Int] = [:]
        for session in sessions {
            trackCounts[session.trackId, default: 0] += 1
        }

        guard let mostVisitedTrackId = trackCounts.max(by: { $0.value < $1.value })?.key else {
            return nil
        }

        return tracks.first { $0.id == mostVisitedTrackId }
    }

    var recentSessions: [Session] {
        Array(sessions.sorted { $0.date > $1.date }.prefix(5))
    }

    // MARK: - Actions
    func loadData() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                // Try to fetch tracks from API
                let fetchedTracks = try await apiService.fetchTracks()

                // Cache tracks locally
                try? persistence.saveTracks(fetchedTracks)

                // Load sessions from local storage
                let allSessions = try persistence.loadSessions()

                // Update UI on main thread
                await MainActor.run {
                    self.tracks = fetchedTracks
                    self.sessions = allSessions
                    self.isLoading = false
                }
            } catch {
                // If API fails, fall back to cached tracks
                do {
                    let cachedTracks = try persistence.loadTracks()
                    let allSessions = try persistence.loadSessions()

                    await MainActor.run {
                        self.tracks = cachedTracks
                        self.sessions = allSessions
                        self.isLoading = false
                    }
                } catch {
                    await MainActor.run {
                        self.errorMessage = "Failed to load data: \(error.localizedDescription)"
                        self.isLoading = false
                    }
                }
            }
        }
    }

    /// Get track for a given session
    func track(for session: Session) -> Track? {
        tracks.first { $0.id == session.trackId }
    }
}
