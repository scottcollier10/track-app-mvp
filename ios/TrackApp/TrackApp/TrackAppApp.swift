//
//  TrackAppApp.swift
//  TrackApp
//
//  Main app entry point
//

import SwiftUI

@main
struct TrackAppApp: App {
    init() {
        // Print app directory path for debugging
        if let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            print("📁 App Documents Directory:")
            print(documentsPath.path)
        }
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
    }
}
