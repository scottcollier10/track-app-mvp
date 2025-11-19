/**
 * Data Generators for Database Seeding
 *
 * Generates realistic demo data for Track App without exposing real user data
 */

// ============================================================================
// TRACK DATA
// ============================================================================

export interface SeedTrack {
  name: string;
  location: string;
  length_meters: number;
  config: string;
  // Typical lap time for this track (in milliseconds)
  typical_lap_ms: number;
}

/**
 * Famous racing circuits with realistic data
 * Includes typical lap times to generate realistic lap data
 */
export const SEED_TRACKS: SeedTrack[] = [
  {
    name: 'Laguna Seca',
    location: 'Monterey, CA',
    length_meters: 3602,
    config: 'Full',
    typical_lap_ms: 91000, // ~1:31
  },
  {
    name: 'Sonoma Raceway',
    location: 'Sonoma, CA',
    length_meters: 4023,
    config: 'Full',
    typical_lap_ms: 102000, // ~1:42
  },
  {
    name: 'Thunderhill Raceway',
    location: 'Willows, CA',
    length_meters: 4830,
    config: '5-Mile',
    typical_lap_ms: 128000, // ~2:08
  },
  {
    name: 'Buttonwillow Raceway',
    location: 'Buttonwillow, CA',
    length_meters: 2016,
    config: 'Configuration #13',
    typical_lap_ms: 68000, // ~1:08
  },
  {
    name: 'Streets of Willow',
    location: 'Rosamond, CA',
    length_meters: 2414,
    config: 'Full',
    typical_lap_ms: 78000, // ~1:18
  },
  {
    name: 'Willow Springs Raceway',
    location: 'Rosamond, CA',
    length_meters: 4023,
    config: 'Big Willow',
    typical_lap_ms: 95000, // ~1:35
  },
  {
    name: 'Auto Club Speedway',
    location: 'Fontana, CA',
    length_meters: 3218,
    config: 'Roval',
    typical_lap_ms: 105000, // ~1:45
  },
  {
    name: 'Chuckwalla Valley Raceway',
    location: 'Desert Center, CA',
    length_meters: 3902,
    config: 'Full',
    typical_lap_ms: 112000, // ~1:52
  },
  {
    name: 'The Ridge Motorsports Park',
    location: 'Shelton, WA',
    length_meters: 3840,
    config: 'Full',
    typical_lap_ms: 115000, // ~1:55
  },
  {
    name: 'Portland International Raceway',
    location: 'Portland, OR',
    length_meters: 3048,
    config: 'Full',
    typical_lap_ms: 89000, // ~1:29
  },
  {
    name: 'Circuit of the Americas',
    location: 'Austin, TX',
    length_meters: 5513,
    config: 'Full',
    typical_lap_ms: 138000, // ~2:18
  },
  {
    name: 'Road Atlanta',
    location: 'Braselton, GA',
    length_meters: 4088,
    config: 'Full',
    typical_lap_ms: 98000, // ~1:38
  },
  {
    name: 'Watkins Glen',
    location: 'Watkins Glen, NY',
    length_meters: 5430,
    config: 'Long Course',
    typical_lap_ms: 125000, // ~2:05
  },
  {
    name: 'Lime Rock Park',
    location: 'Lakeville, CT',
    length_meters: 2414,
    config: 'Full',
    typical_lap_ms: 72000, // ~1:12
  },
  {
    name: 'Barber Motorsports Park',
    location: 'Birmingham, AL',
    length_meters: 3830,
    config: 'Full',
    typical_lap_ms: 108000, // ~1:48
  },
];

// ============================================================================
// DRIVER NAME GENERATION
// ============================================================================

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Casey', 'Morgan', 'Riley',
  'Taylor', 'Jamie', 'Drew', 'Cameron', 'Quinn',
  'Blake', 'Avery', 'Sage', 'Reese', 'Parker',
  'Dakota', 'Rowan', 'Skyler', 'Jesse', 'River',
  'Phoenix', 'Kai', 'Charlie', 'Emerson', 'Finley',
  'Harper', 'Lennon', 'Mackenzie', 'Bailey', 'Dylan',
  'Elliot', 'Hayden', 'Kendall', 'Logan', 'Marley',
  'Nico', 'Payton', 'Remy', 'Sawyer', 'Tyler',
];

const LAST_NAMES = [
  'Anderson', 'Bennett', 'Carter', 'Davis', 'Edwards',
  'Foster', 'Garcia', 'Harrison', 'Irving', 'Jackson',
  'Kelly', 'Lewis', 'Martinez', 'Nelson', 'O\'Brien',
  'Peterson', 'Quinn', 'Rodriguez', 'Stevens', 'Thompson',
  'Underwood', 'Valdez', 'Williams', 'Xavier', 'Young',
  'Zhang', 'Abbott', 'Brooks', 'Collins', 'Dixon',
  'Ellis', 'Fisher', 'Graham', 'Hayes', 'James',
  'Knight', 'Lopez', 'Mitchell', 'Newman', 'Parker',
  'Reynolds', 'Sullivan', 'Turner', 'Vaughn', 'Watson',
  'Chen', 'Kim', 'Singh', 'Patel', 'Johnson',
];

/**
 * Generate a realistic driver name
 * Uses combination of first and last names to create realistic but fictional names
 */
export function generateDriverName(usedNames: Set<string> = new Set()): string {
  let name: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    name = `${firstName} ${lastName}`;
    attempts++;

    if (attempts >= maxAttempts) {
      // If we've tried too many times, add a number suffix
      name = `${name} ${Math.floor(Math.random() * 100)}`;
      break;
    }
  } while (usedNames.has(name));

  usedNames.add(name);
  return name;
}

/**
 * Generate a unique email for a driver
 */
export function generateDriverEmail(name: string): string {
  const normalized = name.toLowerCase()
    .replace(/['\s]/g, '.')
    .replace(/\.+/g, '.');

  // Add random number to ensure uniqueness
  const random = Math.floor(Math.random() * 10000);
  return `${normalized}.${random}@trackapp.demo`;
}

// ============================================================================
// LAP TIME GENERATION
// ============================================================================

export interface LapTimeOptions {
  consistency?: 'high' | 'medium' | 'low';
  improvement?: boolean;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Generate realistic lap times for a session
 *
 * Patterns:
 * - First lap: slower (cold tires, learning the line)
 * - Middle laps: most consistent
 * - Final laps: either faster (improvement) or slower (tire degradation)
 * - No identical times (realistic variation)
 * - Consistency varies by driver skill
 */
export function generateRealisticLapTimes(
  baseTime: number,
  count: number,
  options: LapTimeOptions = {}
): number[] {
  const {
    consistency = 'medium',
    improvement = Math.random() > 0.5,
    experienceLevel = 'intermediate',
  } = options;

  // Define consistency ranges (percentage variation from base)
  const consistencyRanges = {
    high: { base: 0.015, first: 0.08, last: 0.02 },      // ±1.5% typical, 8% first lap
    medium: { base: 0.035, first: 0.12, last: 0.04 },    // ±3.5% typical, 12% first lap
    low: { base: 0.065, first: 0.18, last: 0.08 },       // ±6.5% typical, 18% first lap
  };

  // Experience level affects base time
  const experienceLevelMultiplier = {
    beginner: 1.15,     // 15% slower than base
    intermediate: 1.05, // 5% slower than base
    advanced: 0.98,     // 2% faster than base
  };

  const adjustedBaseTime = baseTime * experienceLevelMultiplier[experienceLevel];
  const range = consistencyRanges[consistency];
  const times: number[] = [];

  for (let i = 0; i < count; i++) {
    let lapTime: number;

    if (i === 0) {
      // First lap: slower due to cold tires
      const firstLapVariation = range.first;
      lapTime = adjustedBaseTime * (1 + firstLapVariation * (0.5 + Math.random() * 0.5));
    } else if (i === count - 1 && count > 3) {
      // Last lap: depends on improvement flag
      if (improvement) {
        // Driver improved - faster final lap
        const bestTime = Math.min(...times);
        lapTime = bestTime * (0.98 + Math.random() * 0.01);
      } else {
        // Tire degradation - slower final lap
        lapTime = adjustedBaseTime * (1 + range.last * Math.random());
      }
    } else {
      // Middle laps: most consistent
      const progressFactor = improvement ? (1 - (i / count) * 0.03) : 1;
      const variation = (Math.random() - 0.5) * 2 * range.base;
      lapTime = adjustedBaseTime * progressFactor * (1 + variation);
    }

    // Add small random variation to prevent identical times
    lapTime = Math.round(lapTime + (Math.random() - 0.5) * 100);

    // Ensure positive time
    lapTime = Math.max(lapTime, baseTime * 0.5);

    times.push(lapTime);
  }

  return times;
}

/**
 * Generate a random number of laps for a session
 */
export function generateLapCount(
  sessionType: 'practice' | 'qualifying' | 'race' = 'practice'
): number {
  switch (sessionType) {
    case 'practice':
      return 5 + Math.floor(Math.random() * 10); // 5-14 laps
    case 'qualifying':
      return 3 + Math.floor(Math.random() * 5); // 3-7 laps
    case 'race':
      return 10 + Math.floor(Math.random() * 15); // 10-24 laps
    default:
      return 8 + Math.floor(Math.random() * 8); // 8-15 laps
  }
}

/**
 * Generate a random date within the last N days
 */
export function generateRecentDate(daysBack: number = 30): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysBack);
  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);

  // Set to a reasonable time (8 AM - 6 PM)
  const hour = 8 + Math.floor(Math.random() * 10);
  date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

  return date;
}

/**
 * Determine driver consistency level based on experience
 */
export function getConsistencyForExperience(
  experience: 'beginner' | 'intermediate' | 'advanced'
): 'high' | 'medium' | 'low' {
  const rand = Math.random();

  switch (experience) {
    case 'advanced':
      return rand < 0.7 ? 'high' : 'medium';
    case 'intermediate':
      return rand < 0.3 ? 'high' : rand < 0.8 ? 'medium' : 'low';
    case 'beginner':
      return rand < 0.2 ? 'medium' : 'low';
    default:
      return 'medium';
  }
}

/**
 * Generate random experience level
 */
export function generateExperienceLevel(): 'beginner' | 'intermediate' | 'advanced' {
  const rand = Math.random();
  if (rand < 0.25) return 'beginner';
  if (rand < 0.70) return 'intermediate';
  return 'advanced';
}
