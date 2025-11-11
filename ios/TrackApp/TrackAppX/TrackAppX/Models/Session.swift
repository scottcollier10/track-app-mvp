//
//  Session.swift
//  TrackApp
//
//  Represents a driving session at a track
//

import Foundation

struct Session: Codable, Identifiable, Hashable {
    let id: UUID
    let trackId: UUID
    let date: Date
    var totalTimeMs: Int
    var bestLapMs: Int?
    var laps: [Lap]

    init(
        id: UUID = UUID(),
        trackId: UUID,
        date: Date = Date(),
        totalTimeMs: Int = 0,
        bestLapMs: Int? = nil,
        laps: [Lap] = []
    ) {
        self.id = id
        self.trackId = trackId
        self.date = date
        self.totalTimeMs = totalTimeMs
        self.bestLapMs = bestLapMs
        self.laps = laps
    }

    /// Total session time as TimeInterval (seconds)
    var totalTime: TimeInterval {
        Double(totalTimeMs) / 1000.0
    }

    /// Formatted total time (e.g., "20:00")
    var formattedTotalTime: String {
        TimeFormatter.formatDuration(milliseconds: totalTimeMs)
    }

    /// Best lap time as TimeInterval (seconds)
    var bestLapTime: TimeInterval? {
        guard let ms = bestLapMs else { return nil }
        return Double(ms) / 1000.0
    }

    /// Formatted best lap (e.g., "1:32.500")
    var formattedBestLap: String? {
        guard let ms = bestLapMs else { return nil }
        return TimeFormatter.formatLapTime(milliseconds: ms)
    }

    /// Number of complete laps
    var lapCount: Int {
        laps.count
    }

    /// Add a new lap and update best lap if needed
    mutating func addLap(_ lap: Lap) {
        laps.append(lap)

        // Update best lap
        if let currentBest = bestLapMs {
            if lap.lapTimeMs < currentBest {
                bestLapMs = lap.lapTimeMs
            }
        } else {
            bestLapMs = lap.lapTimeMs
        }
    }

    /// Get the best lap object
    var bestLap: Lap? {
        guard let bestMs = bestLapMs else { return nil }
        return laps.first { $0.lapTimeMs == bestMs }
    }

    /// Average lap time in milliseconds (excluding outliers)
    var averageLapMs: Int? {
        guard !laps.isEmpty else { return nil }
        let total = laps.reduce(0) { $0 + $1.lapTimeMs }
        return total / laps.count
    }

    /// Formatted average lap time
    var formattedAverageLap: String? {
        guard let avgMs = averageLapMs else { return nil }
        return TimeFormatter.formatLapTime(milliseconds: avgMs)
    }
}

// MARK: - Sample Data
extension Session {
    static let sample = Session(
        id: UUID(uuidString: "750e8400-e29b-41d4-a716-446655440001")!,
        trackId: Track.samples[0].id,
        date: Date().addingTimeInterval(-3600),
        totalTimeMs: 1_200_000,
        bestLapMs: 91_800,
        laps: Lap.samples
    )

    static let preview = sample
}
