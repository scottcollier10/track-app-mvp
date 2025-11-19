# Database Seeder

Generate realistic demo data for Track App without exposing real user data.

## Overview

The database seeder creates realistic demo data including:
- Racing tracks (famous circuits)
- Drivers (fictional but realistic names)
- Sessions (practice sessions with realistic dates)
- Laps (with realistic lap times and variation patterns)

All generated data follows realistic patterns:
- Lap times vary based on driver experience level
- First laps are slower (cold tires)
- Middle laps are most consistent
- Final laps show either improvement or tire degradation
- No identical lap times
- Consistency varies by driver skill level

## Quick Start

```bash
# Default: Small dataset
npm run seed

# Medium dataset (clears existing data first)
npm run seed:medium

# Large dataset (clears existing data first)
npm run seed:large
```

## Commands

### Basic Commands

```bash
# Seed with default small dataset
npm run seed

# Seed with specific size
npm run seed -- --size=small
npm run seed -- --size=medium
npm run seed -- --size=large

# Clear existing data before seeding
npm run seed -- --clear

# Only seed tracks (skip drivers and sessions)
npm run seed -- --tracks-only

# Show help
npm run seed -- --help
```

### Predefined Scripts

```bash
npm run seed:small   # Small dataset (default)
npm run seed:medium  # Medium dataset + clear existing
npm run seed:large   # Large dataset + clear existing
```

## Dataset Sizes

### Small (Demo/Testing)
**Best for:** Quick testing, development, CI/CD

- **Tracks:** 5 circuits
- **Drivers:** 8 drivers
- **Sessions:** ~15 sessions (2-3 per driver)
- **Laps:** ~90-120 total laps

**Run time:** ~5-10 seconds

### Medium (Realistic Demo)
**Best for:** Product demos, realistic testing

- **Tracks:** 10 circuits
- **Drivers:** 20 drivers
- **Sessions:** ~50 sessions
- **Laps:** ~300-400 total laps

**Run time:** ~15-30 seconds

### Large (Stress Testing)
**Best for:** Performance testing, analytics validation

- **Tracks:** 15 circuits
- **Drivers:** 50 drivers
- **Sessions:** ~200 sessions
- **Laps:** ~1500-2000 total laps

**Run time:** ~60-90 seconds

## What Data Is Generated

### Tracks

Famous racing circuits with accurate data:
- Laguna Seca, Sonoma Raceway, Thunderhill Raceway
- Buttonwillow, Streets of Willow, Willow Springs
- Circuit of the Americas, Road Atlanta, Watkins Glen
- Plus more (up to 15 tracks)

Each track includes:
- Accurate track length (meters)
- Location
- Configuration name
- Realistic typical lap times

### Drivers

Fictional drivers with realistic characteristics:
- Realistic names (combinations of common first/last names)
- Unique email addresses (`@trackapp.demo`)
- Experience levels: beginner, intermediate, advanced
- Driver profiles tracking total sessions

### Sessions

Practice sessions with realistic patterns:
- Dates spread over the last 30 days
- Random time of day (8 AM - 6 PM)
- 5-14 laps per session (typical practice session length)
- Total session time calculated from lap times
- Best lap time tracked

### Laps

Lap times follow realistic patterns:

**First Lap:**
- 8-18% slower than typical (cold tires, learning the line)

**Middle Laps:**
- Most consistent
- Variation based on driver skill:
  - High consistency: ±1.5%
  - Medium consistency: ±3.5%
  - Low consistency: ±6.5%

**Final Laps:**
- 60% chance of improvement (faster final lap)
- 40% chance of degradation (slower final lap)

**Experience Level Effects:**
- Beginner: 15% slower than base time, lower consistency
- Intermediate: 5% slower than base time, medium consistency
- Advanced: 2% faster than base time, higher consistency

**Additional Realism:**
- No two laps are identical (random micro-variations)
- Progressive improvement patterns for improving drivers
- Realistic sector data (future enhancement)

## Idempotency

The seeder is designed to be idempotent:

- **Tracks:** Won't create duplicates. Existing tracks by name are skipped.
- **Drivers:** New drivers created each run (unless `--clear` is used)
- **Sessions:** New sessions created each run (unless `--clear` is used)
- **Laps:** Associated with their sessions

### Re-running the Seeder

```bash
# Add more data without removing existing
npm run seed

# Start fresh (recommended for consistent demo data)
npm run seed -- --clear
```

## Clearing Data

To completely clear the database and start fresh:

```bash
npm run seed -- --clear --size=medium
```

Or use the predefined clear scripts:
```bash
npm run seed:medium  # Clears existing data first
npm run seed:large   # Clears existing data first
```

## Use Cases

### Initial Setup
```bash
# Set up tracks only, then manually add drivers
npm run seed -- --tracks-only
```

### Development
```bash
# Quick seed for development
npm run seed
```

### Demo Preparation
```bash
# Create realistic demo data
npm run seed:medium
```

### Performance Testing
```bash
# Generate large dataset
npm run seed:large
```

### Testing Filters/Analytics
```bash
# Create diverse dataset with multiple tracks and drivers
npm run seed -- --size=medium
```

## Implementation Details

### File Structure

```
web/
├── scripts/
│   ├── seed.ts              # CLI script
│   └── README.md            # This file
└── src/lib/seed/
    ├── seeder.ts            # Main seeding logic
    └── generators.ts        # Data generation utilities
```

### Key Functions

**`seedDatabase(options)`** (`seeder.ts`)
- Main entry point for seeding
- Orchestrates track, driver, and session creation
- Returns summary of created data

**`generateRealisticLapTimes(baseTime, count, options)`** (`generators.ts`)
- Generates lap times with realistic patterns
- Accounts for experience level, consistency, improvement
- Ensures variation and no duplicates

**`generateDriverName(usedNames)`** (`generators.ts`)
- Creates realistic but fictional driver names
- Prevents duplicates within a seed run

## Environment Requirements

The seeder requires the following environment variables (from `.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Make sure your Supabase database has:
- All tables created (tracks, drivers, sessions, laps, etc.)
- Row Level Security policies set appropriately
- Database migrations applied

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Check that `.env.local` exists in the `web/` directory
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

### Error: "Failed to insert..."
- Check Supabase connection
- Verify database migrations are applied
- Check RLS policies allow inserts

### Seeder runs but no data appears
- Check Supabase dashboard to verify data was inserted
- Verify RLS policies allow reading the data
- Check that the correct database is being used

### "tsx: command not found"
```bash
# Install tsx if missing
npm install --save-dev tsx
```

## Examples

### Create Small Demo Dataset
```bash
npm run seed:small
```

### Reset and Create Medium Dataset
```bash
npm run seed:medium
```

### Add More Sessions to Existing Data
```bash
npm run seed -- --size=small
```

### Only Add Tracks
```bash
npm run seed -- --tracks-only
```

## Data Privacy

All generated data is completely fictional:
- Driver names are random combinations
- Email addresses use `@trackapp.demo` domain
- No real user data is included
- Safe for demos, screenshots, and sharing

## Future Enhancements

Potential improvements:
- Sector time data generation
- Weather conditions
- Tire compound selection
- Session types (practice, qualifying, race)
- Coaching notes generation
- Team/organization affiliations
- Vehicle information
- Custom track creation

## Contributing

When modifying the seeder:
1. Ensure idempotency is maintained
2. Keep data generation realistic
3. Update this documentation
4. Test all dataset sizes
5. Verify no real user data is used
