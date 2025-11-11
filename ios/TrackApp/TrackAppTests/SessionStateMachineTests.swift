//
//  SessionStateMachineTests.swift
//  TrackAppTests
//
//  Comprehensive tests for session state machine
//

import XCTest
@testable import TrackApp

final class SessionStateMachineTests: XCTestCase {
    var stateMachine: SessionStateMachine!
    let testTrack = Track(name: "Test Track", location: "Test City", lengthMeters: 3000)

    override func setUp() {
        super.setUp()
        stateMachine = SessionStateMachine(
            autoStartSpeedThreshold: 15.0,
            autoStopSpeedThreshold: 10.0,
            lowSpeedDuration: 30.0
        )
    }

    override func tearDown() {
        stateMachine = nil
        super.tearDown()
    }

    // MARK: - Initial State
    func testInitialState() {
        XCTAssertEqual(stateMachine.state.name, "Disarmed")
    }

    // MARK: - Disarmed → Armed
    func testArmFromDisarmed() {
        stateMachine.handle(.arm(track: testTrack))

        guard case .armed(let track) = stateMachine.state else {
            XCTFail("Expected armed state")
            return
        }
        XCTAssertEqual(track.id, testTrack.id)
    }

    // MARK: - Armed → Recording (Manual Start)
    func testManualStartFromArmed() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)

        XCTAssertTrue(stateMachine.state.isRecording)
        XCTAssertNotNil(stateMachine.state.currentSession)
    }

    // MARK: - Armed → Recording (Auto Start via Speed)
    func testAutoStartFromArmedViaSpeed() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.speedAboveThreshold(mph: 20.0))

        XCTAssertTrue(stateMachine.state.isRecording)
    }

    func testAutoStartFromArmedViaSpeedThreshold() {
        stateMachine.handle(.arm(track: testTrack))
        // Below threshold - should not start
        stateMachine.handle(.speedAboveThreshold(mph: 10.0))
        XCTAssertTrue(stateMachine.state.isArmed)

        // At threshold - should start
        stateMachine.handle(.speedAboveThreshold(mph: 15.0))
        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - Armed → Recording (Auto Start via Start/Finish)
    func testAutoStartFromArmedViaCrossing() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.crossStartFinish)

        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - Armed → Disarmed (Cancel)
    func testCancelFromArmed() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.cancel)

        guard case .disarmed = stateMachine.state else {
            XCTFail("Expected disarmed state")
            return
        }
    }

    // MARK: - Recording → New Lap (Cross Start/Finish)
    func testLapCreationOnCrossing() {
        var lapCompleted: Lap?
        stateMachine.onLapCompleted = { lap in
            lapCompleted = lap
        }

        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)

        // Wait a moment to simulate time passing
        Thread.sleep(forTimeInterval: 0.1)

        stateMachine.handle(.crossStartFinish)

        XCTAssertNotNil(lapCompleted)
        XCTAssertEqual(lapCompleted?.lapNumber, 1)
        XCTAssertGreaterThan(lapCompleted?.lapTimeMs ?? 0, 0)

        // Should still be recording
        XCTAssertTrue(stateMachine.state.isRecording)

        // Check session has lap
        if case .recording(let session, _, _) = stateMachine.state {
            XCTAssertEqual(session.lapCount, 1)
            XCTAssertNotNil(session.bestLapMs)
        } else {
            XCTFail("Expected recording state")
        }
    }

    // MARK: - Recording → New Lap (Manual Mark)
    func testManualLapMarking() {
        var lapsCompleted: [Lap] = []
        stateMachine.onLapCompleted = { lap in
            lapsCompleted.append(lap)
        }

        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)

        stateMachine.handle(.manualMarkLap)
        stateMachine.handle(.manualMarkLap)
        stateMachine.handle(.manualMarkLap)

        XCTAssertEqual(lapsCompleted.count, 3)
        XCTAssertEqual(lapsCompleted[0].lapNumber, 1)
        XCTAssertEqual(lapsCompleted[1].lapNumber, 2)
        XCTAssertEqual(lapsCompleted[2].lapNumber, 3)
    }

    // MARK: - Recording → PitsPause (Enter Pit Lane)
    func testPauseOnEnterPitLane() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.enterPitLane)

        XCTAssertTrue(stateMachine.state.isPaused)
    }

    // MARK: - Recording → PitsPause (Low Speed)
    func testPauseOnLowSpeed() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.speedBelowThreshold(mph: 5.0, duration: 31.0))

        XCTAssertTrue(stateMachine.state.isPaused)
    }

    func testNoPauseOnLowSpeedShortDuration() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.speedBelowThreshold(mph: 5.0, duration: 15.0))

        // Should still be recording (duration < 30s)
        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - Recording → PitsPause (Manual Pause)
    func testManualPause() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualPause)

        XCTAssertTrue(stateMachine.state.isPaused)
    }

    // MARK: - Recording → End (Manual Stop)
    func testManualStopFromRecording() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualStop)

        guard case .end(let session) = stateMachine.state else {
            XCTFail("Expected end state")
            return
        }
        XCTAssertGreaterThan(session.totalTimeMs, 0)
    }

    // MARK: - PitsPause → Recording (Resume)
    func testResumeFromPause() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualPause)
        stateMachine.handle(.resume)

        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - PitsPause → Recording (Speed Above Threshold)
    func testAutoResumeFromPauseViaSpeed() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.enterPitLane)
        stateMachine.handle(.speedAboveThreshold(mph: 20.0))

        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - PitsPause → Recording (Exit Pit Lane)
    func testAutoResumeFromPauseViaExitPit() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.enterPitLane)
        stateMachine.handle(.exitPitLane)

        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - PitsPause → End (Manual Stop)
    func testManualStopFromPause() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualPause)
        stateMachine.handle(.manualStop)

        guard case .end = stateMachine.state else {
            XCTFail("Expected end state")
            return
        }
    }

    // MARK: - End → Disarmed (Dismiss)
    func testDismissFromEnd() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualStop)
        stateMachine.handle(.dismiss)

        guard case .disarmed = stateMachine.state else {
            XCTFail("Expected disarmed state")
            return
        }
    }

    // MARK: - Complete Session Flow
    func testCompleteSessionFlow() {
        var lapsCompleted: [Lap] = []
        stateMachine.onLapCompleted = { lap in
            lapsCompleted.append(lap)
        }

        // 1. Arm
        stateMachine.handle(.arm(track: testTrack))
        XCTAssertTrue(stateMachine.state.isArmed)

        // 2. Auto-start via speed
        stateMachine.handle(.speedAboveThreshold(mph: 20.0))
        XCTAssertTrue(stateMachine.state.isRecording)

        // 3. Complete 3 laps
        stateMachine.handle(.crossStartFinish)
        stateMachine.handle(.crossStartFinish)
        stateMachine.handle(.crossStartFinish)
        XCTAssertEqual(lapsCompleted.count, 3)

        // 4. Enter pits
        stateMachine.handle(.enterPitLane)
        XCTAssertTrue(stateMachine.state.isPaused)

        // 5. Exit pits
        stateMachine.handle(.exitPitLane)
        XCTAssertTrue(stateMachine.state.isRecording)

        // 6. Complete 2 more laps
        stateMachine.handle(.crossStartFinish)
        stateMachine.handle(.crossStartFinish)
        XCTAssertEqual(lapsCompleted.count, 5)

        // 7. Manual stop
        stateMachine.handle(.manualStop)
        guard case .end(let session) = stateMachine.state else {
            XCTFail("Expected end state")
            return
        }
        XCTAssertEqual(session.lapCount, 5)
        XCTAssertNotNil(session.bestLapMs)

        // 8. Dismiss
        stateMachine.handle(.dismiss)
        guard case .disarmed = stateMachine.state else {
            XCTFail("Expected disarmed state")
            return
        }
    }

    // MARK: - State Change Callbacks
    func testStateChangeCallbacks() {
        var stateChanges: [(SessionState, SessionState)] = []
        stateMachine.onStateChange = { oldState, newState in
            stateChanges.append((oldState, newState))
        }

        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.handle(.manualStop)

        XCTAssertEqual(stateChanges.count, 3)
        XCTAssertEqual(stateChanges[0].0.name, "Disarmed")
        XCTAssertEqual(stateChanges[0].1.name, "Armed")
        XCTAssertEqual(stateChanges[1].0.name, "Armed")
        XCTAssertEqual(stateChanges[1].1.name, "Recording")
        XCTAssertEqual(stateChanges[2].0.name, "Recording")
        XCTAssertEqual(stateChanges[2].1.name, "Ended")
    }

    // MARK: - Best Lap Tracking
    func testBestLapTracking() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)

        // Simulate varying lap times
        // (In reality, these would be based on actual time, but we're testing the logic)
        stateMachine.handle(.manualMarkLap)
        Thread.sleep(forTimeInterval: 0.05)
        stateMachine.handle(.manualMarkLap)
        Thread.sleep(forTimeInterval: 0.03)
        stateMachine.handle(.manualMarkLap)

        guard case .recording(let session, _, _) = stateMachine.state else {
            XCTFail("Expected recording state")
            return
        }

        XCTAssertEqual(session.lapCount, 3)
        XCTAssertNotNil(session.bestLapMs)
        XCTAssertNotNil(session.bestLap)
    }

    // MARK: - Invalid Transitions (Should Be Ignored)
    func testInvalidTransitionsIgnored() {
        // Try to stop when disarmed
        stateMachine.handle(.manualStop)
        guard case .disarmed = stateMachine.state else {
            XCTFail("Should remain disarmed")
            return
        }

        // Try to pause when armed
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualPause)
        XCTAssertTrue(stateMachine.state.isArmed)

        // Try to resume when not paused
        stateMachine.handle(.manualStart)
        stateMachine.handle(.resume)
        XCTAssertTrue(stateMachine.state.isRecording)
    }

    // MARK: - Reset
    func testReset() {
        stateMachine.handle(.arm(track: testTrack))
        stateMachine.handle(.manualStart)
        stateMachine.reset()

        guard case .disarmed = stateMachine.state else {
            XCTFail("Expected disarmed state after reset")
            return
        }
    }
}
