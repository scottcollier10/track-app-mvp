//
//  MainTabView.swift
//  TrackApp
//
//  Main tab view container with Home, Sessions, and Profile tabs
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Home Tab
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            // Sessions Tab
            SessionsView()
                .tabItem {
                    Label("Sessions", systemImage: "list.bullet")
                }
                .tag(1)

            // Profile Tab
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(2)
        }
    }
}

// MARK: - Sessions View (Placeholder)
struct SessionsView: View {
    var body: some View {
        NavigationStack {
            Text("Sessions view coming soon")
                .navigationTitle("Sessions")
        }
    }
}

// MARK: - Profile View (Placeholder)
struct ProfileView: View {
    var body: some View {
        NavigationStack {
            Text("Profile view coming soon")
                .navigationTitle("Profile")
        }
    }
}

// MARK: - Preview
#Preview {
    MainTabView()
}
