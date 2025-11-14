//
//  HomeViewModel.swift
//  TrackApp
//
//  ViewModel for Home screen
//

import Foundation
import Observation

@Observable
class HomeViewModel {
    // MARK: - State
    private(set) var tracks: [Track] = []
    private(set) var recentSessions: [Session] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

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
                    self.recentSessions = Array(allSessions.prefix(Config.recentSessionsLimit))
                    self.isLoading = false
                }
            } catch {
                // If API fails, fall back to cached tracks
                do {
                    let cachedTracks = try persistence.loadTracks()
                    let allSessions = try persistence.loadSessions()

                    await MainActor.run {
                        self.tracks = cachedTracks
                        self.recentSessions = Array(allSessions.prefix(Config.recentSessionsLimit))
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

    /// Delete a session
    func deleteSession(_ session: Session) {
        do {
            try persistence.deleteSession(id: session.id)
            recentSessions.removeAll { $0.id == session.id }
        } catch {
            errorMessage = "Failed to delete session: \(error.localizedDescription)"
        }
    }
}
