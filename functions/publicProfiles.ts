/**
 * publicProfiles — service-role backend for cross-user public profile access.
 * Uses asServiceRole to bypass RLS, returns only sanitized public fields.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function sanitizeProfile(raw) {
  return {
    id: raw.id,
    display_name: raw.display_name || "Unknown",
    display_name_lc: raw.display_name_lc || (raw.display_name || "").toLowerCase(),
    public_user_id: raw.public_user_id || null,
    avatar_url: raw.avatar_url || null,
    created_date: raw.created_date || null,
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
    const body = await req.json().catch(() => ({}));
    const { action, query, profileId } = body;

    // Auth gate: only authenticated app users may call this function.
    // NOTE: The Base44 builder test tool does not forward a real session token,
    // so test_backend_function calls will return 401 here. This is expected and
    // correct — the gate is intentionally enforced at runtime only.
    // To smoke-test via the test tool, temporarily comment this block out;
    // re-enable before committing.
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'search') {
      if (!query || query.trim().length < 3) return Response.json({ results: [] });
      const q = query.trim().toLowerCase();

      // Use server-side regex filtering to avoid fetching all profiles (CPU limit)
      const [byName, byUid] = await Promise.all([
        base44.asServiceRole.entities.Profile.filter(
          { display_name_lc: { $regex: q } }, '-created_date', 20
        ),
        base44.asServiceRole.entities.Profile.filter(
          { public_user_id: { $regex: q } }, '-created_date', 20
        ),
      ]);

      // Merge and deduplicate by id
      const seen = new Set();
      const matched = [];
      for (const p of [...byName, ...byUid]) {
        if (!seen.has(p.id)) { seen.add(p.id); matched.push(p); }
      }

      return Response.json({ results: matched.slice(0, 20).map(sanitizeProfile) });
    }

    if (action === 'get') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      const results = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
      if (!results.length) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({ profile: sanitizeProfile(results[0]) });
    }

    if (action === 'getDecks') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      const decks = await base44.asServiceRole.entities.Deck.filter({ owner_id: profileId });
      return Response.json({ decks: decks.filter((d) => d.is_active !== false).map(sanitizeDeck) });
    }

    if (action === 'getStats') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const [participations, decks] = await Promise.all([
        base44.asServiceRole.entities.GameParticipant.filter({ user_id: profileId }, '-created_date', 200),
        base44.asServiceRole.entities.Deck.filter({ owner_id: profileId }, '-created_date', 100),
      ]);

      // Count wins/games directly from participation data — avoids fetching all games
      const gamesPlayed = participations.length;
      const wins = participations.filter((p) => p.placement === 1).length;

      return Response.json({
        stats: {
          gamesPlayed,
          wins,
          decksCount: decks.length,
          activeDecksCount: decks.filter((d) => d.is_active !== false).length,
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});