//
//  TimeFormatter.swift
//  TrackApp
//
//  Utilities for formatting time values
//

import Foundation

enum TimeFormatter {
    /// Format lap time from milliseconds to "M:SS.mmm" (e.g., "1:32.500")
    static func formatLapTime(milliseconds: Int) -> String {
        let totalSeconds = Double(milliseconds) / 1000.0
        let minutes = Int(totalSeconds) / 60
        let seconds = totalSeconds.truncatingRemainder(dividingBy: 60)

        if minutes > 0 {
            return String(format: "%d:%06.3f", minutes, seconds)
        } else {
            return String(format: "%.3f", seconds)
        }
    }

    /// Format duration from milliseconds to "MM:SS" (e.g., "20:00")
    static func formatDuration(milliseconds: Int) -> String {
        let totalSeconds = milliseconds / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    /// Format lap time from TimeInterval to "M:SS.mmm"
    static func formatLapTime(seconds: TimeInterval) -> String {
        formatLapTime(milliseconds: Int(seconds * 1000))
    }

    /// Format duration from TimeInterval to "MM:SS"
    static func formatDuration(seconds: TimeInterval) -> String {
        formatDuration(milliseconds: Int(seconds * 1000))
    }

    /// Format delta (e.g., "+0.350", "-1.200")
    static func formatDelta(milliseconds: Int) -> String {
        let seconds = Double(milliseconds) / 1000.0
        let sign = milliseconds >= 0 ? "+" : ""
        return String(format: "%@%.3f", sign, seconds)
    }

    /// Format date for session display (e.g., "Jan 15, 2024")
    static func formatSessionDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    /// Format date and time (e.g., "Jan 15, 2024 at 2:30 PM")
    static func formatSessionDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
