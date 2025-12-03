/**
 * Dynamic CSV Template Generator API
 * Generates unique CSV data on each request to prevent duplicates
 */

import { NextRequest, NextResponse } from 'next/server';

// Random name pools
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey',
  'Riley', 'Avery', 'Quinn', 'Skyler', 'Dakota',
  'Jamie', 'Cameron', 'Drew', 'Blake', 'Sage'
];

const LAST_NAMES = [
  'Chen', 'Rodriguez', 'Patel', 'Johnson', 'Williams',
  'Martinez', 'Lee', 'Garcia', 'Anderson', 'Taylor',
  'Brown', 'Davis', 'Wilson', 'Moore', 'Jackson'
];

const TRACKS = [
  'Laguna Seca',
  'Thunderhill Raceway',
  'Buttonwillow Raceway',
  'Sonoma Raceway',
  'Streets of Willow'
];

// Base lap times for each track (in milliseconds)
const TRACK_BASE_TIMES: Record<string, number> = {
  'Laguna Seca': 95000,      // ~1:35.000
  'Thunderhill Raceway': 125000, // ~2:05.000
  'Buttonwillow Raceway': 110000, // ~1:50.000
  'Sonoma Raceway': 105000,   // ~1:45.000
  'Streets of Willow': 85000  // ~1:25.000
};

/**
 * Generate random date within last 30 days
 */
function randomDate(): string {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Generate random driver name
 */
function randomDriverName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/**
 * Generate random track name
 */
function randomTrack(): string {
  return TRACKS[Math.floor(Math.random() * TRACKS.length)];
}

/**
 * Generate lap times with realistic variation
 */
function generateLapTimes(baseTime: number, lapCount: number): number[] {
  const times: number[] = [];
  
  for (let i = 0; i < lapCount; i++) {
    let variation: number;
    
    if (i === 0) {
      // First lap (cold tires): +2-4 seconds
      variation = 2000 + Math.random() * 2000;
    } else if (i === 1) {
      // Second lap (warming up): +1-2 seconds
      variation = 1000 + Math.random() * 1000;
    } else if (i >= lapCount - 2) {
      // Last 2 laps (degradation): +0.5-1.5 seconds
      variation = 500 + Math.random() * 1000;
    } else {
      // Peak laps: ±0.5 seconds
      variation = (Math.random() - 0.5) * 1000;
    }
    
    times.push(Math.round(baseTime + variation));
  }
  
  return times;
}

/**
 * Format timestamp for CSV
 */
function formatTimestamp(date: string, lapIndex: number, lapTimeMs: number): string {
  const baseDate = new Date(`${date}T18:00:00Z`);
  
  // Add cumulative lap times to base timestamp
  const cumulativeMs = lapIndex * lapTimeMs;
  const timestamp = new Date(baseDate.getTime() + cumulativeMs);
  
  return timestamp.toISOString();
}

/**
 * Generate RaceChrono CSV
 */
function generateRaceChronoCSV(): string {
  const date = randomDate();
  const driverName = randomDriverName();
  const trackName = randomTrack();
  const lapCount = 8 + Math.floor(Math.random() * 8); // 8-15 laps
  const baseTime = TRACK_BASE_TIMES[trackName];
  const lapTimes = generateLapTimes(baseTime, lapCount);
  
  const rows = ['session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source'];
  
  lapTimes.forEach((lapTime, index) => {
    const timestamp = formatTimestamp(date, index, lapTime);
    rows.push(`${date},${trackName},${driverName},${index + 1},${lapTime},${timestamp},RaceChrono`);
  });
  
  return rows.join('\n');
}

/**
 * Generate AiM CSV
 */
function generateAiMCSV(): string {
  const date = randomDate();
  const driverName = randomDriverName();
  const trackName = randomTrack();
  const lapCount = 8 + Math.floor(Math.random() * 8);
  const baseTime = TRACK_BASE_TIMES[trackName];
  const lapTimes = generateLapTimes(baseTime, lapCount);
  
  const rows = ['session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source'];
  
  lapTimes.forEach((lapTime, index) => {
    const timestamp = formatTimestamp(date, index, lapTime);
    rows.push(`${date},${trackName},${driverName},${index + 1},${lapTime},${timestamp},AiM`);
  });
  
  return rows.join('\n');
}

/**
 * Generate TrackAddict CSV
 */
function generateTrackAddictCSV(): string {
  const date = randomDate();
  const driverName = randomDriverName();
  const trackName = randomTrack();
  const lapCount = 8 + Math.floor(Math.random() * 8);
  const baseTime = TRACK_BASE_TIMES[trackName];
  const lapTimes = generateLapTimes(baseTime, lapCount);
  
  const rows = ['session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source'];
  
  lapTimes.forEach((lapTime, index) => {
    const timestamp = formatTimestamp(date, index, lapTime);
    rows.push(`${date},${trackName},${driverName},${index + 1},${lapTime},${timestamp},TrackAddict`);
  });
  
  return rows.join('\n');
}

/**
 * Generate Generic CSV
 */
function generateGenericCSV(): string {
  const date = randomDate();
  const driverName = randomDriverName();
  const trackName = randomTrack();
  const lapCount = 8 + Math.floor(Math.random() * 8);
  const baseTime = TRACK_BASE_TIMES[trackName];
  const lapTimes = generateLapTimes(baseTime, lapCount);
  
  const rows = ['session_date,track_name,driver_name,lap_number,lap_time_ms,timestamp,source'];
  
  lapTimes.forEach((lapTime, index) => {
    const timestamp = formatTimestamp(date, index, lapTime);
    rows.push(`${date},${trackName},${driverName},${index + 1},${lapTime},${timestamp},Generic`);
  });
  
  return rows.join('\n');
}

/**
 * API Route Handler
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { template: string } }
) {
  const template = params.template;
  
  let csv: string;
  let filename: string;
  
  switch (template) {
    case 'racechrono':
      csv = generateRaceChronoCSV();
      filename = 'track-app-racechrono-template.csv';
      break;
      
    case 'aim':
      csv = generateAiMCSV();
      filename = 'track-app-aim-template.csv';
      break;
      
    case 'trackaddict':
      csv = generateTrackAddictCSV();
      filename = 'track-app-trackaddict-template.csv';
      break;
      
    case 'generic':
      csv = generateGenericCSV();
      filename = 'track-app-generic-template.csv';
      break;
      
    default:
      return NextResponse.json(
        { error: 'Invalid template type' },
        { status: 400 }
      );
  }
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
