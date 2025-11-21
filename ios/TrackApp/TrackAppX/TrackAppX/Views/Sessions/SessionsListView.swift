//
//  SessionsListView.swift
//  TrackApp
//
//  Sessions list screen showing all saved sessions with filtering and sorting
//

import SwiftUI

struct SessionsListView: View {
    @State private var viewModel = SessionsListViewModel()
    @State private var selectedSession: Session?
    @State private var showingSortMenu = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.filteredSessions.isEmpty {
                    emptyState
                } else {
                    sessionsList
                }
            }
            .navigationTitle("Sessions")
            .navigationDestination(item: $selectedSession) { session in
                SessionSummaryView(session: session, track: viewModel.track(for: session))
            }
            .searchable(text: $viewModel.searchText, prompt: "Search tracks")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("Sort By", selection: $viewModel.sortOrder) {
                            ForEach(SessionsListViewModel.SortOrder.allCases) { order in
                                Text(order.rawValue).tag(order)
                            }
                        }

                        Divider()

                        Picker("Filter by Track", selection: $viewModel.selectedTrackFilter) {
                            Text("All Tracks").tag(nil as Track?)
                            ForEach(viewModel.tracks) { track in
                                Text(track.displayName).tag(track as Track?)
                            }
                        }
                    } label: {
                        Label("Filter & Sort", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }
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

    // MARK: - Sessions List
    private var sessionsList: some View {
        List {
            ForEach(viewModel.filteredSessions) { session in
                SessionRow(
                    session: session,
                    track: viewModel.track(for: session)
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    selectedSession = session
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        viewModel.deleteSession(session)
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Sessions Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Start your first session to see it here!")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview
#Preview {
    SessionsListView()
}
