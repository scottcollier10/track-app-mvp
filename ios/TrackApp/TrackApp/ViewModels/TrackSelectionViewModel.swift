//
//  TrackSelectionViewModel.swift
//  TrackApp
//
//  ViewModel for Track Selection screen
//

import Foundation
import Observation

@Observable
class TrackSelectionViewModel {
    // MARK: - State
    private(set) var tracks: [Track] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    var searchText = ""

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
    var filteredTracks: [Track] {
        if searchText.isEmpty {
            return tracks
        }
        return tracks.filter { track in
            track.name.localizedCaseInsensitiveContains(searchText) ||
            (track.location?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    // MARK: - Actions
    func loadTracks() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                // Try to fetch tracks from the API first
                let fetchedTracks = try await apiService.fetchTracks()

                // Cache the tracks locally for offline use
                try? persistence.saveTracks(fetchedTracks)

                // Update UI on main thread
                await MainActor.run {
                    self.tracks = fetchedTracks
                    self.isLoading = false
                }
            } catch {
                // If API fails, fall back to cached tracks
                do {
                    let cachedTracks = try persistence.loadTracks()
                    await MainActor.run {
                        self.tracks = cachedTracks
                        self.isLoading = false
                        self.errorMessage = "Using cached tracks (offline mode)"
                    }
                } catch {
                    await MainActor.run {
                        self.errorMessage = "Failed to load tracks: \(error.localizedDescription)"
                        self.isLoading = false
                    }
                }
            }
        }
    }
}
