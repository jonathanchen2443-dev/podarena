/**
 * cardActions — central DeckCard action layer for manual deck building.
 *
 * Supported actions:
 *   searchCards        — search Scryfall by partial name, return normalized candidates
 *   listDeckCards      — return all DeckCard rows for a deck with summary
 *   addCardToDeck      — add a card (manual), increment if duplicate by oracle_id
 *   updateCardQuantity — update quantity or delete at 0
 *   removeCardFromDeck — delete a specific DeckCard row
 *
 * All mutation actions:
 *   - verify deck ownership server-side
 *   - recalculate deck_list_card_count after writes
 *   - return the same consistent response shape
 *
 * Security:
 *   - Never trust client-supplied ownership data
 *   - All deck lookups use asServiceRole
 *   - Privacy checks enforced for reads
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Scryfall helpers ──────────────────────────────────────────────────────────

const SCRYFALL_HEADERS = {
  'User-Agent': 'PodArena/1.0',
  'Accept': 'application/json',
};

/**
 * Derive the best available images from a Scryfall card object.
 * Handles normal cards, double-faced, split, modal DFC, etc.
 */
function extractImages(card) {
  const uris = card.image_uris || card.card_faces?.[0]?.image_uris || {};
  return {
    image_small_url:    uris.small    || uris.normal || null,
    image_normal_url:   uris.normal   || uris.small  || null,
    image_art_crop_url: uris.art_crop || null,
  };
}

/**
 * Derive mana cost — prefer top-level, fall back to first face,
 * or join all faces' costs for split cards.
 */
function extractManaCost(card) {
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.[0]?.mana_cost) return card.card_faces[0].mana_cost;
  if (card.card_faces) {
    const joined = card.card_faces.map((f) => f.mana_cost || '').filter(Boolean).join(' // ');
    return joined || null;
  }
  return null;
}

/**
 * Derive type_line — prefer top-level, join faces for DFC.
 */
function extractTypeLine(card) {
  if (card.type_line) return card.type_line;
  if (card.card_faces) {
    return card.card_faces.map((f) => f.type_line || '').filter(Boolean).join(' // ');
  }
  return null;
}

/**
 * Derive oracle text — prefer top-level, join faces.
 */
function extractOracleText(card) {
  if (card.oracle_text != null) return card.oracle_text;
  if (card.card_faces) {
    return card.card_faces.map((f) => f.oracle_text || '').filter(Boolean).join('\n---\n');
  }
  return null;
}

/**
 * Classify section from type_line (mirrors deckImport.js logic, extended).
 */
function classifySection(typeLine, isCommander) {
  if (isCommander) return 'Commander';
  if (!typeLine) return 'Other';
  if (typeLine.includes('Land'))         return 'Lands';
  if (typeLine.includes('Creature'))     return 'Creatures';
  if (typeLine.includes('Planeswalker')) return 'Planeswalkers';
  if (typeLine.includes('Instant'))      return 'Instants';
  if (typeLine.includes('Sorcery'))      return 'Sorceries';
  if (typeLine.includes('Artifact'))     return 'Artifacts';
  if (typeLine.includes('Enchantment'))  return 'Enchantments';
  return 'Other';
}

/**
 * normalizeScryfallCard — convert raw Scryfall card into DeckCard-compatible shape.
 */
function normalizeScryfallCard(card, { isCommander = false, addedMethod = 'manual' } = {}) {
  const typeLine   = extractTypeLine(card);
  const images     = extractImages(card);
  const manaCost   = extractManaCost(card);
  const oracleText = extractOracleText(card);
  const section    = classifySection(typeLine, isCommander);

  return {
    scryfall_id:        card.id          || null,
    oracle_id:          card.oracle_id   || null,
    card_name:          card.name        || '',
    mana_cost:          manaCost,
    cmc:                card.cmc         ?? null,
    type_line:          typeLine,
    colors:             card.colors      || card.card_faces?.[0]?.colors || [],
    color_identity:     card.color_identity || [],
    legalities:         card.legalities  || {},
    image_small_url:    images.image_small_url,
    image_normal_url:   images.image_normal_url,
    image_art_crop_url: images.image_art_crop_url,
    set_code:           card.set         || null,
    set_name:           card.set_name    || null,
    collector_number:   card.collector_number || null,
    rarity:             card.rarity      || null,
    oracle_text:        oracleText,
    layout:             card.layout      || null,
    section,
    is_commander:       isCommander,
    enrichment_status:  'enriched',
    added_method:       addedMethod,
  };
}

// ── Section ordering (mirrors DeckListTab) ────────────────────────────────────

const SECTION_ORDER = [
  'Commander', 'Companion',
  'Creatures', 'Creature',
  'Planeswalkers', 'Planeswalker',
  'Instants', 'Instant',
  'Sorceries', 'Sorcery',
  'Artifacts', 'Artifact',
  'Enchantments', 'Enchantment',
  'Lands', 'Land',
  'Mainboard', 'Sideboard', 'Other',
];

function sectionSortKey(section) {
  const idx = SECTION_ORDER.indexOf(section);
  return idx === -1 ? 99 : idx;
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const sectionDiff = sectionSortKey(a.section || 'Other') - sectionSortKey(b.section || 'Other');
    if (sectionDiff !== 0) return sectionDiff;
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.card_name || '').localeCompare(b.card_name || '');
  });
}

// ── deck_list_card_count recalculation ────────────────────────────────────────

/**
 * Recalculate deck_list_card_count from all DeckCard rows (import + manual + scan).
 * Updates the Deck entity.
 */
async function recalculateDeckCardCount(base44, deckId) {
  const allCards = await base44.asServiceRole.entities.DeckCard.filter(
    { deck_id: deckId }, 'sort_order', 500
  );
  const total = allCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
  await base44.asServiceRole.entities.Deck.update(deckId, {
    deck_list_card_count: total,
  });
  return total;
}

// ── Build standard list response shape ───────────────────────────────────────

function buildListResponse(deckId, cards, isOwner) {
  const sorted = sortCards(cards);
  const totalCards = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);

  const sectionCounts = {};
  for (const card of cards) {
    const sec = card.section || 'Other';
    sectionCounts[sec] = (sectionCounts[sec] || 0) + (card.quantity || 1);
  }

  return {
    ok: true,
    deckId,
    cards: sorted,
    summary: {
      totalCards,
      sectionCounts,
      isOwner,
      canEdit: isOwner,
    },
  };
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function errResponse(code, message, status = 400) {
  return { json: { ok: false, code, message }, status };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Auth gate — all actions require authentication
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
    }

    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
    }

    // Resolve caller profile (needed for ownership checks)
    const profileRows = await base44.asServiceRole.entities.Profile.filter({ user_id: me.id });
    const profile = profileRows[0] || null;
    if (!profile) {
      return Response.json({ ok: false, code: 'PROFILE_NOT_FOUND', message: 'Profile not found.' }, { status: 404 });
    }

    // ── ACTION: searchCards ───────────────────────────────────────────────────
    if (action === 'searchCards') {
      const query = (body.query || '').trim();
      if (query.length < 2) {
        return Response.json({ ok: false, code: 'QUERY_TOO_SHORT', message: 'Search query must be at least 2 characters.' });
      }

      // Sanitize: collapse whitespace, strip characters that could break Scryfall query syntax
      const safeQuery = query.replace(/\s+/g, ' ').replace(/["\\]/g, '');

      // Step A — fuzzy/exact named lookup: returns the single best match for the query.
      // This is what makes "Sol Ring" → Sol Ring first.
      let fuzzyCard = null;
      try {
        const fuzzyRes = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(safeQuery)}`,
          { headers: SCRYFALL_HEADERS }
        );
        if (fuzzyRes.ok) {
          const data = await fuzzyRes.json();
          if (data?.object === 'card') fuzzyCard = normalizeScryfallCard(data);
        }
        // 404 = no match found — not an error, just no fuzzy result
      } catch {
        // Non-fatal: continue to name search
      }

      // Step B — name-prefix search using Scryfall name:"..." syntax.
      // This surfaces cards whose name contains/starts-with the query terms.
      let nameResults = [];
      try {
        const nameQuery = `name:"${safeQuery}"`;
        const nameRes = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(nameQuery)}&unique=cards&order=name`,
          { headers: SCRYFALL_HEADERS }
        );
        if (nameRes.ok) {
          const data = await nameRes.json();
          nameResults = (data.data || []).map((c) => normalizeScryfallCard(c));
        }
        // 404 = no matches — not an error
      } catch {
        // Non-fatal: continue with whatever we have
      }

      // Step C — fallback: if both steps returned nothing, try a broader name: search
      // using individual words (handles partial-word queries like "sol r")
      if (!fuzzyCard && nameResults.length === 0) {
        try {
          const words = safeQuery.split(' ').filter(Boolean);
          // Build a query that requires each word to appear in the name
          const broadQuery = words.map((w) => `name:${w}`).join(' ');
          const broadRes = await fetch(
            `https://api.scryfall.com/cards/search?q=${encodeURIComponent(broadQuery)}&unique=cards&order=name`,
            { headers: SCRYFALL_HEADERS }
          );
          if (broadRes.ok) {
            const data = await broadRes.json();
            nameResults = (data.data || []).map((c) => normalizeScryfallCard(c));
          }
        } catch {
          // Non-fatal
        }
      }

      // Step D — merge and deduplicate.
      // Fuzzy result goes first; name results follow, deduped by oracle_id then scryfall_id.
      const seen = new Set();
      const merged = [];

      function addCard(c) {
        const key = c.oracle_id || c.scryfall_id;
        if (key && seen.has(key)) return;
        if (key) seen.add(key);
        merged.push(c);
      }

      if (fuzzyCard) addCard(fuzzyCard);
      for (const c of nameResults) addCard(c);

      // Cap at 20
      const candidates = merged.slice(0, 20);

      if (candidates.length === 0) {
        return Response.json({ ok: true, cards: [], total: 0 });
      }

      return Response.json({ ok: true, cards: candidates, total: candidates.length });
    }

    // ── ACTION: listDeckCards ─────────────────────────────────────────────────
    if (action === 'listDeckCards') {
      const { deckId } = body;
      if (!deckId) {
        return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckId is required.' });
      }

      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) {
        return Response.json({ ok: false, code: 'DECK_NOT_FOUND', message: 'Deck not found.' }, { status: 404 });
      }

      const isOwner = deck.owner_id === profile.id;

      // Privacy check
      if (!isOwner && !deck.show_deck_list_publicly) {
        return Response.json({ ok: false, code: 'DECK_PRIVATE', message: 'This deck list is private.' }, { status: 403 });
      }

      const cards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckId }, 'sort_order', 500
      );

      return Response.json(buildListResponse(deckId, cards, isOwner));
    }

    // ── ACTION: addCardToDeck ─────────────────────────────────────────────────
    if (action === 'addCardToDeck') {
      const { deckId, card } = body;
      if (!deckId || !card) {
        return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckId and card are required.' });
      }

      // Ownership check
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) {
        return Response.json({ ok: false, code: 'DECK_NOT_FOUND', message: 'Deck not found.' }, { status: 404 });
      }
      if (deck.owner_id !== profile.id) {
        return Response.json({ ok: false, code: 'FORBIDDEN', message: 'You do not own this deck.' }, { status: 403 });
      }

      // Normalize the incoming card (client sends a normalizeScryfallCard result)
      const cardName = (card.card_name || '').trim();
      if (!cardName) {
        return Response.json({ ok: false, code: 'INVALID_CARD', message: 'Card name is required.' });
      }

      // Load existing cards for duplicate detection
      const existingCards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckId }, 'sort_order', 500
      );

      // Duplicate detection: prefer oracle_id match, fall back to normalized card_name
      const incomingOracleId = card.oracle_id || null;
      const incomingNameLc = cardName.toLowerCase();

      let matchedCard = null;
      if (incomingOracleId) {
        matchedCard = existingCards.find((c) => c.oracle_id === incomingOracleId) || null;
      }
      if (!matchedCard) {
        matchedCard = existingCards.find((c) => (c.card_name || '').toLowerCase() === incomingNameLc) || null;
      }

      if (matchedCard) {
        // Increment quantity on the existing row
        const newQty = (matchedCard.quantity || 1) + 1;
        await base44.asServiceRole.entities.DeckCard.update(matchedCard.id, { quantity: newQty });
      } else {
        // Determine sort_order as max existing + 1
        const maxSortOrder = existingCards.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
        const newCard = {
          deck_id: deckId,
          card_name: cardName,
          quantity: 1,
          sort_order: maxSortOrder + 1,
          // Carry all normalized fields from the incoming card, but force added_method: "manual"
          scryfall_id:        card.scryfall_id        || null,
          oracle_id:          card.oracle_id          || null,
          mana_cost:          card.mana_cost          || null,
          cmc:                card.cmc                ?? null,
          type_line:          card.type_line          || null,
          colors:             card.colors             || [],
          color_identity:     card.color_identity     || [],
          legalities:         card.legalities         || {},
          image_small_url:    card.image_small_url    || null,
          image_normal_url:   card.image_normal_url   || null,
          image_art_crop_url: card.image_art_crop_url || null,
          set_code:           card.set_code           || null,
          set_name:           card.set_name           || null,
          collector_number:   card.collector_number   || null,
          rarity:             card.rarity             || null,
          oracle_text:        card.oracle_text        || null,
          layout:             card.layout             || null,
          section:            card.section            || 'Other',
          is_commander:       card.is_commander       || false,
          enrichment_status:  card.enrichment_status  || 'enriched',
          added_method:       'manual',
        };
        await base44.entities.DeckCard.create(newCard);
      }

      // Recalculate count
      await recalculateDeckCardCount(base44, deckId);

      // Return refreshed list
      const updatedCards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckId }, 'sort_order', 500
      );
      return Response.json(buildListResponse(deckId, updatedCards, true));
    }

    // ── ACTION: updateCardQuantity ────────────────────────────────────────────
    if (action === 'updateCardQuantity') {
      const { deckCardId, quantity } = body;
      if (!deckCardId || quantity === undefined || quantity === null) {
        return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckCardId and quantity are required.' });
      }

      // Load the DeckCard
      const cardRows = await base44.asServiceRole.entities.DeckCard.filter({ id: deckCardId });
      const deckCard = cardRows[0] || null;
      if (!deckCard) {
        return Response.json({ ok: false, code: 'CARD_NOT_FOUND', message: 'Card not found.' }, { status: 404 });
      }

      // Ownership check via parent deck
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckCard.deck_id });
      const deck = deckRows[0] || null;
      if (!deck || deck.owner_id !== profile.id) {
        return Response.json({ ok: false, code: 'FORBIDDEN', message: 'You do not own this deck.' }, { status: 403 });
      }

      const qty = Number(quantity);
      if (isNaN(qty)) {
        return Response.json({ ok: false, code: 'INVALID_QUANTITY', message: 'Quantity must be a number.' });
      }
      if (qty > 999) {
        return Response.json({ ok: false, code: 'INVALID_QUANTITY', message: 'Quantity cannot exceed 999.' });
      }

      if (qty <= 0) {
        // Delete the row
        await base44.asServiceRole.entities.DeckCard.delete(deckCardId);
      } else {
        await base44.asServiceRole.entities.DeckCard.update(deckCardId, { quantity: qty });
      }

      // Recalculate count
      await recalculateDeckCardCount(base44, deckCard.deck_id);

      // Return refreshed list
      const updatedCards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckCard.deck_id }, 'sort_order', 500
      );
      return Response.json(buildListResponse(deckCard.deck_id, updatedCards, true));
    }

    // ── ACTION: removeCardFromDeck ────────────────────────────────────────────
    if (action === 'removeCardFromDeck') {
      const { deckCardId } = body;
      if (!deckCardId) {
        return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckCardId is required.' });
      }

      // Load the DeckCard
      const cardRows = await base44.asServiceRole.entities.DeckCard.filter({ id: deckCardId });
      const deckCard = cardRows[0] || null;
      if (!deckCard) {
        return Response.json({ ok: false, code: 'CARD_NOT_FOUND', message: 'Card not found.' }, { status: 404 });
      }

      // Ownership check via parent deck
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckCard.deck_id });
      const deck = deckRows[0] || null;
      if (!deck || deck.owner_id !== profile.id) {
        return Response.json({ ok: false, code: 'FORBIDDEN', message: 'You do not own this deck.' }, { status: 403 });
      }

      const parentDeckId = deckCard.deck_id;
      await base44.asServiceRole.entities.DeckCard.delete(deckCardId);

      // Recalculate count
      await recalculateDeckCardCount(base44, parentDeckId);

      // Return refreshed list
      const updatedCards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: parentDeckId }, 'sort_order', 500
      );
      return Response.json(buildListResponse(parentDeckId, updatedCards, true));
    }

    return Response.json({ ok: false, code: 'UNKNOWN_ACTION', message: 'Unknown action.' }, { status: 400 });

  } catch (err) {
    console.error('[cardActions] ERROR', err?.message);
    return Response.json({ ok: false, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
});