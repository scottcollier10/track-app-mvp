# Data Model & Schema

## Overview

Track App uses a simple relational model with five main entities: Drivers, Tracks, Sessions, Laps, and Coaching Notes.

## Database Schema (Supabase/PostgreSQL)

### Table: `drivers`

Represents a driver who uses the app.

```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_email ON drivers(email);
```

**Fields:**
- `id`: Unique identifier
- `name`: Driver's display name
- `email`: Email address (used for login)
- `created_at`: Registration timestamp

---

### Table: `tracks`

Represents a racing circuit/track.

```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  length_meters INTEGER,
  config TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_name ON tracks(name);
```

**Fields:**
- `id`: Unique identifier
- `name`: Track name (e.g., "Laguna Seca")
- `location`: City/region (e.g., "Monterey, CA")
- `length_meters`: Track length in meters (optional)
- `config`: Configuration variant (e.g., "Full", "North", "South") - optional
- `created_at`: Creation timestamp

---

### Table: `sessions`

A driving session at a specific track.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  total_time_ms INTEGER NOT NULL,
  best_lap_ms INTEGER,
  source TEXT DEFAULT 'ios_app',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_driver ON sessions(driver_id);
CREATE INDEX idx_sessions_track ON sessions(track_id);
CREATE INDEX idx_sessions_date ON sessions(date DESC);
```

**Fields:**
- `id`: Unique identifier
- `driver_id`: Foreign key to drivers
- `track_id`: Foreign key to tracks
- `date`: Session date/time
- `total_time_ms`: Total recording time in milliseconds
- `best_lap_ms`: Best lap time in milliseconds (NULL if no complete laps)
- `source`: Data source (`ios_app`, `simulated`, `imported`)
- `created_at`: Creation timestamp

---

### Table: `laps`

Individual laps within a session.

```sql
CREATE TABLE laps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lap_number INTEGER NOT NULL,
  lap_time_ms INTEGER NOT NULL,
  sector_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, lap_number)
);

CREATE INDEX idx_laps_session ON laps(session_id);
CREATE INDEX idx_laps_time ON laps(lap_time_ms);
```

**Fields:**
- `id`: Unique identifier
- `session_id`: Foreign key to sessions
- `lap_number`: Lap number within session (1-indexed)
- `lap_time_ms`: Lap time in milliseconds
- `sector_data`: Optional JSON with sector times (future enhancement)
  ```json
  {
    "sector1_ms": 28500,
    "sector2_ms": 32100,
    "sector3_ms": 29400
  }
  ```
- `created_at`: Creation timestamp

**Constraints:**
- Each session/lap_number combination must be unique

---

### Table: `coaching_notes`

Notes added by coaches to review sessions.

```sql
CREATE TABLE coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_session ON coaching_notes(session_id);
CREATE INDEX idx_notes_created ON coaching_notes(created_at DESC);
```

**Fields:**
- `id`: Unique identifier
- `session_id`: Foreign key to sessions
- `author`: Coach name or email
- `body`: Note content (markdown supported)
- `created_at`: Note timestamp

---

## Entity Relationships

```
drivers (1) ──────── (*) sessions
                          │
tracks  (1) ──────── (*) sessions
                          │
                          ├────── (*) laps
                          │
                          └────── (*) coaching_notes
```

- One driver has many sessions
- One track has many sessions
- One session has many laps
- One session has many coaching notes

---

## iOS Local Model (JSON)

The iOS app stores data locally as JSON files using these Swift models:

### Track
```swift
struct Track: Codable, Identifiable {
    let id: UUID
    let name: String
    let location: String?
    let lengthMeters: Int?
    let config: String?
}
```

### Session
```swift
struct Session: Codable, Identifiable {
    let id: UUID
    let trackId: UUID
    let date: Date
    var totalTimeMs: Int
    var bestLapMs: Int?
    var laps: [Lap]
}
```

### Lap
```swift
struct Lap: Codable, Identifiable {
    let id: UUID
    let lapNumber: Int
    let lapTimeMs: Int
    let sectorData: [String: Int]?
}
```

**Storage Location**: `Documents/TrackApp/`
- `tracks.json` - Array of Track objects
- `sessions/` - Directory with one JSON file per session (named by session ID)

---

## Data Flow

### iOS → Web Import

When a session is uploaded from iOS:

1. iOS serializes session as JSON:
```json
{
  "driver_email": "user@example.com",
  "track_id": "uuid-string",
  "date": "2024-01-15T14:30:00Z",
  "total_time_ms": 1200000,
  "best_lap_ms": 92500,
  "laps": [
    {"lap_number": 1, "lap_time_ms": 95000},
    {"lap_number": 2, "lap_time_ms": 92500}
  ]
}
```

2. Web API endpoint `/api/import-session`:
   - Looks up or creates driver by email
   - Validates track_id exists
   - Creates session record
   - Creates lap records
   - Returns session ID

3. iOS stores the server session ID for future sync

---

## Sample Data

### Seed Tracks
```sql
INSERT INTO tracks (id, name, location, length_meters, config) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Laguna Seca', 'Monterey, CA', 3602, 'Full'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Thunderhill', 'Willows, CA', 4830, '5-Mile'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Buttonwillow', 'Buttonwillow, CA', 2016, 'Configuration #13');
```

### Seed Driver
```sql
INSERT INTO drivers (id, name, email) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'Demo Driver', 'demo@trackapp.dev');
```

### Seed Session with Laps
```sql
-- Session
INSERT INTO sessions (id, driver_id, track_id, date, total_time_ms, best_lap_ms, source) VALUES
  ('750e8400-e29b-41d4-a716-446655440001',
   '650e8400-e29b-41d4-a716-446655440001',
   '550e8400-e29b-41d4-a716-446655440001',
   '2024-01-15 14:30:00+00',
   1200000,
   92500,
   'simulated');

-- Laps
INSERT INTO laps (session_id, lap_number, lap_time_ms) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 1, 95000),
  ('750e8400-e29b-41d4-a716-446655440001', 2, 92500),
  ('750e8400-e29b-41d4-a716-446655440001', 3, 93200),
  ('750e8400-e29b-41d4-a716-446655440001', 4, 94100);

-- Coaching Note
INSERT INTO coaching_notes (session_id, author, body) VALUES
  ('750e8400-e29b-41d4-a716-446655440001',
   'Coach Mike',
   'Great improvement on lap 2! Focus on carrying more speed through turn 6.');
```

---

## Indexes & Performance

**Query Patterns:**
- List sessions by driver (frequent): Index on `sessions.driver_id`
- List sessions by track (frequent): Index on `sessions.track_id`
- Recent sessions (dashboard): Index on `sessions.date DESC`
- Laps for session detail (frequent): Index on `laps.session_id`

**Estimated Volumes (per driver/year):**
- Sessions: ~50-100
- Laps: ~500-1000
- Coaching notes: ~50-200

Performance should be excellent with these indexes and UUID primary keys.

---

## Future Schema Enhancements

**Planned additions:**
- `session_weather` table (temperature, conditions)
- `session_vehicle` (car info)
- `lap_telemetry` (GPS points, throttle/brake data)
- `sector_definitions` (geofence coordinates per track)
- `user_roles` (driver vs coach permissions)

For MVP, keep schema simple and proven.
