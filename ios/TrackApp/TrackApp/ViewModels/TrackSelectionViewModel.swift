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

    // MARK: - Initialization
    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
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

        do {
            tracks = try persistence.loadTracks()
        } catch {
            errorMessage = "Failed to load tracks: \(error.localizedDescription)"
        }

        isLoading = false
    }
}
