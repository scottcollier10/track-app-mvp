//
//  HomeView.swift
//  TrackApp
//

import SwiftUI

struct HomeView: View {
    @StateObject private var router = Router()
    @State private var viewModel = HomeViewModel()

    @State private var showingTrackSelection = false

    var body: some View {
        NavigationStack(path: $router.path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    headerSection

                    // Start Session
                    startSessionButton

                    // Recent Sessions
                    if !viewModel.recentSessions.isEmpty {
                        recentSessionsSection
                    }
                }
                .padding()
            }
            .navigationTitle("Track App")
            .onAppear { viewModel.loadData() }
            .sheet(isPresented: $showingTrackSelection) {
                TrackSelectionView { track in
                    showingTrackSelection = false
                    router.path.append(Route.live(track))
                }
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .live(let track):
                    LiveSessionView(track: track)
                        .environmentObject(router)

                case .summary(let session, let track):
                    SessionSummaryView(session: session, track: track) {
                        // onDone: go home and refresh
                        router.popToRoot()
                        viewModel.loadData()
                    }
                    .environmentObject(router)
                }
            }
        }
        // pass the router down the tree
        .environmentObject(router)
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

    // MARK: - Start
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

    // MARK: - Recent
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
                    router.path.append(.summary(session, viewModel.track(for: session)))
                }
            }
        }
    }
}

// MARK: - Session Row (unchanged except kept here for completeness)
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

#Preview { HomeView() }
