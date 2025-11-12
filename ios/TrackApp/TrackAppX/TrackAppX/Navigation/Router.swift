// Router.swift
// Centralized navigation routes

import Foundation

/// All destinations your NavigationStack can push.
enum NavRoute: Hashable {
    case live(Track)                // LiveSessionView for a chosen track
    case summary(Session, Track?)   // SessionSummaryView for a finished session
}
