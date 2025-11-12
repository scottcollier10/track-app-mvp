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
    @State private var navPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    startSessionButton
                    if !viewModel.recentSessions.isEmpty { recentSessionsSection }
                }
                .padding()
            }
            .navigationTitle("Track App")
            .navigationDestination(for: Track.self) { track in
                LiveSessionView(track: track, onFinish: { session in
                    popToHomeAndShowSummary(session)
                })
            }
            .navigationDestination(for: Session.self) { session in
                SessionSummaryView(
                    session: session,
                    track: viewModel.track(for: session),
                    onDone: {
                        popToHome()
                    }
                )
            }
            .onAppear { viewModel.loadData() }
            .sheet(isPresented: $showingTrackSelection) {
                TrackSelectionView { track in
                    showingTrackSelection = false
                    navPath.append(track)
                }
            }
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

    // MARK: - Navigation Helpers
    private func popToHome() {
        navPath = NavigationPath()
    }

    private func popToHomeAndShowSummary(_ session: Session) {
        navPath = NavigationPath()
        navPath.append(session)
    }

    // MARK: - Header
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

    // MARK: - Start Session
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

    // MARK: - Recent Sessions
    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions").font(.headline)

            ForEach(viewModel.recentSessions) { session in
                NavigationLink(value: session) {
                    SessionRow(
                        session: session,
                        track: viewModel.track(for: session)
                    )
                }
                .buttonStyle(.plain)
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
            Image(systemName: "chevron.right").foregroundColor(.secondary)
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
