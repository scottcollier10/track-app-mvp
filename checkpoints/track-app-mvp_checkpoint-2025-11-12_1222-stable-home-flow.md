# Safe Checkpoint – 2025-11-12_1222
Tag: checkpoint-2025-11-12_1222-stable-home-flow
Branch: savepoint/checkpoint-2025-11-12_1222-stable-home-flow
Commit: ca9616d

## Why
Stable UX (Start → Live → Summary). Keeping a clean restore point.

## Notable files
- Views/Home/HomeView.swift
- Views/LiveSession/LiveSessionView.swift
- Views/SessionSummary/SessionSummaryView.swift

## Diffstat since previous commit
```
 ios/TrackApp/TrackAppX/TrackAppX/TrackAppApp.swift |  9 ++-
 .../TrackAppX/ViewModels/HomeViewModel.swift       |  2 +-
 .../ViewModels/LiveSessionViewModel.swift          | 79 ++++++++-----------
 .../TrackAppX/TrackAppX/Views/Home/HomeView.swift  | 90 ++++++++++++----------
 .../Views/LiveSession/LiveSessionView.swift        |  4 +-
 5 files changed, 93 insertions(+), 91 deletions(-)
```
