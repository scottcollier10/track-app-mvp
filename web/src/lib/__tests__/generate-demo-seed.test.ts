import { buildSeedSql, driverUuid, sessionUuid } from '../../../scripts/seed/generate-demo-seed';
import { SCENARIOS } from '../../../scripts/seed/demo-scenarios';

describe('uuid helpers', () => {
  it('are stable and namespaced', () => {
    expect(driverUuid(1)).toBe('dd000000-0000-4000-a000-000000000001');
    expect(sessionUuid(2, 3)).toBe('dd000000-0002-4000-a000-000000000003');
  });
});

describe('buildSeedSql', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const sql = buildSeedSql(SCENARIOS, 'coach@example.com', now);

  it('is deterministic for a fixed now', () => {
    expect(buildSeedSql(SCENARIOS, 'coach@example.com', now)).toBe(sql);
  });

  it('resolves coach by email, never a hard-coded id', () => {
    expect(sql).toContain("email = 'coach@example.com'");
    expect(sql).toContain('RAISE EXCEPTION'); // coach + track guards
  });

  it('is transactional and idempotent', () => {
    expect(sql.trim().startsWith('BEGIN;')).toBe(true);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');        // drivers, sessions
    expect(sql).toContain('ON CONFLICT (driver_id) DO UPDATE'); // driver_profiles
    expect(sql).toContain('DELETE FROM laps WHERE session_id IN'); // lap refresh
  });

  it('seeds every scenario with coach_id and correct totals', () => {
    for (const s of SCENARIOS) {
      expect(sql).toContain(s.name);
      expect(sql).toContain(s.email);
    }
    const kai = SCENARIOS[0];
    const latest = kai.sessions[kai.sessions.length - 1];
    const total = latest.lapTimesMs.reduce((a, b) => a + b, 0);
    const best = Math.min(...latest.lapTimesMs);
    expect(sql).toContain(String(total));
    expect(sql).toContain(String(best));
  });
});
