// Pinned so date tests mean the same thing on a laptop and in CI. It must be
// set HERE, in the real process before jest forks its workers: assigning
// process.env.TZ inside a test file hits jest's copy of process.env, so Node
// never calls tzset and the pin silently does nothing.
//
// Deliberately NOT UTC. Vercel and CI both run UTC, where a plain "YYYY-MM-DD"
// parsed as an instant happens to render as the right calendar day — so a UTC
// test bench cannot see the off-by-one-day class of bug at all (see
// formatTrackDate in src/lib/time.ts). America/Chicago is west of UTC and does.
process.env.TZ = 'America/Chicago';

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
