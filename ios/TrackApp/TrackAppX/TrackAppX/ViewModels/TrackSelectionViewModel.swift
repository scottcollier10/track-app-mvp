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

        // Try to fetch from API first, then fall back to local cache
        Task {
            do {
                // Fetch tracks from web API
                let apiTracks = try await apiService.fetchTracks()

                // Cache tracks locally for offline use
                try persistence.saveTracks(apiTracks)

                // Update UI on main thread
                await MainActor.run {
                    self.tracks = apiTracks
                    self.isLoading = false
                }
            } catch {
                // If API fails, try to load from local cache
                print("⚠️ Failed to fetch tracks from API: \(error.localizedDescription)")
                print("📁 Falling back to local cache...")

                do {
                    let cachedTracks = try persistence.loadTracks()
                    await MainActor.run {
                        self.tracks = cachedTracks
                        self.isLoading = false
                        // Show a subtle warning that we're using cached data
                        if cachedTracks.isEmpty {
                            self.errorMessage = "No tracks available. Please check your connection."
                        }
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
