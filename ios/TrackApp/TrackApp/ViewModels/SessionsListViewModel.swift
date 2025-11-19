//
//  SessionsListViewModel.swift
//  TrackApp
//
//  ViewModel for Sessions List screen
//

import Foundation
import Observation

@Observable
class SessionsListViewModel {
    // MARK: - State
    private(set) var sessions: [Session] = []
    private(set) var tracks: [Track] = []
    var selectedTrackFilter: Track? = nil
    var sortOrder: SortOrder = .dateNewest
    var searchText: String = ""
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    // MARK: - Sort Options
    enum SortOrder: String, CaseIterable {
        case dateNewest = "Date (Newest)"
        case dateOldest = "Date (Oldest)"
        case trackName = "Track Name"
        case bestLap = "Best Lap"
    }

    // MARK: - Dependencies
    private let persistence: PersistenceService

    // MARK: - Initialization
    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    // MARK: - Actions
    func loadSessions() {
        isLoading = true
        errorMessage = nil

        do {
            sessions = try persistence.loadSessions()
            tracks = try persistence.loadTracks()
            isLoading = false
        } catch {
            errorMessage = "Failed to load sessions: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Computed Properties
    var filteredSessions: [Session] {
        var filtered = sessions

        // Filter by track if selected
        if let track = selectedTrackFilter {
            filtered = filtered.filter { $0.trackId == track.id }
        }

        // Filter by search text
        if !searchText.isEmpty {
            filtered = filtered.filter { session in
                let track = self.track(for: session)
                return track?.name.localizedCaseInsensitiveContains(searchText) ?? false
            }
        }

        // Sort
        return filtered.sorted(by: sortComparator)
    }

    private var sortComparator: (Session, Session) -> Bool {
        switch sortOrder {
        case .dateNewest:
            return { $0.date > $1.date }
        case .dateOldest:
            return { $0.date < $1.date }
        case .trackName:
            return { session1, session2 in
                let name1 = track(for: session1)?.name ?? ""
                let name2 = track(for: session2)?.name ?? ""
                return name1 < name2
            }
        case .bestLap:
            return { session1, session2 in
                let lap1 = session1.bestLapMs ?? Int.max
                let lap2 = session2.bestLapMs ?? Int.max
                return lap1 < lap2
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
            sessions.removeAll { $0.id == session.id }
        } catch {
            errorMessage = "Failed to delete session: \(error.localizedDescription)"
        }
    }
}
