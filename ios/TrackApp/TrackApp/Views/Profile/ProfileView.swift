//
//  ProfileView.swift
//  TrackApp
//
//  Profile screen showing driver statistics and activity
//

import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Driver Info Card
                    driverInfoCard

                    // Statistics
                    if viewModel.totalSessions > 0 {
                        statisticsSection
                    }

                    // Recent Activity
                    if !viewModel.recentSessions.isEmpty {
                        recentActivitySection
                    }

                    // Empty State
                    if viewModel.totalSessions == 0 && !viewModel.isLoading {
                        emptyStateView
                    }
                }
                .padding()
            }
            .navigationTitle("Profile")
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(session: session, track: viewModel.track(for: session))
            }
            .onAppear {
                viewModel.loadData()
            }
            .refreshable {
                viewModel.loadData()
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
        HStack(spacing: 16) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.trackBlue)

            VStack(alignment: .leading, spacing: 4) {
                Text("Driver Profile")
                    .font(.title2)
                    .fontWeight(.bold)

                if let email = viewModel.driverEmail {
                    Text(email)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    Text("Track your progress")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    // MARK: - Statistics Section
    private var statisticsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Statistics")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                // Total Sessions
                statCard(
                    title: "Total Sessions",
                    value: "\(viewModel.totalSessions)",
                    icon: "flag.checkered",
                    color: .trackBlue
                )

                // Total Laps
                statCard(
                    title: "Total Laps",
                    value: "\(viewModel.totalLaps)",
                    icon: "arrow.trianglehead.counterclockwise.rotate.90",
                    color: .trackBlue
                )

                // All-Time Best Lap
                if let bestLap = viewModel.allTimeBestLap {
                    VStack(spacing: 8) {
                        Image(systemName: "timer")
                            .font(.title3)
                            .foregroundColor(.trackGreen)

                        Text(bestLap.time)
                            .font(.headline)
                            .fontDesign(.monospaced)

                        Text("Best Lap")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(bestLap.track)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }

                // Favorite Track
                if let favoriteTrack = viewModel.favoriteTrack {
                    VStack(spacing: 8) {
                        Image(systemName: "star.fill")
                            .font(.title3)
                            .foregroundColor(.trackBlue)

                        Text(favoriteTrack.name)
                            .font(.headline)
                            .lineLimit(1)

                        Text("Favorite Track")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text("\(viewModel.favoriteTrackSessionCount) sessions")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }
            }
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontDesign(.monospaced)

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

    // MARK: - Empty State
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Activity Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Complete your first session to see your statistics here!")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
}
