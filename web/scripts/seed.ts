#!/usr/bin/env tsx

/**
 * Database Seeder CLI
 *
 * Usage:
 *   npm run seed                              # Small dataset (default)
 *   npm run seed -- --size=medium             # Medium dataset
 *   npm run seed -- --size=large --clear      # Large dataset, clear existing
 *   npm run seed -- --tracks-only             # Only seed tracks
 *   npm run seed -- --help                    # Show help
 */

import { seedDatabase, SeedOptions } from '../src/lib/seed/seeder';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CliArgs {
  size: 'small' | 'medium' | 'large';
  clear: boolean;
  tracksOnly: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    size: 'small',
    clear: false,
    tracksOnly: false,
    help: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--clear') {
      args.clear = true;
    } else if (arg === '--tracks-only') {
      args.tracksOnly = true;
    } else if (arg.startsWith('--size=')) {
      const size = arg.split('=')[1];
      if (size === 'small' || size === 'medium' || size === 'large') {
        args.size = size;
      } else {
        console.error(`❌ Invalid size: ${size}. Must be small, medium, or large.`);
        process.exit(1);
      }
    } else if (arg.startsWith('-')) {
      console.error(`❌ Unknown argument: ${arg}`);
      console.error('   Run with --help to see available options');
      process.exit(1);
    }
  }

  return args;
}

function showHelp() {
  console.log(`
🌱 Track App Database Seeder

Generate realistic demo data for Track App without exposing real user data.

USAGE:
  npm run seed [options]

OPTIONS:
  --size=SIZE        Dataset size: small, medium, or large (default: small)
  --clear            Clear existing data before seeding
  --tracks-only      Only seed tracks (skip drivers, sessions, laps)
  --help, -h         Show this help message

DATASET SIZES:
  small              5 tracks, 8 drivers, ~15 sessions, ~90-120 laps
  medium             10 tracks, 20 drivers, ~50 sessions, ~300-400 laps
  large              15 tracks, 50 drivers, ~200 sessions, ~1500-2000 laps

EXAMPLES:
  npm run seed
    Seed a small dataset (default)

  npm run seed -- --size=medium
    Seed a medium dataset

  npm run seed -- --size=large --clear
    Clear existing data and seed a large dataset

  npm run seed -- --tracks-only
    Only seed tracks (useful for initial setup)

PREDEFINED SCRIPTS:
  npm run seed:small         Equivalent to: npm run seed
  npm run seed:medium        Equivalent to: npm run seed -- --size=medium --clear
  npm run seed:large         Equivalent to: npm run seed -- --size=large --clear

NOTES:
  - The seeder is idempotent: tracks won't be duplicated on re-runs
  - Sessions and laps will be added on each run unless --clear is used
  - Generated data includes realistic lap time patterns and variations
  - All driver names and emails are fictional
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏁 TRACK APP DATABASE SEEDER');
  console.log('═══════════════════════════════════════════════════════════');

  const options: SeedOptions = {
    size: args.size,
    clearExisting: args.clear,
    tracksOnly: args.tracksOnly,
  };

  try {
    const result = await seedDatabase(options);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('  ❌ SEED FAILED');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');

    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the seeder
main();
