/**
 * The Anthropic key check, and the one sentence both AI routes tell a coach
 * when it fails.
 *
 * A leaf on purpose: the check and the WORDING live here, the envelope does
 * not. The two routes answer in different shapes — `{ success: false, error }`
 * for session coaching (its card reads `success`), `{ error }` for the day
 * summary — and each logs under its own tag. Pulling the response in here would
 * force one of those two to change for no reason other than sharing a function.
 *
 * The placeholder branch is inherited verbatim from the two routes and kept:
 * a key that is present but a stand-in fails at the API with an auth error the
 * coach cannot act on, so it counts as absent here and gets the actionable
 * message instead.
 */

/** What a coach is told when the key is missing or a placeholder. */
export const ANTHROPIC_KEY_MISSING =
  'ANTHROPIC_API_KEY not configured. Please add your API key to .env.local';

/** The configured key, or null when there is nothing usable to call with. */
export function anthropicApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.includes('placeholder')) return null;
  return key;
}
