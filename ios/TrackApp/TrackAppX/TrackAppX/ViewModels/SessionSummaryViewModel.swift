//
//  SessionSummaryViewModel.swift
//  TrackApp
//
//  ViewModel for Session Summary screen
//

import Foundation
import Observation

@Observable
class SessionSummaryViewModel {
    // MARK: - State
    let session: Session
    let track: Track?
    var isUploading = false
    var uploadSuccess = false
    var errorMessage: String?

    // MARK: - Dependencies
    private let apiService: APIService
    private let persistence: PersistenceService

    // MARK: - Initialization
    init(
        session: Session,
        track: Track?,
        apiService: APIService = APIService(),
        persistence: PersistenceService = FileManagerPersistence()
    ) {
        self.session = session
        self.track = track
        self.apiService = apiService
        self.persistence = persistence
    }

    // MARK: - Computed Properties
    var lapsWithDeltas: [(lap: Lap, delta: String?)] {
        guard let bestLap = session.bestLap else {
            return session.laps.map { ($0, nil) }
        }

        return session.laps.map { lap in
            if lap.id == bestLap.id {
                return (lap, "Best")
            } else {
                return (lap, lap.formattedDelta(vs: bestLap))
            }
        }
    }

    // MARK: - Actions
    func uploadToServer(driverEmail: String) async {
        guard !isUploading else { return }

        isUploading = true
        errorMessage = nil
        uploadSuccess = false

        do {
            let response = try await apiService.importSession(session, driverEmail: driverEmail)
            uploadSuccess = true
            print("✅ Session uploaded: \(response.message)")
        } catch {
            errorMessage = "Upload failed: \(error.localizedDescription)"
        }

        isUploading = false
    }

    func saveLocal() {
        do {
            try persistence.saveSession(session)
        } catch {
            errorMessage = "Failed to save: \(error.localizedDescription)"
        }
    }
}
