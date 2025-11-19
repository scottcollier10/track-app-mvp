//
//  SessionsListView.swift
//  TrackApp
//
//  View displaying all sessions with filtering and sorting
//

import SwiftUI

struct SessionsListView: View {
    @State private var viewModel = SessionsListViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading sessions...")
                } else if viewModel.sessions.isEmpty {
                    emptyStateView
                } else {
                    sessionsList
                }
            }
            .navigationTitle("Sessions")
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(session: session, track: viewModel.track(for: session))
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
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Empty State
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Sessions Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Complete your first track session to see it here.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
    }

    // MARK: - Sessions List
    private var sessionsList: some View {
        List {
            ForEach(viewModel.sessions) { session in
                SessionListRow(
                    session: session,
                    track: viewModel.track(for: session)
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    selectedSession = session
                }
            }
            .onDelete { indexSet in
                for index in indexSet {
                    viewModel.deleteSession(viewModel.sessions[index])
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Session List Row
struct SessionListRow: View {
    let session: Session
    let track: Track?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(track?.name ?? "Unknown Track")
                    .font(.headline)

                Spacer()

                Text(TimeFormatter.formatSessionDate(session.date))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 16) {
                Label("\(session.lapCount) laps", systemImage: "flag.checkered")

                if let bestLap = session.formattedBestLap {
                    Label(bestLap, systemImage: "timer")
                }

                Spacer()

                Text(session.formattedTotalTime)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - ViewModel
@Observable
class SessionsListViewModel {
    private(set) var sessions: [Session] = []
    private(set) var tracks: [Track] = []
    private(set) var isLoading = false
    var errorMessage: String?

    private let persistence: PersistenceService

    init(persistence: PersistenceService = FileManagerPersistence()) {
        self.persistence = persistence
    }

    func loadData() {
        isLoading = true
        errorMessage = nil

        do {
            // Load tracks from local storage
            let loadedTracks = try persistence.loadTracks()

            // Load all sessions
            let allSessions = try persistence.loadSessions()

            self.tracks = loadedTracks
            self.sessions = allSessions.sorted { $0.date > $1.date }
            self.isLoading = false
        } catch {
            self.errorMessage = "Failed to load sessions: \(error.localizedDescription)"
            self.isLoading = false
        }
    }

    func track(for session: Session) -> Track? {
        tracks.first { $0.id == session.trackId }
    }

    func deleteSession(_ session: Session) {
        do {
            try persistence.deleteSession(id: session.id)
            sessions.removeAll { $0.id == session.id }
        } catch {
            errorMessage = "Failed to delete session: \(error.localizedDescription)"
        }
    }
}

// MARK: - Preview
#Preview {
    SessionsListView()
}
