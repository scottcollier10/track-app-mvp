//
//  ProfileView.swift
//  TrackApp
//
//  Driver profile screen showing statistics and activity
//

import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Driver Info Card
                    driverInfoCard

                    // Statistics Grid
                    statisticsGrid

                    // Recent Activity
                    if !viewModel.recentSessions.isEmpty {
                        recentActivitySection
                    }
                }
                .padding()
            }
            .navigationTitle("Profile")
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(session: session, track: viewModel.track(for: session))
            }
            .refreshable {
                viewModel.loadData()
            }
            .onAppear {
                viewModel.loadData()
            }
            .onChange(of: selectedSession) { _, newValue in
                if newValue == nil {
                    viewModel.loadData()
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    // Clear error
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Driver Info Card
    private var driverInfoCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.trackBlue)

            Text("Driver Profile")
                .font(.title2)
                .fontWeight(.bold)

            if let email = viewModel.driverEmail {
                Text(email)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    // MARK: - Statistics Grid
    private var statisticsGrid: some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                statCard(
                    title: "Total Sessions",
                    value: "\(viewModel.totalSessions)",
                    icon: "flag.checkered",
                    color: .trackBlue
                )

                statCard(
                    title: "Total Laps",
                    value: "\(viewModel.totalLaps)",
                    icon: "timer",
                    color: .trackBlue
                )
            }

            if let bestLap = viewModel.allTimeBestLap {
                statCard(
                    title: "All-Time Best Lap",
                    value: bestLap.time,
                    subtitle: bestLap.track,
                    icon: "star.fill",
                    color: .trackGreen
                )
            }

            if let favoriteTrack = viewModel.favoriteTrack {
                statCard(
                    title: "Favorite Track",
                    value: favoriteTrack.displayName,
                    subtitle: favoriteTrack.location,
                    icon: "heart.fill",
                    color: .trackBlue
                )
            }
        }
    }

    private func statCard(title: String, value: String, subtitle: String? = nil, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontDesign(.monospaced)

            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }

    // MARK: - Recent Activity Section
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)

                Spacer()

                NavigationLink {
                    SessionsListView()
                } label: {
                    Text("View All")
                        .font(.subheadline)
                        .foregroundColor(.trackBlue)
                }
            }

            ForEach(viewModel.recentSessions) { session in
                SessionRow(
                    session: session,
                    track: viewModel.track(for: session)
                )
                .onTapGesture {
                    selectedSession = session
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
}
