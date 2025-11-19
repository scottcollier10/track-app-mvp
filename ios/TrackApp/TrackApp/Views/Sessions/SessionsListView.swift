//
//  SessionsListView.swift
//  TrackApp
//
//  List view showing all saved sessions with sorting and filtering
//

import SwiftUI

struct SessionsListView: View {
    @State private var viewModel = SessionsListViewModel()
    @State private var selectedSession: Session?
    @State private var showingSortOptions = false
    @State private var showingFilterOptions = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.filteredSessions.isEmpty && !viewModel.isLoading {
                    emptyStateView
                } else {
                    sessionsList
                }
            }
            .navigationTitle("Sessions")
            .searchable(text: $viewModel.searchText, prompt: "Search by track name")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // Filter button
                        Menu {
                            Button("All Tracks") {
                                viewModel.selectedTrackFilter = nil
                            }
                            Divider()
                            ForEach(viewModel.tracks) { track in
                                Button(track.name) {
                                    viewModel.selectedTrackFilter = track
                                }
                            }
                        } label: {
                            Image(systemName: viewModel.selectedTrackFilter != nil ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        }

                        // Sort button
                        Menu {
                            ForEach(SessionsListViewModel.SortOrder.allCases, id: \.self) { order in
                                Button {
                                    viewModel.sortOrder = order
                                } label: {
                                    HStack {
                                        Text(order.rawValue)
                                        if viewModel.sortOrder == order {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            Image(systemName: "arrow.up.arrow.down")
                        }
                    }
                }
            }
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(session: session, track: viewModel.track(for: session))
            }
            .onAppear {
                viewModel.loadSessions()
            }
            .refreshable {
                viewModel.loadSessions()
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    // Clear error handled by viewModel
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Sessions List
    private var sessionsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                // Active filter indicator
                if let filter = viewModel.selectedTrackFilter {
                    HStack {
                        Text("Filtered by: \(filter.name)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Button("Clear") {
                            viewModel.selectedTrackFilter = nil
                        }
                        .font(.caption)
                        .foregroundColor(.trackBlue)
                    }
                    .padding(.horizontal)
                }

                ForEach(viewModel.filteredSessions) { session in
                    SessionRow(
                        session: session,
                        track: viewModel.track(for: session)
                    )
                    .onTapGesture {
                        selectedSession = session
                    }
                    .contextMenu {
                        Button(role: .destructive) {
                            viewModel.deleteSession(session)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .padding()
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

            Text("Start your first session from the Home tab!")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Preview
#Preview {
    SessionsListView()
}
