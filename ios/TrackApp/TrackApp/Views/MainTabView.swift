//
//  MainTabView.swift
//  TrackApp
//
//  Root TabView with Home, Sessions, and Profile tabs
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            SessionsListView()
                .tabItem {
                    Label("Sessions", systemImage: "flag.checkered")
                }
                .tag(1)

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(2)
        }
        .tint(.trackGreen)
    }
}

// MARK: - Preview
#Preview {
    MainTabView()
}
