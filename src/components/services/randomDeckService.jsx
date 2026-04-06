/**
 * randomDeckService — client-side random deck selection with a consecutive-repeat guard.
 *
 * Fetches the user's eligible active decks directly (RLS ensures only their own decks
 * are returned) and performs random selection here so we can apply the guard cleanly.
 *
 * Guard rule: if the same deck was picked twice in a row, exclude it from the next
 * pick. After sitting out one selection cycle it becomes eligible again.
 *
 * Edge cases:
 *  - 0 eligible decks → returns { deck: null, empty: true }
 *  - 1 eligible deck  → guard does not apply; always returns that deck
 *  - 2 eligible decks → guard works correctly (other deck always chosen when guard fires)
 */
import { base44 } from "@/api/base44Client";

// Module-level state: consecutive pick tracking
let _lastPickedId = null;
let _consecutiveCount = 0;

/**
 * fetchEligibleDecks — returns all active decks owned by the current user's profile.
 * Throws on auth / profile errors.
 */
async function fetchEligibleDecks() {
  const user = await base44.auth.me();
  if (!user) throw new Error("Unauthorized");

  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!profiles || profiles.length === 0) throw new Error("Profile not found");
  const profileId = profiles[0].id;

  const decks = await base44.entities.Deck.filter(
    { owner_id: profileId, is_active: true },
    "-updated_date",
    200
  );
  return decks || [];
}

/**
 * pickRandomDeck — fetches the eligible pool and returns a randomly selected deck,
 * applying the "no 3 in a row" consecutive-repeat guard.
 *
 * @returns {Promise<{ deck: object|null, empty: boolean }>}
 */
export async function pickRandomDeck() {
  const allDecks = await fetchEligibleDecks();

  if (allDecks.length === 0) {
    _lastPickedId = null;
    _consecutiveCount = 0;
    return { deck: null, empty: true };
  }

  // Build the candidate pool — apply guard only when > 1 deck available
  let pool = allDecks;
  if (allDecks.length > 1 && _consecutiveCount >= 2 && _lastPickedId) {
    const filtered = allDecks.filter((d) => d.id !== _lastPickedId);
    if (filtered.length > 0) pool = filtered;
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];

  // Update streak state
  if (picked.id === _lastPickedId) {
    _consecutiveCount += 1;
  } else {
    _lastPickedId = picked.id;
    _consecutiveCount = 1;
  }

  return { deck: picked, empty: false };
}

/** Reset streak state (e.g. on explicit reset or logout). */
export function resetPickState() {
  _lastPickedId = null;
  _consecutiveCount = 0;
}