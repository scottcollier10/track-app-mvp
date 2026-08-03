// The golden seed fixture: the exact SQL buildSeedSql emits for a FIXED `now`
// and a fixed coach email, checked in as demo-seed.golden.sql and compared
// byte-for-byte by src/lib/__tests__/generate-demo-seed.test.ts.
//
// Regenerating is DELIBERATELY a separate command, never a jest -u flag:
//   cd web && npx tsx scripts/seed/golden-seed.ts
// See the header the fixture carries (GOLDEN_HEADER below) for why.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildSeedSql } from './generate-demo-seed';
import { SCENARIOS } from './demo-scenarios';

/** Wed 2026-07-22 — fixed, so the emitted weekend dates are a constant. */
export const GOLDEN_NOW = new Date('2026-07-22T12:00:00Z');
export const GOLDEN_COACH_EMAIL = 'coach@example.com';
export const GOLDEN_PATH = join(__dirname, 'demo-seed.golden.sql');

/**
 * Separates the human header from the generated body. The test compares the
 * WHOLE file, header included, so the header cannot rot unnoticed either.
 */
export const GOLDEN_MARKER = '-- ==== generated output begins below this line ====\n';

const GOLDEN_HEADER = `-- demo-seed.golden.sql — CHECKED-IN EXPECTED OUTPUT of buildSeedSql(SCENARIOS,
-- '${GOLDEN_COACH_EMAIL}', ${GOLDEN_NOW.toISOString()}). Not applied to any database, ever.
--
-- REGENERATING THIS FILE IS A DECISION, NOT A CHORE.
--
-- This is the script the repo owner pastes into the Supabase SQL editor against
-- PRODUCTION, with the dates and the coach email swapped for a real run. A diff
-- here is a diff in that script. Read it line by line and be able to say, for
-- every changed line, what it does to a production refresh — a reordered
-- statement, a dropped column, a widened DELETE and a swapped VALUES position
-- all look like ordinary churn in a diff and are none of them ordinary.
--
-- Do NOT re-record it to make a red test green. Re-record it only after you
-- have read the change and decided the new output is the one you want:
--
--   cd web && npx tsx scripts/seed/golden-seed.ts
--
-- This file pins the ARTIFACT. The invariants it cannot state on its own —
-- best_lap = min of the session's laps, laps belonging to the right session,
-- day INSERTs preceding the sessions that reference them — are asserted
-- separately in src/lib/__tests__/generate-demo-seed.test.ts. Both are load
-- bearing; neither replaces the other.
--
${GOLDEN_MARKER}`;

/** The full fixture contents: header + marker + generated SQL. */
export function renderGoldenFile(): string {
  return GOLDEN_HEADER + buildSeedSql(SCENARIOS, GOLDEN_COACH_EMAIL, GOLDEN_NOW);
}

function main() {
  writeFileSync(GOLDEN_PATH, renderGoldenFile());
  console.log(`Rewrote ${GOLDEN_PATH}`);
  console.log('READ THE DIFF. This is the script that gets pasted into the prod SQL editor.');
}

if (require.main === module) main();
