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
        Task {
            isLoading = true
            errorMessage = nil

            do {
                // Try to fetch tracks from API first
                let apiTracks = try await apiService.fetchTracks()

                // Load local tracks for fallback
                let localTracks = try persistence.loadTracks()

                // Deduplicate: API tracks take precedence over local tracks
                // Create a dictionary keyed by ID, API tracks will override local ones
                var tracksById: [UUID: Track] = [:]

                // First add local tracks
                for track in localTracks {
                    tracksById[track.id] = track
                }

                // Then add/override with API tracks (these take precedence)
                for track in apiTracks {
                    tracksById[track.id] = track
                }

                // Convert back to array and sort by name
                tracks = Array(tracksById.values).sorted { $0.name < $1.name }

                // Save the deduplicated list to persistence
                try persistence.saveTracks(tracks)

            } catch {
                // If API fetch fails, try to load from local persistence
                do {
                    let localTracks = try persistence.loadTracks()

                    // Deduplicate local tracks by ID (in case there are duplicates)
                    var tracksById: [UUID: Track] = [:]
                    for track in localTracks {
                        tracksById[track.id] = track
                    }

                    tracks = Array(tracksById.values).sorted { $0.name < $1.name }

                } catch {
                    errorMessage = "Failed to load tracks: \(error.localizedDescription)"
                    tracks = []
                }
            }

            isLoading = false
        }
    }
}
