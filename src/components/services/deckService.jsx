/**
 * Deck Service — All deck CRUD operations.
 *
 * create/update now route through the `deckSave` backend function which
 * enforces the approved-host allowlist server-side (https-only, known hosts).
 * Client-side validation in DeckForm still runs for UX, but backend is the
 * authoritative gate — bypassing the client cannot circumvent it.
 *
 * delete still goes direct (ownership verified by entity RLS).
 * list/get still go direct (read-only, RLS-scoped).
 */
import { base44 } from "@/api/base44Client";

export async function listMyDecks(auth) {
  if (auth.isGuest || !auth.currentUser || !auth.currentUser.id) return [];
  return base44.entities.Deck.filter({ owner_id: auth.currentUser.id }, "-updated_date", 200);
}

export async function getMyDeckById(auth, deckId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Authentication required.");
  const results = await base44.entities.Deck.filter({ id: deckId });
  const deck = results[0];
  if (!deck) throw new Error("Deck not found.");
  if (deck.owner_id !== auth.currentUser.id) throw new Error("You do not own this deck.");
  return deck;
}

export async function createDeck(auth, payload) {
  if (auth.isGuest || !auth.currentUser) throw new Error("You must be logged in to create a deck.");

  const res = await base44.functions.invoke("deckSave", {
    action: "createDeck",
    name: payload.name,
    commander_name: payload.commander_name || "",
    commander_image_url: payload.commander_image_url || "",
    color_identity: payload.color_identity || [],
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    deck_format: payload.deck_format || "commander",
    external_deck_link: payload.external_deck_link || null,
    is_favorite: payload.is_favorite ?? false,
    show_deck_list_publicly: payload.show_deck_list_publicly ?? false,
  });

  if (res.data?.error) throw new Error(res.data.error);
  return res.data.deck;
}

export async function updateDeck(auth, deckId, payload) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Authentication required.");

  const res = await base44.functions.invoke("deckSave", {
    action: "updateDeck",
    deckId,
    name: payload.name,
    commander_name: payload.commander_name || "",
    commander_image_url: payload.commander_image_url || "",
    color_identity: payload.color_identity || [],
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    deck_format: payload.deck_format || "commander",
    external_deck_link: payload.external_deck_link || null,
    is_favorite: payload.is_favorite ?? false,
    show_deck_list_publicly: payload.show_deck_list_publicly ?? false,
  });

  if (res.data?.error) throw new Error(res.data.error);
  return res.data.deck;
}

export async function deleteDeck(auth, deckId) {
  const deck = await getMyDeckById(auth, deckId);
  if (deck.owner_id !== auth.currentUser.id) throw new Error("You do not have permission to delete this deck.");
  await base44.entities.Deck.delete(deckId);
}