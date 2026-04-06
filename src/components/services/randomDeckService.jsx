/**
 * randomDeckService — service wrapper for the randomDeckPicker backend function.
 *
 * Architecture:
 *  - All deck-pool logic (auth, profile resolution, eligibility filtering) lives
 *    in the backend function. This service is a thin client wrapper.
 *  - The "no 3 in a row" consecutive-repeat guard is intentionally client-side:
 *    it is pure session-local UI memory with no persistence requirement.
 *    The guard passes `excludeId` to the backend so selection is still server-side.
 *
 * Public API:
 *  - checkHasEligibleDecks()   → Promise<boolean>   (call on page load)
 *  - pickRandomDeck()          → Promise<{ deck: object|null, empty: boolean }>
 *  - resetPickState()          → void
 */
import { base44 } from "@/api/base44Client";

// Session-local guard state
let _lastPickedId = null;
let _consecutiveCount = 0;

/**
 * checkHasEligibleDecks — asks the backend for the deck count without performing
 * a pick. Used on page load so the UI can show the empty state before any interaction.
 *
 * @returns {Promise<boolean>}
 */
export async function checkHasEligibleDecks() {
  const res = await base44.functions.invoke('randomDeckPicker', { mode: 'count' });
  if (res.data?.error) throw new Error(res.data.error);
  return (res.data?.count ?? 0) > 0;
}

/**
 * pickRandomDeck — requests a random deck from the backend, passing the current
 * guard exclusion id when applicable. Updates session-local streak state.
 *
 * Guard rule: if the same deck was returned twice in a row, exclude it from the
 * next pick. After sitting out one round it becomes eligible again. Skipped when
 * pool has only 1 deck (backend ignores excludeId when pool.length === 1).
 *
 * @returns {Promise<{ deck: object|null, empty: boolean }>}
 */
export async function pickRandomDeck() {
  // Pass excludeId when the guard is active
  const excludeId = (_consecutiveCount >= 2 && _lastPickedId) ? _lastPickedId : null;

  const payload = excludeId
    ? { mode: 'pick', excludeId }
    : { mode: 'pick' };

  const res = await base44.functions.invoke('randomDeckPicker', payload);
  if (res.data?.error) throw new Error(res.data.error);

  const deck = res.data?.deck ?? null;
  if (!deck) {
    _lastPickedId = null;
    _consecutiveCount = 0;
    return { deck: null, empty: true };
  }

  // Update streak state
  if (deck.id === _lastPickedId) {
    _consecutiveCount += 1;
  } else {
    _lastPickedId = deck.id;
    _consecutiveCount = 1;
  }

  return { deck, empty: false };
}

/** Reset streak state (e.g. on logout or explicit reset). */
export function resetPickState() {
  _lastPickedId = null;
  _consecutiveCount = 0;
}