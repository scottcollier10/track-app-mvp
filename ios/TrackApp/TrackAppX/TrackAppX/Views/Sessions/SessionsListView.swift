//
//  SessionsListView.swift
//  TrackApp
//
//  List of all saved sessions with sorting and filtering
//

import SwiftUI

struct SessionsListView: View {
    @State private var viewModel = SessionsListViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.filteredSessions.isEmpty {
                    emptyState
                } else {
                    sessionsList
                }
            }
            .navigationTitle("Sessions")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        sortMenu
                        Divider()
                        filterMenu
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                }
            }
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
            Image(systemName: "list.bullet.circle")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text("No sessions yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Start your first session!")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }

    // MARK: - Sessions List
    private var sessionsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.filteredSessions) { session in
                    SessionRow(
                        session: session,
                        track: viewModel.track(for: session)
                    )
                    .onTapGesture {
                        selectedSession = session
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Sort Menu
    private var sortMenu: some View {
        Section("Sort By") {
            ForEach(SessionsListViewModel.SortOption.allCases, id: \.id) { option in
                Button {
                    viewModel.sortOption = option
                } label: {
                    HStack {
                        Text(option.rawValue)
                        if viewModel.sortOption == option {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Filter Menu
    private var filterMenu: some View {
        Section("Filter by Track") {
            Button {
                viewModel.selectedTrackFilter = nil
            } label: {
                HStack {
                    Text("All Tracks")
                    if viewModel.selectedTrackFilter == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }

            ForEach(viewModel.tracks) { track in
                Button {
                    viewModel.selectedTrackFilter = track.id
                } label: {
                    HStack {
                        Text(track.name)
                        if viewModel.selectedTrackFilter == track.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    SessionsListView()
}
