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
                // STRATEGY: ONLY use API as primary source
                print("🏁 Fetching tracks from API...")
                let apiTracks = try await apiService.fetchTracks()
                print("🏁 Received \(apiTracks.count) tracks from API")

                // Aggressive deduplication
                let deduplicatedTracks = deduplicateTracks(apiTracks)
                print("🏁 After deduplication: \(deduplicatedTracks.count) unique tracks")

                tracks = deduplicatedTracks.sorted { $0.name < $1.name }

                // Save the deduplicated list to persistence
                try persistence.saveTracks(tracks)

            } catch {
                // If API fetch fails, try to load from local persistence
                print("⚠️ API fetch failed: \(error.localizedDescription)")
                print("🏁 Falling back to local tracks...")

                do {
                    let localTracks = try persistence.loadTracks()
                    print("🏁 Loaded \(localTracks.count) local tracks")

                    // Deduplicate local tracks as well
                    let deduplicatedTracks = deduplicateTracks(localTracks)
                    print("🏁 After deduplication: \(deduplicatedTracks.count) unique tracks")

                    tracks = deduplicatedTracks.sorted { $0.name < $1.name }

                } catch {
                    print("❌ Failed to load local tracks: \(error.localizedDescription)")
                    errorMessage = "Failed to load tracks: \(error.localizedDescription)"
                    tracks = []
                }
            }

            isLoading = false
        }
    }

    // MARK: - Deduplication
    /// Aggressively deduplicate tracks by ID and fuzzy name matching
    private func deduplicateTracks(_ tracks: [Track]) -> [Track] {
        var uniqueTracks: [UUID: Track] = [:]
        var seenNames: [String: Track] = [:]

        for track in tracks {
            // 1. First check if we've seen this exact ID
            if uniqueTracks[track.id] != nil {
                print("🔍 Skipping duplicate ID: \(track.name) (\(track.id))")
                continue
            }

            // 2. Normalize the name for fuzzy matching
            let normalizedName = normalizeTrackName(track.name)

            // 3. Check if we've seen a similar name
            if let existingTrack = seenNames[normalizedName] {
                print("🔍 Skipping duplicate name: '\(track.name)' matches '\(existingTrack.name)' (normalized: '\(normalizedName)')")
                // Keep the one with more info (longer name usually means more specific)
                if track.name.count > existingTrack.name.count {
                    // Replace with the more detailed version
                    uniqueTracks.removeValue(forKey: existingTrack.id)
                    uniqueTracks[track.id] = track
                    seenNames[normalizedName] = track
                    print("  ↳ Replaced with more detailed version")
                }
                continue
            }

            // 4. This is a unique track, add it
            uniqueTracks[track.id] = track
            seenNames[normalizedName] = track
        }

        return Array(uniqueTracks.values)
    }

    /// Normalize track name for fuzzy matching
    /// Examples:
    ///   "Buttonwillow Raceway Park" -> "buttonwillow"
    ///   "Buttonwillow - Config 13" -> "buttonwillow"
    ///   "Laguna Seca Raceway" -> "lagunaseca"
    private func normalizeTrackName(_ name: String) -> String {
        let lowercase = name.lowercased()

        // Remove common suffixes and words
        let wordsToRemove = [
            "raceway", "park", "circuit", "speedway", "motorsports",
            "international", "track", "the", "racing"
        ]

        var normalized = lowercase

        // Remove everything after " - " (configuration)
        if let dashIndex = normalized.firstIndex(of: "-") {
            normalized = String(normalized[..<dashIndex])
        }

        // Remove common track words
        for word in wordsToRemove {
            normalized = normalized.replacingOccurrences(of: word, with: "")
        }

        // Remove all non-alphanumeric characters and whitespace
        normalized = normalized.components(separatedBy: CharacterSet.alphanumerics.inverted).joined()

        return normalized.trimmingCharacters(in: .whitespaces)
    }
}
