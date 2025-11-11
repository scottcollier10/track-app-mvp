//
//  Track.swift
//  TrackApp
//
//  Represents a racing circuit/track
//

import Foundation

struct Track: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let location: String?
    let lengthMeters: Int?
    let config: String?

    init(
        id: UUID = UUID(),
        name: String,
        location: String? = nil,
        lengthMeters: Int? = nil,
        config: String? = nil
    ) {
        self.id = id
        self.name = name
        self.location = location
        self.lengthMeters = lengthMeters
        self.config = config
    }

    /// Full display name including configuration
    var displayName: String {
        if let config = config {
            return "\(name) - \(config)"
        }
        return name
    }

    /// Track length in miles (converted from meters)
    var lengthMiles: Double? {
        guard let meters = lengthMeters else { return nil }
        return Double(meters) * 0.000621371
    }
}

// MARK: - Sample Data
extension Track {
    static let samples = [
        Track(
            id: UUID(uuidString: "550e8400-e29b-41d4-a716-446655440001")!,
            name: "Laguna Seca",
            location: "Monterey, CA",
            lengthMeters: 3602,
            config: "Full"
        ),
        Track(
            id: UUID(uuidString: "550e8400-e29b-41d4-a716-446655440002")!,
            name: "Thunderhill",
            location: "Willows, CA",
            lengthMeters: 4830,
            config: "5-Mile"
        ),
        Track(
            id: UUID(uuidString: "550e8400-e29b-41d4-a716-446655440003")!,
            name: "Buttonwillow",
            location: "Buttonwillow, CA",
            lengthMeters: 2016,
            config: "Configuration #13"
        ),
        Track(
            id: UUID(uuidString: "550e8400-e29b-41d4-a716-446655440004")!,
            name: "Sonoma Raceway",
            location: "Sonoma, CA",
            lengthMeters: 4023,
            config: "Full"
        )
    ]

    static let preview = samples[0]
}
