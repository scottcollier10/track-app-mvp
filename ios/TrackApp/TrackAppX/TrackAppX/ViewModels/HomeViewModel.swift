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

    // MARK: - Initialization
    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    // MARK: - Actions
    func loadData() {
        isLoading = true
        errorMessage = nil

        do {
            tracks = try persistence.loadTracks()
            let allSessions = try persistence.loadSessions()
            recentSessions = Array(allSessions.prefix(Config.recentSessionsLimit))
        } catch {
            errorMessage = "Failed to load data: \(error.localizedDescription)"
        }

        isLoading = false
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
