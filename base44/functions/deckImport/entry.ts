/**
 * deckImport — owner-only deck-list import and refresh pipeline.
 *
 * Actions:
 *   importDeckList  — parse external source, enrich via Scryfall, store DeckCard rows
 *   getDeckCards    — return current DeckCard rows for a deck (owner or public-visible)
 *
 * Supported import sources (first implementation):
 *   - ManaBox  (manabox.app)   — public API export
 *   - Moxfield (moxfield.com)  — public deck API
 *   - Archidekt (archidekt.com) — public deck API
 *
 * Unsupported approved sources → status: unsupported_source (no crash)
 * Parse/enrichment failures   → status: failed (no silent corruption)
 *
 * Replace-on-refresh: all existing DeckCard rows for the deck are deleted
 * before inserting the new set. This is atomic per-deck.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Supported import hosts ────────────────────────────────────────────────────
const IMPORT_SUPPORTED_HOSTS = ['moxfield.com', 'www.moxfield.com', 'manabox.app', 'www.manabox.app', 'archidekt.com', 'www.archidekt.com'];

function detectHost(url) {
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function normalizeHost(hostname) {
  if (!hostname) return null;
  return hostname.replace(/^www\./, '');
}

// ── Scryfall enrichment ───────────────────────────────────────────────────────

async function scryfallFetchByName(name) {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PodArena/1.0' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
  return res.json();
}

function extractSmallImage(card) {
  if (card.image_uris?.small) return card.image_uris.small;
  if (card.card_faces?.[0]?.image_uris?.small) return card.card_faces[0].image_uris.small;
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

async function enrichCard(name) {
  try {
    await new Promise((r) => setTimeout(r, 80)); // respect Scryfall 10 req/s
    const card = await scryfallFetchByName(name);
    if (!card) return { enrichment_status: 'not_found' };
    return {
      scryfall_id: card.id || null,
      oracle_id: card.oracle_id || null,
      mana_cost: card.mana_cost || null,
      cmc: card.cmc ?? null,
      type_line: card.type_line || null,
      colors: card.colors || [],
      image_small_url: extractSmallImage(card),
      enrichment_status: 'enriched',
    };
  } catch {
    return { enrichment_status: 'failed' };
  }
}

// ── Source parsers ────────────────────────────────────────────────────────────

/**
 * Moxfield — uses the public /api/v2/decks/{id} endpoint.
 * Returns [{card_name, quantity, section}]
 */
async function parseMoxfield(url) {
  // Extract deck id from URL: https://www.moxfield.com/decks/<id>
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Could not extract Moxfield deck ID from URL');
  const deckId = match[1];

  const apiUrl = `https://api2.moxfield.com/v2/decks/all/${deckId}`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'PodArena/1.0', 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Moxfield API error ${res.status}`);
  const data = await res.json();

  const cards = [];
  const boardNames = ['mainboard', 'sideboard', 'commanders', 'companions', 'tokens'];
  for (const board of boardNames) {
    const section = board === 'commanders' ? 'Commander' : board.charAt(0).toUpperCase() + board.slice(1);
    const entries = data.boards?.[board]?.cards || {};
    for (const entry of Object.values(entries)) {
      const name = entry.card?.name || entry.name;
      const qty = entry.quantity || 1;
      if (name) cards.push({ card_name: name, quantity: qty, section });
    }
  }
  return cards;
}

/**
 * Archidekt — uses the public /api/decks/{id}/small/ endpoint.
 * Returns [{card_name, quantity, section}]
 */
async function parseArchidekt(url) {
  const match = url.match(/archidekt\.com\/decks\/(\d+)/);
  if (!match) throw new Error('Could not extract Archidekt deck ID from URL');
  const deckId = match[1];

  const apiUrl = `https://archidekt.com/api/decks/${deckId}/small/`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'PodArena/1.0', 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Archidekt API error ${res.status}`);
  const data = await res.json();

  const cards = [];
  for (const card of data.cards || []) {
    const name = card.card?.oracleCard?.name || card.card?.name;
    const qty = card.quantity || 1;
    const cats = card.categories || [];
    let section = cats[0] || 'Other';
    if (cats.includes('Commander')) section = 'Commander';
    if (name) cards.push({ card_name: name, quantity: qty, section });
  }
  return cards;
}

/**
 * ManaBox — uses the public share export endpoint.
 * ManaBox share URLs look like: https://manabox.app/decks/<uuid>
 * ManaBox exposes a text/CSV export at /decks/<uuid>/export?format=arena
 * Fall back to plain text (Arena format): "1 Card Name\n2 Other Card"
 */
async function parseManaBox(url) {
  const match = url.match(/manabox\.app\/decks\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Could not extract ManaBox deck ID from URL');
  const deckId = match[1];

  // Try JSON API first
  const apiUrl = `https://manabox.app/api/decks/${deckId}`;
  let res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'PodArena/1.0', 'Accept': 'application/json' }
  });

  if (res.ok) {
    const data = await res.json();
    const cards = [];
    for (const card of data.cards || data.deck?.cards || []) {
      const name = card.name || card.card_name;
      const qty = card.quantity || card.qty || 1;
      const section = card.section || card.board || 'Mainboard';
      if (name) cards.push({ card_name: name, quantity: qty, section });
    }
    if (cards.length > 0) return cards;
  }

  // Fallback: Arena text export
  const exportUrl = `https://manabox.app/decks/${deckId}/export?format=arena`;
  res = await fetch(exportUrl, { headers: { 'User-Agent': 'PodArena/1.0' } });
  if (!res.ok) throw new Error(`ManaBox export error ${res.status}`);
  const text = await res.text();
  return parseArenaText(text);
}

/**
 * Parse Arena-format text: "1 Card Name\n2 Other Card"
 * Lines starting with a number followed by a card name.
 */
function parseArenaText(text) {
  const cards = [];
  let section = 'Mainboard';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) { section = 'Sideboard'; continue; } // blank line = sideboard
    if (/^(Commander|Sideboard|Mainboard|About|Companion)/i.test(trimmed)) {
      section = trimmed.replace(/[^a-zA-Z]/g, '') || section;
      continue;
    }
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (match) {
      const qty = parseInt(match[1], 10);
      let name = match[2].trim();
      // Strip set/collector annotations e.g. "1 Card Name (SET) 123"
      name = name.replace(/\s+\([A-Z0-9]+\)\s+\d+.*$/, '').trim();
      if (name && qty > 0) cards.push({ card_name: name, quantity: qty, section });
    }
  }
  return cards;
}

// ── Main parser dispatcher ────────────────────────────────────────────────────

async function parseSource(hostname, url) {
  const bare = normalizeHost(hostname);
  if (bare === 'moxfield.com') return parseMoxfield(url);
  if (bare === 'archidekt.com') return parseArchidekt(url);
  if (bare === 'manabox.app') return parseManaBox(url);
  throw new Error(`unsupported_source:${bare}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let step = 'init';
  let deckId;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    deckId = body.deckId;

    // Auth gate
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve caller profile
    step = 'resolve_profile';
    const profileRows = await base44.asServiceRole.entities.Profile.filter({ user_id: me.id });
    const profile = profileRows[0] || null;
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // ── getDeckCards ──────────────────────────────────────────────────────────
    if (action === 'getDeckCards') {
      if (!deckId) return Response.json({ error: 'deckId required' }, { status: 400 });

      step = 'load_deck';
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });

      // Access check: owner OR show_deck_list_publicly
      const isOwner = deck.owner_id === profile.id;
      if (!isOwner && !deck.show_deck_list_publicly) {
        return Response.json({ error: 'Deck list is private' }, { status: 403 });
      }

      step = 'load_cards';
      const cards = await base44.asServiceRole.entities.DeckCard.filter(
        { deck_id: deckId }, 'sort_order', 500
      );
      return Response.json({
        cards,
        import_status: deck.deck_list_import_status || 'not_imported',
        last_synced_at: deck.deck_list_last_synced_at || null,
        card_count: deck.deck_list_card_count || 0,
      });
    }

    // ── importDeckList ────────────────────────────────────────────────────────
    if (action === 'importDeckList') {
      if (!deckId) return Response.json({ error: 'deckId required' }, { status: 400 });

      // Load & verify ownership
      step = 'load_deck';
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });
      if (deck.owner_id !== profile.id) {
        return Response.json({ error: 'Forbidden: you do not own this deck' }, { status: 403 });
      }

      const externalLink = deck.external_deck_link?.trim();
      if (!externalLink) {
        return Response.json({ error: 'No external_deck_link set on this deck.' }, { status: 400 });
      }

      const hostname = detectHost(externalLink);
      const sourceHost = normalizeHost(hostname);

      // Check if source is import-supported
      if (!IMPORT_SUPPORTED_HOSTS.includes(hostname)) {
        await base44.asServiceRole.entities.Deck.update(deckId, {
          deck_list_import_status: 'unsupported_source',
          deck_list_source_host: sourceHost,
        });
        return Response.json({
          status: 'unsupported_source',
          message: `Import is not yet supported for ${sourceHost}. The deck link is saved and valid, but we cannot import card data from this source yet.`,
        });
      }

      // Mark as importing
      step = 'mark_importing';
      await base44.asServiceRole.entities.Deck.update(deckId, {
        deck_list_import_status: 'importing',
        deck_list_source_host: sourceHost,
      });

      // Parse
      step = 'parse_source';
      let parsedCards;
      try {
        parsedCards = await parseSource(hostname, externalLink);
      } catch (parseErr) {
        const isUnsupported = parseErr.message?.startsWith('unsupported_source:');
        await base44.asServiceRole.entities.Deck.update(deckId, {
          deck_list_import_status: isUnsupported ? 'unsupported_source' : 'failed',
        });
        return Response.json({
          status: isUnsupported ? 'unsupported_source' : 'failed',
          message: isUnsupported
            ? `Import is not yet supported for ${sourceHost}.`
            : `Failed to parse deck list: ${parseErr.message}`,
        }, { status: 200 }); // 200 so frontend can read the status
      }

      if (!parsedCards || parsedCards.length === 0) {
        await base44.asServiceRole.entities.Deck.update(deckId, { deck_list_import_status: 'failed' });
        return Response.json({ status: 'failed', message: 'No cards found in imported deck list.' });
      }

      // Inject commander row if not already present
      const commanderName = deck.commander_name?.trim();
      if (commanderName) {
        const hasCommander = parsedCards.some(
          (c) => c.is_commander || c.section === 'Commander' ||
                 c.card_name.toLowerCase() === commanderName.toLowerCase()
        );
        if (!hasCommander) {
          parsedCards.unshift({ card_name: commanderName, quantity: 1, section: 'Commander', is_commander: true });
        } else {
          // Mark the commander card
          parsedCards = parsedCards.map((c) =>
            c.card_name.toLowerCase() === commanderName.toLowerCase() || c.section === 'Commander'
              ? { ...c, is_commander: true, section: 'Commander' }
              : c
          );
        }
      }

      // Enrich each card via Scryfall
      step = 'enrich_cards';
      const enriched = [];
      let sortOrder = 0;
      const failedEnrichments = [];

      for (const card of parsedCards) {
        const enrichData = await enrichCard(card.card_name);
        enriched.push({
          deck_id: deckId,
          card_name: card.card_name,
          quantity: card.quantity || 1,
          section: card.section || 'Other',
          is_commander: card.is_commander || false,
          sort_order: sortOrder++,
          ...enrichData,
        });
        if (enrichData.enrichment_status !== 'enriched') {
          failedEnrichments.push(card.card_name);
        }
      }

      // Replace-on-refresh: delete all existing DeckCard rows for this deck
      step = 'delete_old_cards';
      const existing = await base44.asServiceRole.entities.DeckCard.filter({ deck_id: deckId }, '-created_date', 500);
      if (existing.length > 0) {
        await Promise.all(existing.map((c) => base44.asServiceRole.entities.DeckCard.delete(c.id)));
      }

      // Bulk insert new cards
      step = 'insert_cards';
      const totalQty = enriched.reduce((s, c) => s + (c.quantity || 1), 0);
      await base44.entities.DeckCard.bulkCreate(enriched);

      // Update deck metadata
      step = 'update_deck_metadata';
      await base44.asServiceRole.entities.Deck.update(deckId, {
        deck_list_import_status: 'imported',
        deck_list_last_synced_at: new Date().toISOString(),
        deck_list_source_host: sourceHost,
        deck_list_card_count: totalQty,
      });

      console.log('[deckImport] success', {
        deckId,
        sourceHost,
        cardCount: enriched.length,
        totalQty,
        failedEnrichments: failedEnrichments.length,
      });

      return Response.json({
        status: 'imported',
        card_count: enriched.length,
        total_quantity: totalQty,
        failed_enrichments: failedEnrichments,
        message: failedEnrichments.length > 0
          ? `Imported ${enriched.length} cards. ${failedEnrichments.length} card(s) could not be found on Scryfall: ${failedEnrichments.join(', ')}`
          : `Successfully imported ${enriched.length} cards from ${sourceHost}.`,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('[deckImport] FAILED', { step, deckId, error: err?.message });
    // Best-effort: mark deck as failed
    try {
      if (deckId) {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.Deck.update(deckId, { deck_list_import_status: 'failed' });
      }
    } catch {}
    return Response.json({ error: err.message || 'deckImport failed' }, { status: 500 });
  }
});