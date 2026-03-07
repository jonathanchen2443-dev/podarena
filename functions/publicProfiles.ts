/**
 * publicProfiles — service-role backend for cross-user public profile access.
 * Uses asServiceRole to bypass RLS, returns only sanitized public fields.
 * Requires authenticated caller (no guest access).
 *
 * Actions:
 *   search   { query: string }                 → PublicProfile[]
 *   get      { profileId: string }             → PublicProfile
 *   getDecks { profileId: string }             → PublicDeck[]
 *   getStats { profileId: string }             → PublicStats
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Only these fields are ever returned for a public profile
function sanitizeProfile(raw) {
  const d = raw.data || raw; // handle both raw entity shape and flat shape
  return {
    id: raw.id,
    display_name: d.display_name || "Unknown",
    display_name_lc: d.display_name_lc || (d.display_name || "").toLowerCase(),
    public_user_id: d.public_user_id || null,
    avatar_url: d.avatar_url || null,
    created_date: raw.created_date || null,
    // email intentionally omitted
  };
}

function sanitizeDeck(raw) {
  const d = raw.data || raw;
  return {
    id: raw.id,
    name: d.name || "Unnamed",
    commander_name: d.commander_name || null,
    commander_image_url: d.commander_image_url || null,
    color_identity: d.color_identity || [],
    is_active: d.is_active !== false,
    is_favorite: d.is_favorite || false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Require authentication — no anonymous cross-user lookups
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, query, profileId } = body;

    // ── SEARCH ─────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query || query.trim().length < 3) {
        return Response.json({ results: [] });
      }
      const q = query.trim().toLowerCase();

      // Service role bypasses RLS — sees all profiles
      const all = await base44.asServiceRole.entities.Profile.list('-created_date', 500);

      const matched = all.filter((p) => {
        const d = p.data || p;
        const name = (d.display_name_lc || d.display_name || '').toLowerCase();
        const uid = (d.public_user_id || '').toLowerCase();
        return name.includes(q) || uid.includes(q);
      });

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
      const active = decks.filter((d) => {
        const data = d.data || d;
        return data.is_active !== false;
      });

      return Response.json({ decks: active.map(sanitizeDeck) });
    }

    // ── GET STATS FOR PROFILE ──────────────────────────────────────────────
    if (action === 'getStats') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const [participations, decks] = await Promise.all([
        base44.asServiceRole.entities.GameParticipant.filter({ user_id: profileId }),
        base44.asServiceRole.entities.Deck.filter({ owner_id: profileId }),
      ]);

      const gameIds = participations.map((p) => (p.data || p).game_id).filter(Boolean);
      let approvedCount = 0;
      let wins = 0;

      if (gameIds.length > 0) {
        // Fetch games for those participations
        const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
        const approvedSet = new Set(games.map((g) => g.id));

        for (const p of participations) {
          const d = p.data || p;
          if (!approvedSet.has(d.game_id)) continue;
          approvedCount++;
          if (d.placement === 1) wins++;
        }
      }

      const deckData = decks.map((d) => d.data || d);

      return Response.json({
        stats: {
          gamesPlayed: approvedCount,
          wins,
          decksCount: deckData.length,
          activeDecksCount: deckData.filter((d) => d.is_active !== false).length,
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});