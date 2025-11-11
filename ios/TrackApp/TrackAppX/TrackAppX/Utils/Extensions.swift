//
//  Extensions.swift
//  TrackApp
//
//  Useful extensions for common types
//

import Foundation
import SwiftUI

// MARK: - Date Extensions
extension Date {
    /// Get date components for easier comparison
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    /// Check if date is today
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Check if date is within last 7 days
    var isWithinLastWeek: Bool {
        let weekAgo = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        return self > weekAgo
    }
}

// MARK: - Color Extensions
extension Color {
    /// App theme colors
    static let trackGreen = Color(red: 0.2, green: 0.8, blue: 0.4)
    static let trackRed = Color(red: 0.9, green: 0.2, blue: 0.2)
    static let trackYellow = Color(red: 1.0, green: 0.8, blue: 0.0)
    static let trackBlue = Color(red: 0.2, green: 0.6, blue: 1.0)

    /// State-specific colors
    static func stateColor(for state: SessionState) -> Color {
        switch state {
        case .disarmed:
            return .gray
        case .armed:
            return .trackYellow
        case .recording:
            return .trackGreen
        case .pitsPause:
            return .trackBlue
        case .end:
            return .gray
        }
    }
}

// MARK: - Array Extensions
extension Array where Element == Lap {
    /// Find the best (fastest) lap
    var fastest: Lap? {
        self.min(by: { $0.lapTimeMs < $1.lapTimeMs })
    }

    /// Calculate average lap time in milliseconds
    var averageMs: Int? {
        guard !isEmpty else { return nil }
        let total = reduce(0) { $0 + $1.lapTimeMs }
        return total / count
    }
}

// MARK: - View Extensions
extension View {
    /// Apply conditional modifier
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Apply card styling
    func cardStyle() -> some View {
        self
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}
