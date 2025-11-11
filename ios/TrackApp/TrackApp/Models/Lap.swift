//
//  Lap.swift
//  TrackApp
//
//  Represents a single lap within a session
//

import Foundation

struct Lap: Codable, Identifiable, Hashable {
    let id: UUID
    let lapNumber: Int
    let lapTimeMs: Int
    let sectorData: [String: Int]?

    init(
        id: UUID = UUID(),
        lapNumber: Int,
        lapTimeMs: Int,
        sectorData: [String: Int]? = nil
    ) {
        self.id = id
        self.lapNumber = lapNumber
        self.lapTimeMs = lapTimeMs
        self.sectorData = sectorData
    }

    /// Lap time as TimeInterval (seconds)
    var lapTime: TimeInterval {
        Double(lapTimeMs) / 1000.0
    }

    /// Formatted lap time (e.g., "1:32.500")
    var formattedTime: String {
        TimeFormatter.formatLapTime(milliseconds: lapTimeMs)
    }

    /// Delta vs a reference lap in milliseconds (positive = slower)
    func delta(vs referenceLap: Lap) -> Int {
        lapTimeMs - referenceLap.lapTimeMs
    }

    /// Formatted delta string (e.g., "+0.350", "-1.200")
    func formattedDelta(vs referenceLap: Lap) -> String {
        let deltaMs = delta(vs: referenceLap)
        let deltaSeconds = Double(deltaMs) / 1000.0
        let sign = deltaMs >= 0 ? "+" : ""
        return String(format: "%@%.3f", sign, deltaSeconds)
    }
}

// MARK: - Sample Data
extension Lap {
    static let samples = [
        Lap(lapNumber: 1, lapTimeMs: 95_000),
        Lap(lapNumber: 2, lapTimeMs: 92_500),
        Lap(lapNumber: 3, lapTimeMs: 93_200),
        Lap(lapNumber: 4, lapTimeMs: 94_100),
        Lap(lapNumber: 5, lapTimeMs: 91_800)
    ]

    static let preview = samples[1]
}
