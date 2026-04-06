/**
 * randomDeckService — centralized logic for the Random Deck Picker feature.
 *
 * Deck eligibility:
 *   - Owned by the current user (owner_id === currentUser.id)
 *   - is_active === true
 *   - Format: Commander (all decks qualify for now — locked to Commander format)
 *
 * Random selection is done here, not in the UI.
 */
import { base44 } from "@/api/base44Client";

/**
 * pickRandomDeck — fetches the user's eligible active decks and returns one at random.
 *
 * @param {object} auth  — the auth context object (must have currentUser.id)
 * @returns {Promise<object|null>}  — a Deck entity or null if no eligible decks exist
 */
export async function pickRandomDeck(auth) {
  if (!auth?.currentUser?.id) return null;

  const allDecks = await base44.entities.Deck.filter(
    { owner_id: auth.currentUser.id, is_active: true },
    "-updated_date",
    200
  );

  if (!allDecks || allDecks.length === 0) return null;

  const idx = Math.floor(Math.random() * allDecks.length);
  return allDecks[idx];
}