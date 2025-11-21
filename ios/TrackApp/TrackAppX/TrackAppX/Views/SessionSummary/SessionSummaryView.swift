//
//  SessionSummaryView.swift
//  TrackApp
//
//  Session summary screen showing lap times and upload options
//

import SwiftUI

struct SessionSummaryView: View {
    @State private var viewModel: SessionSummaryViewModel
    @State private var showingUploadSheet = false
    @State private var driverEmail = ""
    @Environment(\.dismiss) private var dismiss

    var onDone: (() -> Void)?   // keep this

    init(session: Session, track: Track?, onDone: (() -> Void)? = nil) {
        _viewModel = State(initialValue: SessionSummaryViewModel(session: session, track: track))
        self.onDone = onDone
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Session Header
                sessionHeader

                // Summary Stats
                summaryStats

                // Laps Table
                lapsSection

                // Actions
                actionsSection
            }
            .padding()
        }
        .navigationTitle("Session Summary")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingUploadSheet) {
            uploadSheet
        }
        .alert("Success", isPresented: $viewModel.uploadSuccess) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Session uploaded successfully!")
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

    // MARK: - Session Header
    private var sessionHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let track = viewModel.track {
                Text(track.name)
                    .font(.title2)
                    .fontWeight(.bold)

                if let location = track.location {
                    Text(location)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            Text(TimeFormatter.formatSessionDateTime(viewModel.session.date))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    // MARK: - Summary Stats
    private var summaryStats: some View {
        HStack(spacing: 24) {
            statCard(
                title: "Total Time",
                value: viewModel.session.formattedTotalTime,
                icon: "clock.fill"
            )

            statCard(
                title: "Best Lap",
                value: viewModel.session.formattedBestLap ?? "--:--",
                icon: "star.fill"
            )

            statCard(
                title: "Laps",
                value: "\(viewModel.session.lapCount)",
                icon: "flag.checkered"
            )
        }
    }

    private func statCard(title: String, value: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.trackBlue)

            Text(value)
                .font(.headline)
                .fontDesign(.monospaced)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }

    // MARK: - Laps Section
    private var lapsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Laps")
                .font(.headline)

            VStack(spacing: 0) {
                // Table Header
                HStack {
                    Text("Lap")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .frame(width: 50, alignment: .leading)
                    Text("Time")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Delta")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .frame(width: 80, alignment: .trailing)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))

                Divider()

                // Lap Rows
                ForEach(viewModel.lapsWithDeltas, id: \.lap.id) { item in
                    lapRow(lap: item.lap, delta: item.delta)
                    if item.lap.id != viewModel.lapsWithDeltas.last?.lap.id {
                        Divider()
                    }
                }
            }
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        }
    }

    private func lapRow(lap: Lap, delta: String?) -> some View {
        HStack {
            Text("\(lap.lapNumber)")
                .font(.subheadline)
                .fontWeight(.medium)
                .frame(width: 50, alignment: .leading)

            Text(lap.formattedTime)
                .font(.subheadline)
                .fontDesign(.monospaced)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let delta = delta {
                Text(delta)
                    .font(.subheadline)
                    .fontDesign(.monospaced)
                    .foregroundColor(delta == "Best" ? .trackGreen : .secondary)
                    .frame(width: 80, alignment: .trailing)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }

    // MARK: - Shareable Text
    private var shareableText: String {
        var text = ""
        if let track = viewModel.track {
            text += "\(track.displayName) Session\n"
        } else {
            text += "Track Session\n"
        }
        text += "\(TimeFormatter.formatSessionDate(viewModel.session.date))\n\n"
        text += "Summary:\n"
        text += "Total Time: \(viewModel.session.formattedTotalTime)\n"
        text += "Best Lap: \(viewModel.session.formattedBestLap ?? "--:--")\n"
        text += "Laps: \(viewModel.session.lapCount)\n\n"
        text += "Lap Times:\n"
        for lap in viewModel.session.laps.sorted(by: { $0.lapNumber < $1.lapNumber }) {
            text += "Lap \(lap.lapNumber): \(lap.formattedTime)\n"
        }
        return text
    }

    // MARK: - Actions Section
    private var actionsSection: some View {
        VStack(spacing: 12) {
            // Share Session Button
            ShareLink(item: shareableText) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Share Session")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.trackBlue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }

            // Upload to Dashboard Button
            Button {
                showingUploadSheet = true
            } label: {
                HStack {
                    Image(systemName: "icloud.and.arrow.up")
                    Text("Upload to Dashboard")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.trackGreen)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.isUploading)

            // Done Button
            Button {
                viewModel.saveLocal()
            } label: {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("Done")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.systemGray5))
                .foregroundColor(.primary)
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Upload Sheet
    private var uploadSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Driver Email", text: $driverEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                } header: {
                    Text("Driver Information")
                } footer: {
                    Text("Enter the email address associated with your dashboard account.")
                }
            }
            .navigationTitle("Upload Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingUploadSheet = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Upload") {
                        Task {
                            await viewModel.uploadToServer(driverEmail: driverEmail)
                            if viewModel.uploadSuccess {
                                showingUploadSheet = false
                            }
                        }
                    }
                    .disabled(driverEmail.isEmpty || viewModel.isUploading)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        SessionSummaryView(session: Session.preview, track: Track.preview)
    }
}
