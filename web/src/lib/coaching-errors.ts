/**
 * The machine-readable half of the session-coaching route's error envelope.
 *
 * The envelope is unchanged — `{ success: false, error }` is still what every
 * failure answers with, and `error` is still the sentence a coach reads. `code`
 * rides ALONGSIDE it, for the one caller that has to branch.
 *
 * It exists because AICoachingCard used to branch on `data.error.includes('not
 * found')`, which is a match on another module's PROSE. The route's corruption
 * 500 once read "Track day not found for this session — data integrity issue",
 * so an unrecoverable data-integrity failure surfaced to the coach as the benign
 * "Session or laps not found" — a state nobody can act on, told in the words of
 * one they can retry. Renaming that string fixed the collision; it did not fix
 * the coupling, and the next 500 whose wording happens to contain "not found"
 * brings the bug straight back.
 *
 * So the card matches on something the route DELIBERATELY emits. Only the codes
 * a caller actually branches on live here: an unrecognised failure falls through
 * to `error`, which is the right answer for anything the UI has nothing special
 * to say about, and a code invented for a branch nobody wrote would just be a
 * second thing to keep in sync.
 *
 * A leaf on purpose — a route and a "use client" component both import it.
 */
export const COACHING_ERROR = {
  /** No usable ANTHROPIC_API_KEY. Configuration, not data. */
  apiKeyMissing: 'api_key_missing',
  /**
   * The session, or its laps, are genuinely absent. A benign miss the coach can
   * act on. NEVER carried by a data-integrity 500, which is the whole point.
   */
  notFound: 'not_found',
} as const;
