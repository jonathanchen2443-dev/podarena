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
 * Includes price, finish, and set_svg_uri fields.
 *
 * @param {object} card          – raw Scryfall card object
 * @param {object} opts
 * @param {boolean} opts.isCommander
 * @param {string}  opts.addedMethod
 * @param {string}  opts.selectedFinish  – override for finish selection
 */
function normalizeScryfallCard(card, { isCommander = false, addedMethod = 'manual', selectedFinish = null } = {}) {
  const typeLine   = extractTypeLine(card);
  const images     = extractImages(card);
  const manaCost   = extractManaCost(card);
  const oracleText = extractOracleText(card);
  const section    = classifySection(typeLine, isCommander);

  // ── Finishes ────────────────────────────────────────────────────────────────
  const finishes = Array.isArray(card.finishes) ? card.finishes : [];
  // Determine selected_finish: respect incoming override if valid, else pick sensible default
  let chosen = null;
  if (selectedFinish === 'nonfoil' || selectedFinish === 'foil') {
    chosen = selectedFinish;
  } else if (finishes.includes('nonfoil')) {
    chosen = 'nonfoil';
  } else if (finishes.includes('foil')) {
    chosen = 'foil';
  } else {
    chosen = 'nonfoil'; // safe fallback
  }
  const is_foil = chosen === 'foil';

  // ── Prices ──────────────────────────────────────────────────────────────────
  // Keep as string (Scryfall returns strings like "0.50" or null).
  // null means "missing price" — UI should display "---".
  const prices = card.prices || {};
  const price_usd_nonfoil = prices.usd  != null ? String(prices.usd)  : null;
  const price_usd_foil    = prices.usd_foil != null ? String(prices.usd_foil) : null;

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
    finishes,
    selected_finish:    chosen,
    is_foil,
    price_usd_nonfoil,
    price_usd_foil,
    set_svg_uri:        card.set_svg_uri || null,
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

    // ── ACTION: getCardPrintings ──────────────────────────────────────────────
    if (action === 'getCardPrintings') {
      const { oracleId } = body;
      if (!oracleId) {
        return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'oracleId is required.' });
      }

      let printings = [];
      try {
        const sfRes = await fetch(
          `https://api.scryfall.com/cards/search?order=released&dir=desc&q=oracleid%3A${encodeURIComponent(oracleId)}&unique=prints`,
          { headers: SCRYFALL_HEADERS }
        );
        if (sfRes.ok) {
          const data = await sfRes.json();
          const rawPrintings = (data.data || []).slice(0, 50);

          // Collect unique set codes to fetch icon_svg_uri from Scryfall sets API
          const uniqueSetCodes = [...new Set(rawPrintings.map((c) => c.set).filter(Boolean))];
          const setIconMap = {};
          await Promise.all(
            uniqueSetCodes.map(async (setCode) => {
              try {
                const setRes = await fetch(
                  `https://api.scryfall.com/sets/${setCode}`,
                  { headers: SCRYFALL_HEADERS }
                );
                if (setRes.ok) {
                  const setData = await setRes.json();
                  if (setData?.icon_svg_uri) setIconMap[setCode] = setData.icon_svg_uri;
                }
              } catch {
                // Non-fatal: icon just won't be available for this set
              }
            })
          );

          printings = rawPrintings.map((c) => {
            const normalized = normalizeScryfallCard(c);
            // Attach the set icon URI fetched from the sets API
            normalized.set_svg_uri = setIconMap[c.set] || null;
            return normalized;
          });
        } else if (sfRes.status === 404) {
          return Response.json({ ok: true, printings: [] });
        }
      } catch {
        return Response.json({ ok: false, code: 'SCRYFALL_ERROR', message: 'Failed to fetch printings. Please try again.' });
      }

      return Response.json({ ok: true, printings });
    }

    // ── ACTION: addCardToDeck ─────────────────────────────────────────────────
    if (action === 'addCardToDeck') {
      const { deckId, card, selected_finish } = body;
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

      const cardName = (card.card_name || '').trim();
      if (!cardName) {
        return Response.json({ ok: false, code: 'INVALID_CARD', message: 'Card name is required.' });
      }

      // Determine finish — validate and resolve against available finishes
      const finishes = Array.isArray(card.finishes) ? card.finishes : [];
      let chosenFinish = selected_finish;
      if (chosenFinish !== 'nonfoil' && chosenFinish !== 'foil') {
        // Fallback to card's natural default
        chosenFinish = finishes.includes('nonfoil') ? 'nonfoil' : finishes.includes('foil') ? 'foil' : 'nonfoil';
      }
      // If chosen finish is not available in this printing's finishes and finishes are known,
      // fall back to what's available
      if (finishes.length > 0 && !finishes.includes(chosenFinish)) {
        chosenFinish = finishes.includes('nonfoil') ? 'nonfoil' : 'foil';
      }
      const is_foil = chosenFinish === 'foil';

      // Load existing cards for duplicate detection
      const existingCards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckId }, 'sort_order', 500
      );

      // Duplicate detection:
      // Same scryfall_id (specific printing) + same selected_finish → increment quantity
      // Same scryfall_id + different finish → new row
      // Different printing of same card → new row
      // Commander cards always use oracle_id/name fallback (legacy compatibility)
      const incomingScryfallId = card.scryfall_id || null;
      let matchedCard = null;

      if (incomingScryfallId) {
        matchedCard = existingCards.find(
          (c) => c.scryfall_id === incomingScryfallId && (c.selected_finish || 'nonfoil') === chosenFinish
        ) || null;
      }
      // Fallback for cards without scryfall_id (edge case / legacy): oracle_id + finish
      if (!matchedCard && card.oracle_id) {
        const candidates = existingCards.filter((c) => c.oracle_id === card.oracle_id && (c.selected_finish || 'nonfoil') === chosenFinish);
        if (candidates.length === 1) matchedCard = candidates[0];
      }

      if (matchedCard) {
        const newQty = (matchedCard.quantity || 1) + 1;
        await base44.asServiceRole.entities.DeckCard.update(matchedCard.id, { quantity: newQty });
      } else {
        const maxSortOrder = existingCards.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
        const newCard = {
          deck_id:            deckId,
          card_name:          cardName,
          quantity:           1,
          sort_order:         maxSortOrder + 1,
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
          finishes:           card.finishes           || [],
          selected_finish:    chosenFinish,
          is_foil,
          price_usd_nonfoil:  card.price_usd_nonfoil  ?? null,
          price_usd_foil:     card.price_usd_foil     ?? null,
          set_svg_uri:        card.set_svg_uri        || null,
          section:            card.section            || 'Other',
          is_commander:       card.is_commander       || false,
          enrichment_status:  card.enrichment_status  || 'enriched',
          added_method:       'manual',
        };
        await base44.entities.DeckCard.create(newCard);
      }

      await recalculateDeckCardCount(base44, deckId);

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

    // ── ACTION: validateDeck ──────────────────────────────────────────────────
    if (action === 'validateDeck') {
      const { deckId } = body;
      if (!deckId) return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckId is required.' });

      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) return Response.json({ ok: false, code: 'DECK_NOT_FOUND', message: 'Deck not found.' }, { status: 404 });

      const isOwner = deck.owner_id === profile.id;
      if (!isOwner && !deck.show_deck_list_publicly) {
        return Response.json({ ok: false, code: 'DECK_PRIVATE', message: 'This deck list is private.' }, { status: 403 });
      }

      const format = deck.deck_format || 'commander';
      if (format !== 'commander') {
        return Response.json({ ok: true, deckId, validation: { format, isLegal: true, status: 'legal', totalCards: 0, maxCards: null, errors: [], warnings: [], issuesByCardId: {}, issuesByCardName: {}, commander: null } });
      }

      const cards = await base44.asServiceRole.entities.DeckCard.filter({ deck_id: deckId }, 'sort_order', 500);
      const errors = [];
      const warnings = [];
      const issuesByCardId = {};
      const issuesByCardName = {};

      function addIssue(issue) {
        if (issue.severity === 'error') errors.push(issue);
        else warnings.push(issue);
        if (issue.cardId) issuesByCardId[issue.cardId] = [...(issuesByCardId[issue.cardId] || []), issue];
        if (issue.cardName) issuesByCardName[issue.cardName] = [...(issuesByCardName[issue.cardName] || []), issue];
      }

      const totalCards = cards.reduce((s, c) => s + (c.quantity || 1), 0);

      // 1. Deck size
      if (totalCards === 0) {
        addIssue({ type: 'deck_size', severity: 'warning', message: 'Deck has no cards yet.' });
      } else if (totalCards < 100) {
        addIssue({ type: 'deck_size', severity: 'warning', message: `Deck has ${totalCards} of 100 required cards.` });
      } else if (totalCards > 100) {
        addIssue({ type: 'deck_size', severity: 'error', message: `Deck has ${totalCards} cards — must be exactly 100.` });
      }

      // Basic land / multi-copy exemptions
      const SINGLETON_EXEMPT = new Set([
        'Plains','Island','Swamp','Mountain','Forest','Wastes',
        'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp',
        'Snow-Covered Mountain','Snow-Covered Forest',
        'Relentless Rats','Rat Colony','Shadowborn Apostle',
        'Persistent Petitioners',"Dragon's Approach",'Seven Dwarves',
      ]);

      // 2. Singleton — group by oracle_id then card_name, flag any total > 1
      // First pass: accumulate totals
      const oracleCount = {};  // oracle_id -> { total, cards: [{id, name, qty}] }
      const nameCount = {};    // name_lc   -> { total, cards: [{id, name, qty}] }
      for (const card of cards) {
        const name = card.card_name || '';
        if (SINGLETON_EXEMPT.has(name)) continue;
        const qty = card.quantity || 1;
        if (card.oracle_id) {
          if (!oracleCount[card.oracle_id]) oracleCount[card.oracle_id] = { total: 0, rows: [] };
          oracleCount[card.oracle_id].total += qty;
          oracleCount[card.oracle_id].rows.push({ id: card.id, name, qty });
        } else {
          const lc = name.toLowerCase();
          if (!nameCount[lc]) nameCount[lc] = { total: 0, rows: [] };
          nameCount[lc].total += qty;
          nameCount[lc].rows.push({ id: card.id, name, qty });
        }
      }
      // Second pass: flag groups with total > 1
      for (const { total, rows } of Object.values(oracleCount)) {
        if (total > 1) {
          for (const { id, name } of rows) {
            addIssue({ type: 'duplicate_card', severity: 'error', cardId: id, cardName: name, message: `"${name}" appears ${total}× (Commander requires singleton).` });
          }
        }
      }
      for (const { total, rows } of Object.values(nameCount)) {
        if (total > 1) {
          for (const { id, name } of rows) {
            addIssue({ type: 'duplicate_card', severity: 'error', cardId: id, cardName: name, message: `"${name}" appears ${total}× (Commander requires singleton).` });
          }
        }
      }

      // 3. Color identity
      const deckCI = deck.color_identity || [];
      const deckCISet = new Set(deckCI);
      if (deckCI.length === 0 && (deck.commander_name || deck.commander_scryfall_id)) {
        addIssue({ type: 'color_identity_unknown', severity: 'warning', message: 'Commander color identity is not set — color identity check skipped.' });
      } else if (deckCI.length > 0) {
        for (const card of cards) {
          if (card.is_commander) continue;
          const cardCI = card.color_identity;
          if (!cardCI || !Array.isArray(cardCI)) {
            addIssue({ type: 'color_identity_missing', severity: 'warning', cardId: card.id, cardName: card.card_name, message: `"${card.card_name}" has no color identity data.` });
            continue;
          }
          const outside = cardCI.filter((c) => !deckCISet.has(c));
          if (outside.length > 0) {
            addIssue({ type: 'color_identity_violation', severity: 'error', cardId: card.id, cardName: card.card_name, message: `"${card.card_name}" has color identity {${outside.join(',')}} outside commander's identity.` });
          }
        }
      }

      // 4. Commander legality
      for (const card of cards) {
        const legalities = card.legalities;
        if (!legalities || typeof legalities !== 'object' || Object.keys(legalities).length === 0) {
          addIssue({ type: 'legality_missing', severity: 'warning', cardId: card.id, cardName: card.card_name, message: `"${card.card_name}" has no legality data.` });
        } else if (legalities.commander && legalities.commander !== 'legal') {
          addIssue({ type: 'not_commander_legal', severity: 'error', cardId: card.id, cardName: card.card_name, message: `"${card.card_name}" is ${legalities.commander} in Commander.` });
        }
      }

      // 5. Commander presence
      const commanderName = deck.commander_name || null;
      const commanderScryfallId = deck.commander_scryfall_id || null;
      const hasCommanderInDeckEntity = !!(commanderName || commanderScryfallId);
      let hasCommanderInDeckList = false;

      if (hasCommanderInDeckEntity) {
        hasCommanderInDeckList = cards.some((c) =>
          (commanderScryfallId && c.scryfall_id === commanderScryfallId) ||
          (commanderName && c.card_name?.toLowerCase() === commanderName.toLowerCase()) ||
          c.is_commander === true
        );
        if (!hasCommanderInDeckList) {
          addIssue({ type: 'commander_not_in_list', severity: 'warning', message: 'Commander is not in the deck list yet.' });
        }
      } else {
        addIssue({ type: 'no_commander_selected', severity: 'warning', message: 'No commander selected for this deck yet.' });
      }

      const isLegal = errors.length === 0 && warnings.length === 0;
      const status = errors.length > 0 ? 'not_legal' : warnings.length > 0 ? 'needs_review' : 'legal';

      return Response.json({
        ok: true,
        deckId,
        validation: {
          format,
          isLegal,
          status,
          totalCards,
          maxCards: 100,
          errors,
          warnings,
          issuesByCardId,
          issuesByCardName,
          commander: {
            hasCommanderInDeckEntity,
            hasCommanderInDeckList,
            commanderName,
            commanderScryfallId,
            canAddCommanderToList: isOwner && hasCommanderInDeckEntity,
            needsCommanderSelection: !hasCommanderInDeckEntity,
          },
        },
      });
    }

    // ── ACTION: addCommanderToDeckList ────────────────────────────────────────
    if (action === 'addCommanderToDeckList') {
      const { deckId } = body;
      if (!deckId) return Response.json({ ok: false, code: 'MISSING_PARAM', message: 'deckId is required.' });

      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) return Response.json({ ok: false, code: 'DECK_NOT_FOUND', message: 'Deck not found.' }, { status: 404 });

      if (deck.owner_id !== profile.id) {
        return Response.json({ ok: false, code: 'FORBIDDEN', message: 'You do not own this deck.' }, { status: 403 });
      }

      if (!deck.commander_name && !deck.commander_scryfall_id) {
        return Response.json({ ok: false, code: 'NO_COMMANDER_SELECTED', message: 'No commander is selected for this deck.' });
      }

      const commanderName = deck.commander_name || '';
      const commanderScryfallId = deck.commander_scryfall_id || null;

      // Check if commander row already exists
      const existingCards = await base44.asServiceRole.entities.DeckCard.filter({ deck_id: deckId }, 'sort_order', 500);
      const existingCommander = existingCards.find((c) =>
        c.is_commander === true ||
        (commanderScryfallId && c.scryfall_id === commanderScryfallId) ||
        (commanderName && c.card_name?.toLowerCase() === commanderName.toLowerCase())
      );

      // Build card data from Scryfall or from deck fields
      let commanderCardData = null;

      // Try to fetch from Scryfall if we have an ID or name
      const scryfallUrl = commanderScryfallId
        ? `https://api.scryfall.com/cards/${commanderScryfallId}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`;

      try {
        const sfRes = await fetch(scryfallUrl, { headers: SCRYFALL_HEADERS });
        if (sfRes.ok) {
          const sfData = await sfRes.json();
          if (sfData?.object === 'card') {
            commanderCardData = normalizeScryfallCard(sfData, { isCommander: true, addedMethod: 'manual' });
          }
        }
      } catch {
        // Fallback: use data from deck entity fields
      }

      // Fallback: build from deck fields if Scryfall failed
      if (!commanderCardData) {
        commanderCardData = {
          card_name: commanderName,
          scryfall_id: commanderScryfallId || null,
          oracle_id: null,
          quantity: 1,
          section: 'Commander',
          is_commander: true,
          enrichment_status: 'enriched',
          added_method: 'manual',
          mana_cost: null, cmc: null, type_line: null, colors: [], color_identity: deck.color_identity || [],
          legalities: {}, rarity: null, layout: null, oracle_text: null,
          set_code: null, set_name: null, collector_number: null,
          image_small_url: deck.commander_image_url || null,
          image_normal_url: deck.commander_full_card_image_url || deck.commander_image_url || null,
          image_art_crop_url: deck.commander_image_url || null,
          sort_order: 0,
        };
      }

      if (existingCommander) {
        // Ensure it's properly marked as commander
        await base44.asServiceRole.entities.DeckCard.update(existingCommander.id, {
          is_commander: true,
          section: 'Commander',
          quantity: 1,
        });
      } else {
        const newCard = {
          deck_id: deckId,
          ...commanderCardData,
          quantity: 1,
          section: 'Commander',
          is_commander: true,
          sort_order: 0,
          added_method: 'manual',
        };
        await base44.entities.DeckCard.create(newCard);
      }

      await recalculateDeckCardCount(base44, deckId);
      const updatedCards = await base44.asServiceRole.entities.DeckCard.filter({ deck_id: deckId }, 'sort_order', 500);
      return Response.json(buildListResponse(deckId, updatedCards, true));
    }

    return Response.json({ ok: false, code: 'UNKNOWN_ACTION', message: 'Unknown action.' }, { status: 400 });

  } catch (err) {
    console.error('[cardActions] ERROR', err?.message);
    return Response.json({ ok: false, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
});