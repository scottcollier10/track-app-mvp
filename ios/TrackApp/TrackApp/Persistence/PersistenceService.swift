//
//  PersistenceService.swift
//  TrackApp
//
//  Protocol for local data persistence
//  Abstraction allows swapping implementations (FileManager → CoreData → Sync)
//

import Foundation

protocol PersistenceService {
    // MARK: - Tracks
    func saveTracks(_ tracks: [Track]) throws
    func loadTracks() throws -> [Track]

    // MARK: - Sessions
    func saveSession(_ session: Session) throws
    func loadSessions() throws -> [Session]
    func loadSession(id: UUID) throws -> Session?
    func deleteSession(id: UUID) throws

    // MARK: - Batch Operations
    func saveSessions(_ sessions: [Session]) throws
}

enum PersistenceError: LocalizedError {
    case directoryCreationFailed
    case encodingFailed
    case decodingFailed
    case fileNotFound
    case deleteFailedcase unknown(Error)

    var errorDescription: String? {
        switch self {
        case .directoryCreationFailed:
            return "Failed to create app directory"
        case .encodingFailed:
            return "Failed to encode data to JSON"
        case .decodingFailed:
            return "Failed to decode data from JSON"
        case .fileNotFound:
            return "File not found"
        case .deleteFailed:
            return "Failed to delete file"
        case .unknown(let error):
            return "Unknown error: \(error.localizedDescription)"
        }
    }
}
