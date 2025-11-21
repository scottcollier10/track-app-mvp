//
//  TrackAppApp.swift
//  TrackApp
//
//  Main app entry point
//

import SwiftUI

@main
struct TrackAppXApp: App {
    init() {
        // (optional) keep this print if you like seeing the documents path
        if let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            print("# App Documents Directory:")
            print(documentsPath.path)
        }
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
    }
}

