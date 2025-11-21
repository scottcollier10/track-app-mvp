//
//  APIService.swift
//  TrackApp
//
//  Service for communicating with web API
//

import Foundation

class APIService {
    private let baseURL: String
    private let session: URLSession

    init(baseURL: String = Config.apiBaseURL) {
        self.baseURL = baseURL
        self.session = URLSession.shared
    }

    // MARK: - Tracks
    /// Fetch tracks from the web API
    func fetchTracks() async throws -> [Track] {
        guard let url = URL(string: Config.tracksAPIURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        let trackResponse = try decoder.decode(TracksAPIResponse.self, from: data)
        return trackResponse.tracks
    }

    // MARK: - Session Import
    /// Upload a session to the web dashboard
    func importSession(
        _ session: Session,
        driverEmail: String
    ) async throws -> ImportSessionResponse {
        let url = URL(string: "\(baseURL)/api/import-session")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = ImportSessionRequest(
            driverEmail: driverEmail,
            trackId: session.trackId,
            date: session.date,
            totalTimeMs: session.totalTimeMs,
            bestLapMs: session.bestLapMs,
            laps: session.laps.map { lap in
                LapPayload(
                    lapNumber: lap.lapNumber,
                    lapTimeMs: lap.lapTimeMs,
                    sectorData: lap.sectorData
                )
            }
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(ImportSessionResponse.self, from: data)
    }
}

// MARK: - Request/Response Models
struct TracksAPIResponse: Codable {
    let tracks: [Track]
}

struct ImportSessionRequest: Codable {
    let driverEmail: String
    let trackId: UUID
    let date: Date
    let totalTimeMs: Int
    let bestLapMs: Int?
    let laps: [LapPayload]
}

struct LapPayload: Codable {
    let lapNumber: Int
    let lapTimeMs: Int
    let sectorData: [String: Int]?
}

struct ImportSessionResponse: Codable {
    let sessionId: String
    let message: String
}

// MARK: - Errors
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "Server error: HTTP \(code)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
