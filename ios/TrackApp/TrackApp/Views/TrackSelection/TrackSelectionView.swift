//
//  TrackSelectionView.swift
//  TrackApp
//
//  Screen for selecting a track before starting a session
//

import SwiftUI

struct TrackSelectionView: View {
    @State private var viewModel = TrackSelectionViewModel()
    @Environment(\.dismiss) private var dismiss
    let onTrackSelected: (Track) -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search Bar
                searchBar

                // Track List
                if viewModel.filteredTracks.isEmpty {
                    emptyState
                } else {
                    trackList
                }
            }
            .navigationTitle("Select Track")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                viewModel.loadTracks()
            }
        }
    }

    // MARK: - Search Bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField("Search tracks...", text: $viewModel.searchText)
                .textFieldStyle(.plain)
            if !viewModel.searchText.isEmpty {
                Button {
                    viewModel.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding()
    }

    // MARK: - Track List
    private var trackList: some View {
        List(viewModel.filteredTracks) { track in
            TrackRow(track: track)
                .onTapGesture {
                    onTrackSelected(track)
                }
        }
        .listStyle(.plain)
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "map")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            Text("No tracks found")
                .font(.headline)
            Text("Try a different search")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Track Row
struct TrackRow: View {
    let track: Track

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(track.displayName)
                    .font(.headline)

                if let location = track.location {
                    Text(location)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                if let miles = track.lengthMiles {
                    Text(String(format: "%.2f miles", miles))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Preview
#Preview {
    TrackSelectionView { _ in }
}
