//
//  ProfileView.swift
//  TrackApp
//
//  User profile and settings view
//

import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()

    var body: some View {
        NavigationStack {
            List {
                // Stats Section
                Section("Your Stats") {
                    statsRow(title: "Total Sessions", value: "\(viewModel.totalSessions)", icon: "flag.checkered")
                    statsRow(title: "Total Laps", value: "\(viewModel.totalLaps)", icon: "repeat")
                    if let bestLap = viewModel.overallBestLap {
                        statsRow(title: "Best Lap", value: bestLap, icon: "star.fill")
                    }
                    if let totalTime = viewModel.totalTrackTime {
                        statsRow(title: "Track Time", value: totalTime, icon: "clock.fill")
                    }
                }

                // App Info Section
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(viewModel.appVersion)
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Build")
                        Spacer()
                        Text(viewModel.buildNumber)
                            .foregroundColor(.secondary)
                    }
                }

                // Data Section
                Section("Data") {
                    Button(role: .destructive) {
                        viewModel.showDeleteConfirmation = true
                    } label: {
                        Label("Clear All Data", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Profile")
            .onAppear {
                viewModel.loadStats()
            }
            .alert("Clear All Data?", isPresented: $viewModel.showDeleteConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Clear", role: .destructive) {
                    viewModel.clearAllData()
                }
            } message: {
                Text("This will permanently delete all your sessions and cannot be undone.")
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    private func statsRow(title: String, value: String, icon: String) -> some View {
        HStack {
            Label(title, systemImage: icon)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundColor(.trackGreen)
        }
    }
}

// MARK: - ViewModel
@Observable
class ProfileViewModel {
    private(set) var totalSessions = 0
    private(set) var totalLaps = 0
    private(set) var overallBestLap: String?
    private(set) var totalTrackTime: String?
    var showDeleteConfirmation = false
    var errorMessage: String?

    private let persistence: PersistenceService

    var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    func loadStats() {
        do {
            let sessions = try persistence.loadSessions()

            totalSessions = sessions.count
            totalLaps = sessions.reduce(0) { $0 + $1.lapCount }

            // Find overall best lap
            let bestLapMs = sessions.compactMap { $0.bestLapMs }.min()
            if let best = bestLapMs {
                overallBestLap = TimeFormatter.formatLapTime(milliseconds: best)
            }

            // Calculate total track time
            let totalMs = sessions.reduce(0) { $0 + $1.totalTimeMs }
            if totalMs > 0 {
                totalTrackTime = TimeFormatter.formatDuration(milliseconds: totalMs)
            }
        } catch {
            errorMessage = "Failed to load stats: \(error.localizedDescription)"
        }
    }

    func clearAllData() {
        do {
            try persistence.clearAllSessions()
            loadStats()
        } catch {
            errorMessage = "Failed to clear data: \(error.localizedDescription)"
        }
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
}
