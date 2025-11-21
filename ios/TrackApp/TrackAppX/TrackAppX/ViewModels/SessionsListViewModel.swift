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
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    var selectedTrackFilter: Track? = nil
    var sortOrder: SortOrder = .dateNewest
    var searchText: String = ""

    // MARK: - Sort Order
    enum SortOrder: String, CaseIterable, Identifiable {
        case dateNewest = "Date (Newest)"
        case dateOldest = "Date (Oldest)"
        case trackName = "Track Name"
        case bestLap = "Best Lap"

        var id: String { rawValue }
    }

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
                    self.sessions = allSessions.sorted { $0.date > $1.date }
                    self.isLoading = false
                }
            } catch {
                // If API fails, fall back to cached tracks
                do {
                    let cachedTracks = try persistence.loadTracks()
                    let allSessions = try persistence.loadSessions()

                    await MainActor.run {
                        self.tracks = cachedTracks
                        self.sessions = allSessions.sorted { $0.date > $1.date }
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

    /// Get filtered and sorted sessions
    var filteredSessions: [Session] {
        var filtered = sessions

        // Apply track filter
        if let track = selectedTrackFilter {
            filtered = filtered.filter { $0.trackId == track.id }
        }

        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { session in
                guard let track = track(for: session) else { return false }
                return track.name.localizedCaseInsensitiveContains(searchText) ||
                       track.location?.localizedCaseInsensitiveContains(searchText) == true
            }
        }

        // Apply sorting
        return filtered.sorted(by: sortComparator)
    }

    /// Sort comparator based on current sort order
    private var sortComparator: (Session, Session) -> Bool {
        switch sortOrder {
        case .dateNewest:
            return { $0.date > $1.date }
        case .dateOldest:
            return { $0.date < $1.date }
        case .trackName:
            return { [weak self] s1, s2 in
                guard let self = self else { return false }
                let t1 = self.track(for: s1)?.name ?? ""
                let t2 = self.track(for: s2)?.name ?? ""
                return t1 < t2
            }
        case .bestLap:
            return { s1, s2 in
                guard let b1 = s1.bestLapMs, let b2 = s2.bestLapMs else {
                    return s1.bestLapMs != nil
                }
                return b1 < b2
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
