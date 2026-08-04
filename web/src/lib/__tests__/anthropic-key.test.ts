/**
 * The key check both AI routes gate on.
 *
 * Small enough to look self-evident, which is why it is pinned: every branch
 * here is the difference between a coach reading an actionable "add your API
 * key to .env.local" and an Anthropic 401 surfacing as a failed generation they
 * will retry.
 */

import { ANTHROPIC_KEY_MISSING, anthropicApiKey } from '../anthropic-key';

const originalApiKey = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  // Deleted, not reassigned: `process.env.X = undefined` stores the STRING
  // "undefined", which this very function would then read as a usable key.
  if (originalApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }
});

describe('anthropicApiKey', () => {
  it('returns the configured key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';

    expect(anthropicApiKey()).toBe('sk-ant-real');
  });

  it('returns null when the variable is unset', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(anthropicApiKey()).toBeNull();
  });

  it('returns null for an empty value', () => {
    // A declared-but-blank var in .env.local is the same absence as no var.
    process.env.ANTHROPIC_API_KEY = '';

    expect(anthropicApiKey()).toBeNull();
  });

  it('counts a placeholder as absent', () => {
    // A stand-in key is present enough to pass a truthiness check and then
    // fails at the API with an auth error the coach cannot act on. Treating it
    // as missing is what gets them the message that names the fix.
    process.env.ANTHROPIC_API_KEY = 'sk-ant-your-placeholder-here';

    expect(anthropicApiKey()).toBeNull();
  });

  it('names the file the coach has to edit', () => {
    // The whole value of this string over a generic failure. Both routes render
    // it verbatim to the coach.
    expect(ANTHROPIC_KEY_MISSING).toContain('ANTHROPIC_API_KEY');
    expect(ANTHROPIC_KEY_MISSING).toContain('.env.local');
  });
});
