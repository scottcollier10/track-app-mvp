//
//  SessionsListViewModel.swift
//  TrackApp
//
//  ViewModel for the sessions list view
//

import Foundation

@Observable
class SessionsListViewModel {
    var sessions: [Session] = []
    var tracks: [Track] = []
    var errorMessage: String?

    // Sorting and filtering
    var sortOption: SortOption = .dateNewest
    var selectedTrackFilter: UUID?

    enum SortOption: String, CaseIterable {
        case dateNewest = "Date (Newest)"
        case dateOldest = "Date (Oldest)"
        case trackName = "Track Name"
        case bestLap = "Best Lap"

        var id: String { rawValue }
    }

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
            errorMessage = "Failed to load sessions: \(error.localizedDescription)"
            print("⚠️ Error loading data: \(error)")
        }
    }

    /// Get filtered and sorted sessions
    var filteredSessions: [Session] {
        var result = sessions

        // Apply track filter
        if let trackId = selectedTrackFilter {
            result = result.filter { $0.trackId == trackId }
        }

        // Apply sorting
        switch sortOption {
        case .dateNewest:
            result.sort { $0.date > $1.date }
        case .dateOldest:
            result.sort { $0.date < $1.date }
        case .trackName:
            result.sort { session1, session2 in
                let track1 = track(for: session1)?.name ?? ""
                let track2 = track(for: session2)?.name ?? ""
                return track1 < track2
            }
        case .bestLap:
            result.sort { session1, session2 in
                guard let lap1 = session1.bestLapMs, let lap2 = session2.bestLapMs else {
                    return session1.bestLapMs != nil
                }
                return lap1 < lap2
            }
        }

        return result
    }

    /// Get track for a session
    func track(for session: Session) -> Track? {
        tracks.first { $0.id == session.trackId }
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }
}
