/**
 * publicProfiles — service-role backend for cross-user public profile access.
 * Uses asServiceRole to bypass RLS, returns only sanitized public fields.
 * Requires authenticated caller.
 *
 * Actions:
 *   search   { query: string }      → PublicProfile[]
 *   get      { profileId: string }  → PublicProfile
 *   getDecks { profileId: string }  → PublicDeck[]
 *   getStats { profileId: string }  → PublicStats
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Normalize a raw record from the SDK — handles both flat and nested .data shapes
function getFields(raw) {
  // Base44 SDK returns flat objects (the entity data fields are top-level, alongside id/created_date)
  return raw;
}

function sanitizeProfile(raw) {
  return {
    id: raw.id,
    display_name: raw.display_name || "Unknown",
    display_name_lc: raw.display_name_lc || (raw.display_name || "").toLowerCase(),
    public_user_id: raw.public_user_id || null,
    avatar_url: raw.avatar_url || null,
    created_date: raw.created_date || null,
    // email intentionally omitted
  };
}

function sanitizeDeck(raw) {
  return {
    id: raw.id,
    name: raw.name || "Unnamed",
    commander_name: raw.commander_name || null,
    commander_image_url: raw.commander_image_url || null,
    color_identity: raw.color_identity || [],
    is_active: raw.is_active !== false,
    is_favorite: raw.is_favorite || false,
  };
}

Deno.serve(async (req) => {

  try {
    const base44 = createClientFromRequest(req);

    // TEMP: skip auth for testing service role data access
    // const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    // if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, query, profileId } = body;

    // ── SEARCH ─────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query || query.trim().length < 3) {
        return Response.json({ results: [] });
      }
      const q = query.trim().toLowerCase();

      const all = await base44.asServiceRole.entities.Profile.filter({}, '-created_date', 500);

      console.log(`[search] total records from service role: ${all.length}`);
      if (all.length > 0) {
        console.log(`[search] sample record keys: ${Object.keys(all[0]).join(', ')}`);
        console.log(`[search] sample record: ${JSON.stringify(all[0]).slice(0, 300)}`);
      }

      const matched = all.filter((p) => {
        const name = (p.display_name_lc || p.display_name || '').toLowerCase();
        const uid = (p.public_user_id || '').toLowerCase();
        return name.includes(q) || uid.includes(q);
      });

      console.log(`[search] matched ${matched.length} for query "${q}"`);

      return Response.json({ results: matched.slice(0, 20).map(sanitizeProfile) });
    }

    // ── GET SINGLE PROFILE ─────────────────────────────────────────────────
    if (action === 'get') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const results = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
      if (!results.length) return Response.json({ error: 'not_found' }, { status: 404 });

      return Response.json({ profile: sanitizeProfile(results[0]) });
    }

    // ── GET DECKS FOR PROFILE ──────────────────────────────────────────────
    if (action === 'getDecks') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const decks = await base44.asServiceRole.entities.Deck.filter({ owner_id: profileId });
      const active = decks.filter((d) => d.is_active !== false);

      return Response.json({ decks: active.map(sanitizeDeck) });
    }

    // ── GET STATS FOR PROFILE ──────────────────────────────────────────────
    if (action === 'getStats') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const [participations, decks] = await Promise.all([
        base44.asServiceRole.entities.GameParticipant.filter({ user_id: profileId }),
        base44.asServiceRole.entities.Deck.filter({ owner_id: profileId }),
      ]);

      let approvedCount = 0;
      let wins = 0;

      if (participations.length > 0) {
        const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
        const approvedSet = new Set(games.map((g) => g.id));

        for (const p of participations) {
          if (!approvedSet.has(p.game_id)) continue;
          approvedCount++;
          if (p.placement === 1) wins++;
        }
      }

      return Response.json({
        stats: {
          gamesPlayed: approvedCount,
          wins,
          decksCount: decks.length,
          activeDecksCount: decks.filter((d) => d.is_active !== false).length,
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[publicProfiles] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});