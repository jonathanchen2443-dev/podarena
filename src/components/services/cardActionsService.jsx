/**
 * cardActionsService — thin frontend wrappers for the cardActions backend function.
 *
 * Rules:
 * - Never directly call base44.entities.DeckCard.*
 * - Never perform complex multi-field DeckCard filters on the client
 * - All DeckCard mutations go through the backend
 * - Ownership and privacy are enforced server-side
 *
 * Response shape from backend:
 * Success: { ok: true, deckId, cards, summary: { totalCards, sectionCounts, isOwner, canEdit } }
 * Error:   { ok: false, code, message }
 */
import { base44 } from "@/api/base44Client";

/**
 * Search for MTG cards by partial name via Scryfall.
 * Returns normalized candidate cards (not yet saved to any deck).
 *
 * @param {string} query - Partial card name, min 2 chars
 * @returns {{ ok, cards, total }}
 */
export async function searchCards(query) {
  const res = await base44.functions.invoke("cardActions", {
    action: "searchCards",
    query,
  });
  return res.data;
}

/**
 * List all DeckCard rows for a deck, with summary metadata.
 * Enforces owner/public privacy server-side.
 *
 * @param {string} deckId
 * @returns {{ ok, deckId, cards, summary }}
 */
export async function listDeckCards(deckId) {
  const res = await base44.functions.invoke("cardActions", {
    action: "listDeckCards",
    deckId,
  });
  return res.data;
}

/**
 * Add a card to a deck (manual add).
 * Same printing + same finish increments quantity.
 * Same printing + different finish creates a separate row.
 * Recalculates deck_list_card_count.
 *
 * @param {string} deckId
 * @param {object} card           - normalizeScryfallCard result (printing-level)
 * @param {string} selectedFinish - "nonfoil" | "foil"
 * @returns {{ ok, deckId, cards, summary }}
 */
export async function addCardToDeck(deckId, card, selectedFinish) {
  const res = await base44.functions.invoke("cardActions", {
    action: "addCardToDeck",
    deckId,
    card,
    selected_finish: selectedFinish,
  });
  return res.data;
}

/**
 * Fetch all printings for a card by oracle_id.
 * Returns normalized printing objects including prices and finishes.
 *
 * @param {string} oracleId
 * @returns {{ ok, printings }}
 */
export async function getCardPrintings(oracleId) {
  const res = await base44.functions.invoke("cardActions", {
    action: "getCardPrintings",
    oracleId,
  });
  return res.data;
}

/**
 * Update the quantity of a specific DeckCard row.
 * quantity <= 0 deletes the row.
 * Recalculates deck_list_card_count.
 *
 * @param {string} deckCardId
 * @param {number} quantity
 * @returns {{ ok, deckId, cards, summary }}
 */
export async function updateCardQuantity(deckCardId, quantity) {
  const res = await base44.functions.invoke("cardActions", {
    action: "updateCardQuantity",
    deckCardId,
    quantity,
  });
  return res.data;
}

/**
 * Remove a specific DeckCard row from the deck.
 * Recalculates deck_list_card_count.
 *
 * @param {string} deckCardId
 * @returns {{ ok, deckId, cards, summary }}
 */
export async function removeCardFromDeck(deckCardId) {
  const res = await base44.functions.invoke("cardActions", {
    action: "removeCardFromDeck",
    deckCardId,
  });
  return res.data;
}

/**
 * Validate a deck against Commander rules (or applicable format).
 * Returns validation state, errors, warnings, and commander info.
 *
 * @param {string} deckId
 * @returns {{ ok, deckId, validation }}
 */
export async function validateDeck(deckId) {
  const res = await base44.functions.invoke("cardActions", {
    action: "validateDeck",
    deckId,
  });
  return res.data;
}

/**
 * Add the commander (from Deck entity) as a DeckCard row.
 * Creates or updates the commander row, recalculates count.
 *
 * @param {string} deckId
 * @returns {{ ok, deckId, cards, summary }}
 */
export async function addCommanderToDeckList(deckId) {
  const res = await base44.functions.invoke("cardActions", {
    action: "addCommanderToDeckList",
    deckId,
  });
  return res.data;
}