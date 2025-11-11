//
//  HomeView.swift
//  TrackApp
//
//  Main home screen showing recent sessions and track selection
//

import SwiftUI

struct HomeView: View {
    @State private var viewModel = HomeViewModel()
    @State private var showingTrackSelection = false
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    headerSection

                    // Start Session Button
                    startSessionButton

                    // Recent Sessions
                    if !viewModel.recentSessions.isEmpty {
                        recentSessionsSection
                    }
                }
                .padding()
            }
            .navigationTitle("Track App")
            .onAppear {
                viewModel.loadData()
            }
            .sheet(isPresented: $showingTrackSelection) {
                TrackSelectionView { track in
                    showingTrackSelection = false
                    // Navigate to live session
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

    // MARK: - Header Section
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Welcome back")
                .font(.title3)
                .foregroundColor(.secondary)

            if !viewModel.recentSessions.isEmpty {
                Text("\(viewModel.recentSessions.count) recent sessions")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Start Session Button
    private var startSessionButton: some View {
        Button {
            showingTrackSelection = true
        } label: {
            HStack {
                Image(systemName: "play.circle.fill")
                    .font(.title2)
                Text("Start Session")
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.trackGreen)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }

    // MARK: - Recent Sessions Section
    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.headline)

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

// MARK: - Session Row
struct SessionRow: View {
    let session: Session
    let track: Track?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(track?.name ?? "Unknown Track")
                    .font(.headline)

                Text(TimeFormatter.formatSessionDate(session.date))
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: 12) {
                    Label("\(session.lapCount) laps", systemImage: "flag.checkered")
                    if let bestLap = session.formattedBestLap {
                        Label(bestLap, systemImage: "timer")
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Preview
#Preview {
    HomeView()
}
