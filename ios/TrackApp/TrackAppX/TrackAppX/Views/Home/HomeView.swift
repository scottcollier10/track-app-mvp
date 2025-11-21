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
    @State private var selectedTrackForNewSession: Track?   // <- used to push Live
    @State private var selectedSession: Session?            // <- used to push Summary
    @State private var completedSession: Session?           // <- used for session just completed

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    startSessionButton
                    if !viewModel.recentSessions.isEmpty { recentSessionsSection }
                }
                .padding()
            }
            .navigationTitle("Track App")
            .onAppear { viewModel.loadData() }

            // 1) Select track in a sheet
            .sheet(isPresented: $showingTrackSelection) {
                TrackSelectionView { track in
                    // set and let the destination push
                    selectedTrackForNewSession = track
                    showingTrackSelection = false
                }
            }

            // 2) Destination when a track was picked
            .navigationDestination(item: $selectedTrackForNewSession) { track in
                LiveSessionView(track: track) { completedSession in
                    // When session finishes, navigate to summary
                    self.completedSession = completedSession
                }
            }

            // 3) Destination for session just completed
            .navigationDestination(item: $completedSession) { session in
                SessionSummaryView(
                    session: session,
                    track: viewModel.track(for: session)
                )
            }

            // 4) Destination for tapping a recent session
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(
                    session: session,
                    track: viewModel.track(for: session)
                )
            }

            // 5) Error surface (uses clearError() you added)
            .alert(
                "Error",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil },
                    set: { if !$0 { viewModel.clearError() } }
                )
            ) {
                Button("OK") { viewModel.clearError() }
            } message: {
                Text(viewModel.errorMessage ?? "")
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
                Image(systemName: "play.circle.fill").font(.title2)
                Text("Start Session").font(.headline)
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
