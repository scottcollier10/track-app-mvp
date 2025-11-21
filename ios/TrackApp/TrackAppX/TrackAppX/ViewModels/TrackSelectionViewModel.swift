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
            // Try to fetch tracks from API first
            do {
                let apiTracks = try await apiService.fetchTracks()

                // If API fetch succeeds, clear old cache and save fresh tracks
                try? persistence.clearTracksCache()
                try? persistence.saveTracks(apiTracks)

                await MainActor.run {
                    tracks = apiTracks
                    isLoading = false
                }
            } catch {
                // If API fails, fall back to local cached tracks
                print("⚠️ API fetch failed, using local tracks: \(error.localizedDescription)")

                do {
                    let localTracks = try persistence.loadTracks()
                    await MainActor.run {
                        tracks = localTracks
                        isLoading = false
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = "Failed to load tracks: \(error.localizedDescription)"
                        isLoading = false
                    }
                }
            }
        }
    }
}
