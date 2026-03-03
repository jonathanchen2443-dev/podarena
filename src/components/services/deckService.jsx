/**
 * Deck Service - All deck CRUD operations with permission enforcement.
 */
import { base44 } from "@/api/base44Client";
import { canCreateDeck, canEditDeck } from "@/components/services/permissionService";

export async function listMyDecks(auth) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Authentication required.");
  // RLS filters by created_by (email); listing all owned decks works without extra filter
  return base44.entities.Deck.list("-updated_date", 200);
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
  if (!canCreateDeck(auth)) throw new Error("You must be logged in to create a deck.");
  return base44.entities.Deck.create({
    owner_id: auth.currentUser.id,
    name: payload.name,
    commander_name: payload.commander_name || "",
    commander_image_url: payload.commander_image_url || "",
    color_identity: payload.color_identity || [],
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    is_favorite: payload.is_favorite ?? false,
  });
}

export async function updateDeck(auth, deckId, payload) {
  const deck = await getMyDeckById(auth, deckId);
  if (!canEditDeck(auth, deck.owner_id)) throw new Error("You do not have permission to edit this deck.");
  return base44.entities.Deck.update(deckId, {
    name: payload.name,
    commander_name: payload.commander_name || "",
    commander_image_url: payload.commander_image_url || "",
    color_identity: payload.color_identity || [],
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    is_favorite: payload.is_favorite ?? deck.is_favorite ?? false,
  });
}

export async function deleteDeck(auth, deckId) {
  const deck = await getMyDeckById(auth, deckId);
  if (!canEditDeck(auth, deck.owner_id)) throw new Error("You do not have permission to delete this deck.");
  await base44.entities.Deck.delete(deckId);
}