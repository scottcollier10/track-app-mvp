//
//  FileManagerPersistence.swift
//  TrackApp
//
//  FileManager-based persistence implementation using JSON
//

import Foundation

class FileManagerPersistence: PersistenceService {
    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: - Directories
    private var appDirectory: URL {
        get throws {
            let documentsDirectory = try fileManager.url(
                for: .documentDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            return documentsDirectory.appendingPathComponent(Config.appDirectoryName)
        }
    }

    private var sessionsDirectory: URL {
        get throws {
            try appDirectory.appendingPathComponent(Config.sessionsDirectoryName)
        }
    }

    // MARK: - Initialization
    init() {
        encoder.outputFormatting = .prettyPrinted
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601

        // Create directories if needed
        try? createDirectoriesIfNeeded()
    }

    private func createDirectoriesIfNeeded() throws {
        let appDir = try appDirectory
        let sessionsDir = try sessionsDirectory

        for directory in [appDir, sessionsDir] {
            if !fileManager.fileExists(atPath: directory.path) {
                try fileManager.createDirectory(
                    at: directory,
                    withIntermediateDirectories: true,
                    attributes: nil
                )
            }
        }
    }

    // MARK: - Tracks
    func saveTracks(_ tracks: [Track]) throws {
        let fileURL = try appDirectory.appendingPathComponent(Config.tracksFilename)
        let data = try encoder.encode(tracks)
        try data.write(to: fileURL, options: .atomic)
    }

    func loadTracks() throws -> [Track] {
        let fileURL = try appDirectory.appendingPathComponent(Config.tracksFilename)

        guard fileManager.fileExists(atPath: fileURL.path) else {
            // If file doesn't exist, return empty array
            // The view model will fetch from API
            return []
        }

        let data = try Data(contentsOf: fileURL)
        return try decoder.decode([Track].self, from: data)
    }

    func clearTracksCache() throws {
        let fileURL = try appDirectory.appendingPathComponent(Config.tracksFilename)
        if fileManager.fileExists(atPath: fileURL.path) {
            try fileManager.removeItem(at: fileURL)
        }
    }

    // MARK: - Sessions
    func saveSession(_ session: Session) throws {
        let fileURL = try sessionFileURL(for: session.id)
        let data = try encoder.encode(session)
        try data.write(to: fileURL, options: .atomic)
    }

    func loadSessions() throws -> [Session] {
        let directory = try sessionsDirectory
        let fileURLs = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.creationDateKey],
            options: .skipsHiddenFiles
        )

        let sessions = try fileURLs.compactMap { url -> Session? in
            guard url.pathExtension == "json" else { return nil }
            let data = try Data(contentsOf: url)
            return try decoder.decode(Session.self, from: data)
        }

        // Sort by date descending (most recent first)
        return sessions.sorted { $0.date > $1.date }
    }

    func loadSession(id: UUID) throws -> Session? {
        let fileURL = try sessionFileURL(for: id)

        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        let data = try Data(contentsOf: fileURL)
        return try decoder.decode(Session.self, from: data)
    }

    func deleteSession(id: UUID) throws {
        let fileURL = try sessionFileURL(for: id)

        guard fileManager.fileExists(atPath: fileURL.path) else {
            throw PersistenceError.fileNotFound
        }

        try fileManager.removeItem(at: fileURL)
    }

    func saveSessions(_ sessions: [Session]) throws {
        for session in sessions {
            try saveSession(session)
        }
    }

    // MARK: - Helpers
    private func sessionFileURL(for id: UUID) throws -> URL {
        try sessionsDirectory.appendingPathComponent("\(id.uuidString).json")
    }
}

// MARK: - Debug Helpers
extension FileManagerPersistence {
    /// Print the path to the app directory for debugging
    func printAppDirectoryPath() {
        if let path = try? appDirectory.path {
            print("📁 TrackApp data directory: \(path)")
        }
    }

    /// Clear all data (useful for testing)
    func clearAllData() throws {
        let appDir = try appDirectory
        if fileManager.fileExists(atPath: appDir.path) {
            try fileManager.removeItem(at: appDir)
        }
        try createDirectoriesIfNeeded()
    }
}
