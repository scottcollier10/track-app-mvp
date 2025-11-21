//
//  ProfileView.swift
//  TrackApp
//
//  Profile view showing driver statistics and recent sessions
//

import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ScrollView {
                if viewModel.hasData {
                    VStack(alignment: .leading, spacing: 24) {
                        statisticsSection
                        recentSessionsSection
                    }
                    .padding()
                } else {
                    emptyState
                }
            }
            .navigationTitle("Profile")
            .onAppear {
                viewModel.loadData()
            }
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(
                    session: session,
                    track: viewModel.track(for: session)
                )
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.clearError()
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.circle")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text("No data yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Complete your first session to see your stats!")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Statistics Section
    private var statisticsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Statistics")
                .font(.title2)
                .fontWeight(.bold)

            // Main stats grid
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    statCard(
                        title: "Total Sessions",
                        value: "\(viewModel.totalSessions)",
                        icon: "flag.checkered.2.crossed"
                    )

                    statCard(
                        title: "Total Laps",
                        value: "\(viewModel.totalLaps)",
                        icon: "repeat.circle"
                    )
                }

                // Best lap card - full width
                if let bestLap = viewModel.allTimeBestLap {
                    VStack(spacing: 8) {
                        Image(systemName: "star.fill")
                            .font(.title2)
                            .foregroundColor(.trackYellow)

                        Text(bestLap.time)
                            .font(.title)
                            .fontWeight(.bold)
                            .fontDesign(.monospaced)

                        Text("All-Time Best Lap")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(bestLap.track)
                            .font(.caption)
                            .foregroundColor(.trackBlue)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }

                // Favorite track
                if let favorite = viewModel.favoriteTrack {
                    HStack {
                        Image(systemName: "heart.fill")
                            .font(.title3)
                            .foregroundColor(.trackRed)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Favorite Track")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Text(favorite)
                                .font(.headline)
                        }

                        Spacer()
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }
            }
        }
    }

    private func statCard(title: String, value: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.trackBlue)

            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .fontDesign(.monospaced)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }

    // MARK: - Recent Sessions Section
    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.headline)

            if viewModel.recentSessions.isEmpty {
                Text("No recent sessions")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
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
}

// MARK: - Preview
#Preview {
    ProfileView()
}
