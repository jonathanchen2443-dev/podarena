/**
 * backfillCommanderFullCard — admin-only backfill.
 *
 * For each deck missing commander_full_card_image_url or commander_scryfall_id,
 * queries Scryfall by the stored commander_name and populates those fields.
 *
 * Reports: { total, updated, skipped, failed }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scryfall named lookup — most precise for exact commander names
async function fetchCommanderCard(name) {
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PodArena/1.0' } });
  if (!res.ok) {
    if (res.status === 404) return null; // not found — skip gracefully
    throw new Error(`Scryfall error ${res.status} for "${name}"`);
  }
  return res.json();
}

function extractFullCardImage(card) {
  if (card.image_uris?.large) return card.image_uris.large;
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

Deno.serve(async (req) => {
  let step = 'init';
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only gate
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    step = 'load_decks';
    // Load all decks in batches of 200
    const allDecks = await base44.asServiceRole.entities.Deck.list('-created_date', 500);

    const results = { total: allDecks.length, updated: 0, skipped: 0, failed: 0, details: [] };

    for (const deck of allDecks) {
      // Skip if already has both fields populated
      if (deck.commander_scryfall_id && deck.commander_full_card_image_url) {
        results.skipped++;
        continue;
      }

      if (!deck.commander_name?.trim()) {
        results.skipped++;
        results.details.push({ id: deck.id, status: 'skipped', reason: 'no commander_name' });
        continue;
      }

      try {
        // Small delay to respect Scryfall rate limits (10 req/s)
        await new Promise((r) => setTimeout(r, 120));

        step = `scryfall_fetch:${deck.id}`;
        const card = await fetchCommanderCard(deck.commander_name);

        if (!card) {
          results.failed++;
          results.details.push({ id: deck.id, name: deck.commander_name, status: 'not_found' });
          continue;
        }

        const fullCardImageUrl = extractFullCardImage(card);
        if (!fullCardImageUrl) {
          results.failed++;
          results.details.push({ id: deck.id, name: deck.commander_name, status: 'no_image' });
          continue;
        }

        // Only update what's missing — don't overwrite existing valid values
        const patch = {};
        if (!deck.commander_scryfall_id) patch.commander_scryfall_id = card.id;
        if (!deck.commander_full_card_image_url) patch.commander_full_card_image_url = fullCardImageUrl;

        step = `update_deck:${deck.id}`;
        await base44.asServiceRole.entities.Deck.update(deck.id, patch);

        results.updated++;
        results.details.push({ id: deck.id, name: deck.commander_name, status: 'updated', patch });

      } catch (err) {
        results.failed++;
        results.details.push({ id: deck.id, name: deck.commander_name, status: 'error', error: err.message });
        console.error('[backfillCommanderFullCard] deck error', { deckId: deck.id, error: err.message });
      }
    }

    console.log('[backfillCommanderFullCard] done', {
      total: results.total,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed,
    });

    return Response.json(results);

  } catch (err) {
    console.error('[backfillCommanderFullCard] FAILED', { step, error: err.message });
    return Response.json({ error: err.message }, { status: 500 });
  }
});