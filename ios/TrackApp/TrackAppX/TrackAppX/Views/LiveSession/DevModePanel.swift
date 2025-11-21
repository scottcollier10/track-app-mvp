//
//  DevModePanel.swift
//  TrackApp
//
//  Dev mode panel for simulating GPS/geofence events
//

import SwiftUI

struct DevModePanel: View {
    @Bindable var viewModel: LiveSessionViewModel

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 16) {
                // Header
                HStack {
                    Image(systemName: "hammer.fill")
                    Text("Dev Mode")
                        .font(.headline)
                    Spacer()
                    Button {
                        viewModel.toggleDevMode()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.bottom, 8)

                Divider()

                // Speed Slider
                VStack(alignment: .leading, spacing: 8) {
                    Text("Simulated Speed: \(Int(viewModel.simulatedSpeed)) mph")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Slider(value: $viewModel.simulatedSpeed, in: 0...120, step: 1)
                        .onChange(of: viewModel.simulatedSpeed) { oldValue, newValue in
                            viewModel.updateSimulatedSpeed(newValue)
                        }

                    HStack {
                        Text("0 mph")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("120 mph")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Divider()

                // Geofence Buttons
                VStack(spacing: 12) {
                    // Lap marking button - only marks laps, doesn't end session
                    devButton(
                        title: "Cross Start/Finish (Mark Lap)",
                        systemImage: "flag.checkered",
                        color: .trackGreen
                    ) {
                        viewModel.simulateCrossStartFinish()
                    }

                    HStack(spacing: 12) {
                        devButton(
                            title: "Enter Pits",
                            systemImage: "arrow.down.circle",
                            color: .trackYellow
                        ) {
                            viewModel.simulateEnterPitLane()
                        }

                        devButton(
                            title: "Exit Pits",
                            systemImage: "arrow.up.circle",
                            color: .trackBlue
                        ) {
                            viewModel.simulateExitPitLane()
                        }
                    }

                    Divider()
                        .padding(.vertical, 4)

                    // Session control buttons
                    VStack(spacing: 12) {
                        // End Session button - saves data and shows summary
                        devButton(
                            title: "End Session",
                            systemImage: "checkmark.circle.fill",
                            color: .green
                        ) {
                            viewModel.endSession()
                        }

                        // Cancel button - discards data and returns to home
                        devButton(
                            title: "Cancel Session",
                            systemImage: "xmark.circle.fill",
                            color: .red
                        ) {
                            viewModel.cancelSession()
                        }
                    }
                }

                // Info
                Text("Triple-tap state indicator to toggle dev mode")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.2), radius: 10, x: 0, y: -5)
            )
            .padding()
        }
        .ignoresSafeArea()
    }

    private func devButton(
        title: String,
        systemImage: String,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: systemImage)
                Text(title)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(10)
        }
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Color(.systemGray6).ignoresSafeArea()
        DevModePanel(viewModel: LiveSessionViewModel())
    }
}
