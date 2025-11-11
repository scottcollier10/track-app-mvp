//
//  LiveSessionView.swift
//  TrackApp
//
//  Live session screen showing lap timer and controls
//

import SwiftUI

struct LiveSessionView: View {
    @State private var viewModel: LiveSessionViewModel
    @State private var tapCount = 0
    @Environment(\.dismiss) private var dismiss
    let track: Track

    init(track: Track, viewModel: LiveSessionViewModel = LiveSessionViewModel()) {
        self.track = track
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ZStack {
            // Main Content
            VStack(spacing: 24) {
                // State Header
                stateHeader

                Spacer()

                // Main Timer Display
                mainTimerDisplay

                // Stats Row
                statsRow

                Spacer()

                // Controls
                controlButtons

                // Dev Mode Toggle Area
                Color.red.opacity(0.2)
                    .frame(height: 44)
                    .contentShape(Rectangle())
                    .onTapGesture(count: 3) {
                        viewModel.toggleDevMode()
                    }
            }
            .padding()

            // Dev Mode Overlay
            if viewModel.isDevModeEnabled {
                DevModePanel(viewModel: viewModel)
            }
        }
        .navigationTitle(track.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(viewModel.stateMachine.state.isRecording)
        .toolbar {
            if !viewModel.stateMachine.state.isRecording {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            // Automatically arm the session
            viewModel.stateMachine.handle(.arm(track: track))
        }
    }

    // MARK: - State Header
    private var stateHeader: some View {
        VStack(spacing: 4) {
            Text(viewModel.stateMachine.state.name.uppercased())
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.stateColor(for: viewModel.stateMachine.state))
                .cornerRadius(8)

            Text(viewModel.stateMachine.state.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Main Timer Display
    private var mainTimerDisplay: some View {
        VStack(spacing: 8) {
            Text("Current Lap")
                .font(.headline)
                .foregroundColor(.secondary)

            Text(viewModel.formattedCurrentLapTime)
                .font(.system(size: 64, weight: .bold, design: .monospaced))
                .foregroundColor(viewModel.stateMachine.state.isRecording ? .trackGreen : .primary)
        }
    }

    // MARK: - Stats Row
    private var statsRow: some View {
        HStack(spacing: 32) {
            statItem(
                label: "Last Lap",
                value: viewModel.formattedLastLapTime ?? "--:--",
                icon: "flag.checkered"
            )

            statItem(
                label: "Best Lap",
                value: viewModel.bestLapTime ?? "--:--",
                icon: "star.fill"
            )

            statItem(
                label: "Laps",
                value: "\(viewModel.lapCount)",
                icon: "number"
            )
        }
    }

    private func statItem(label: String, value: String, icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(.secondary)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.headline)
                .fontDesign(.monospaced)
        }
    }

    // MARK: - Control Buttons
    @ViewBuilder
    private var controlButtons: some View {
        switch viewModel.stateMachine.state {
        case .armed:
            VStack(spacing: 16) {
                primaryButton(
                    title: "Start Session",
                    systemImage: "play.fill",
                    color: .trackGreen
                ) {
                    viewModel.stateMachine.handle(.manualStart)
                }

                secondaryButton(
                    title: "Cancel",
                    systemImage: "xmark"
                ) {
                    dismiss()
                }
            }

        case .recording:
            VStack(spacing: 16) {
                primaryButton(
                    title: "Mark Lap",
                    systemImage: "flag.checkered.2.crossed",
                    color: .trackBlue
                ) {
                    viewModel.stateMachine.handle(.manualMarkLap)
                }

                HStack(spacing: 16) {
                    secondaryButton(
                        title: "Pause",
                        systemImage: "pause.fill"
                    ) {
                        viewModel.stateMachine.handle(.manualPause)
                    }

                    secondaryButton(
                        title: "Stop",
                        systemImage: "stop.fill"
                    ) {
                        viewModel.stateMachine.handle(.manualStop)
                    }
                }
            }

        case .pitsPause:
            VStack(spacing: 16) {
                primaryButton(
                    title: "Resume",
                    systemImage: "play.fill",
                    color: .trackGreen
                ) {
                    viewModel.stateMachine.handle(.resume)
                }

                secondaryButton(
                    title: "End Session",
                    systemImage: "stop.fill"
                ) {
                    viewModel.stateMachine.handle(.manualStop)
                }
            }

        case .end(let session):
            // Navigate to summary
            NavigationLink(destination: SessionSummaryView(session: session, track: track)) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text("View Summary")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.trackGreen)
                .foregroundColor(.white)
                .cornerRadius(12)
            }

        default:
            EmptyView()
        }
    }

    private func primaryButton(
        title: String,
        systemImage: String,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: systemImage)
                Text(title)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }

    private func secondaryButton(
        title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: systemImage)
                Text(title)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemGray5))
            .foregroundColor(.primary)
            .cornerRadius(12)
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        LiveSessionView(track: Track.preview)
    }
}
