/**
 * publicProfiles — service-role backend for cross-user public profile access,
 * scoped pod history, and scoped user history.
 *
 * All entity reads use asServiceRole (bypasses RLS).
 * All responses are sanitized — no private fields (email, user_id, *_lc) are returned.
 *
 * ACTIONS:
 *   search        — profile search by display name or public_user_id
 *   get           — single profile by id
 *   getDecks      — active decks for a profile (public display only, snapshot-safe fields)
 *   getStats      — game/deck stats for a profile (approved games only)
 *   podHistory    — pod-scoped game history for active pod members
 *                   Requires: podId, callerProfileId
 *                   Gate: caller must be an active member of the pod
 *   userHistory   — personal game history for own profile (own view)
 *                   Requires: profileId, callerProfileId
 *                   Gate: callerProfileId must equal profileId (own history only)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Sanitizers ────────────────────────────────────────────────────────────────

/** Safe public identity fields only. Never leaks email, user_id, or internal lc fields. */
function sanitizeProfile(raw) {
  return {
    id: raw.id,
    display_name: raw.display_name || "Unknown",
    public_user_id: raw.public_user_id || null,
    avatar_url: raw.avatar_url || null,
    created_date: raw.created_date || null,
  };
}

/** Public-facing deck display fields. Does NOT expose owner_id, management flags, or any user linkage. */
function sanitizeDeck(raw) {
  return {
    id: raw.id,
    name: raw.name || "Unnamed",
    commander_name: raw.commander_name || null,
    commander_image_url: raw.commander_image_url || null,
    color_identity: raw.color_identity || [],
  };
}

/**
 * Sanitized participant row for game history displays.
 * Exposes only snapshot deck fields — never raw selected_deck_id or owner-linked data.
 */
function sanitizeParticipant(raw) {
  return {
    participant_profile_id: raw.participant_profile_id,
    is_creator: raw.is_creator || false,
    result: raw.result || null,
    placement: raw.placement || null,
    approval_status: raw.approval_status || "pending",
    deck_name_at_time: raw.deck_name_at_time || null,
    commander_name_at_time: raw.commander_name_at_time || null,
    commander_image_at_time: raw.commander_image_at_time || null,
    color_identity: raw.deck_snapshot_json?.color_identity || [],
  };
}

/** Sanitized game row for history surfaces. Omits internal user_id fields. */
function sanitizeGame(raw) {
  return {
    id: raw.id,
    pod_id: raw.pod_id || null,
    context_type: raw.context_type || "casual",
    played_at: raw.played_at || raw.created_date || null,
    status: raw.status || "pending",
    notes: raw.notes || "",
    created_by_profile_id: raw.created_by_profile_id || null,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, query, profileId, podId, callerProfileId } = body;

    // Auth gate: only authenticated app users may call this function.
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── search ────────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query || query.trim().length < 3) return Response.json({ results: [] });
      const q = query.trim().toLowerCase();

      const [byName, byUid] = await Promise.all([
        base44.asServiceRole.entities.Profile.filter({ display_name_lc: { $regex: q } }, '-created_date', 20),
        base44.asServiceRole.entities.Profile.filter({ public_user_id: { $regex: q } }, '-created_date', 20),
      ]);

      const seen = new Set();
      const matched = [];
      for (const p of [...byName, ...byUid]) {
        if (!seen.has(p.id)) { seen.add(p.id); matched.push(p); }
      }

      return Response.json({ results: matched.slice(0, 20).map(sanitizeProfile) });
    }

    // ── get ───────────────────────────────────────────────────────────────────
    if (action === 'get') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      const results = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
      if (!results.length) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({ profile: sanitizeProfile(results[0]) });
    }

    // ── getDecks ──────────────────────────────────────────────────────────────
    if (action === 'getDecks') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      const decks = await base44.asServiceRole.entities.Deck.filter({ owner_id: profileId });
      const activeDecks = decks.filter((d) => d.is_active !== false).map(sanitizeDeck);
      return Response.json({ decks: activeDecks });
    }

    // ── getStats ──────────────────────────────────────────────────────────────
    if (action === 'getStats') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });

      const [participations, decks] = await Promise.all([
        base44.asServiceRole.entities.GameParticipant.filter({ participant_profile_id: profileId }, '-created_date', 500),
        base44.asServiceRole.entities.Deck.filter({ owner_id: profileId }, '-created_date', 100),
      ]);

      const gameIds = [...new Set(participations.map((p) => p.game_id))];
      let approvedGameIds = new Set();
      if (gameIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < gameIds.length; i += 50) chunks.push(gameIds.slice(i, i + 50));
        const gameResults = await Promise.all(
          chunks.map((chunk) =>
            base44.asServiceRole.entities.Game.filter({ id: { $in: chunk }, status: 'approved' }, '-played_at', 50)
          )
        );
        approvedGameIds = new Set(gameResults.flat().map((g) => g.id));
      }

      const approvedParticipations = participations.filter((p) => approvedGameIds.has(p.game_id));
      const gamesPlayed = approvedParticipations.length;
      const wins = approvedParticipations.filter((p) => p.placement === 1).length;

      return Response.json({
        stats: {
          gamesPlayed,
          wins,
          decksCount: decks.length,
          activeDecksCount: decks.filter((d) => d.is_active !== false).length,
        }
      });
    }

    // ── podHistory ────────────────────────────────────────────────────────────
    // Returns all pod games for a pod, for active pod members only.
    // Broader than personal history — explicitly pod-scoped.
    // callerProfileId must be an active member of the pod.
    if (action === 'podHistory') {
      if (!podId) return Response.json({ error: 'podId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      // Gate: verify caller is an active member of this pod
      const membership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId,
        profile_id: callerProfileId,
        membership_status: 'active',
      });
      if (membership.length === 0) {
        return Response.json({ error: 'Forbidden: not an active pod member' }, { status: 403 });
      }

      // Fetch all pod games (all statuses — pod members see full history)
      const podGames = await base44.asServiceRole.entities.Game.filter(
        { pod_id: podId, context_type: 'pod' }, '-played_at', 100
      );
      if (podGames.length === 0) return Response.json({ games: [], participants: {} });

      const gameIds = podGames.map((g) => g.id);

      // Fetch all participant rows for these games in batches
      const participantArrays = await Promise.all(
        gameIds.map((gid) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: gid }, '-created_date', 20).catch(() => [])
        )
      );

      const participantMap = {};
      gameIds.forEach((gid, i) => {
        participantMap[gid] = participantArrays[i].map(sanitizeParticipant);
      });

      // Collect all profile IDs needed for display
      const allProfileIds = [...new Set(
        participantArrays.flat().map((p) => p.participant_profile_id).filter(Boolean)
      )];

      let profileMap = {};
      if (allProfileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: allProfileIds } }, '-created_date', 200
        );
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, sanitizeProfile(p)]));
      }

      return Response.json({
        games: podGames.map(sanitizeGame),
        participants: participantMap,
        profiles: profileMap,
      });
    }

    // ── userHistory ───────────────────────────────────────────────────────────
    // Returns game history for the authenticated user's own profile only.
    // callerProfileId must equal profileId (enforced — no cross-user personal history).
    // Returns only games where the user was a direct participant.
    // Does NOT include pod games where the user was only a pod member, not a participant.
    if (action === 'userHistory') {
      if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      // Strict gate: own history only
      if (callerProfileId !== profileId) {
        return Response.json({ error: 'Forbidden: can only view own history' }, { status: 403 });
      }

      // Resolve the caller's auth user_id from their Profile record so we can
      // query GameParticipant by participant_user_id — the stable RLS/linkage field.
      // This is safer than filtering by participant_profile_id and is consistent
      // with the confirmed correct query pattern used on the client-side dashboard.
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
      const callerAuthUserId = callerProfileRows[0]?.user_id || null;

      // Find all games where this profile was a direct participant.
      // Use participant_user_id (auth user id) rather than participant_profile_id
      // for consistent, reliable matching — same field used on the client-side fix.
      const myParticipations = callerAuthUserId
        ? await base44.asServiceRole.entities.GameParticipant.filter(
            { participant_user_id: callerAuthUserId }, '-created_date', 200
          )
        : await base44.asServiceRole.entities.GameParticipant.filter(
            { participant_profile_id: profileId }, '-created_date', 200
          );
      if (myParticipations.length === 0) return Response.json({ games: [], participants: {} });

      const gameIds = [...new Set(myParticipations.map((p) => p.game_id))];

      // Fetch games in batches
      const chunks = [];
      for (let i = 0; i < gameIds.length; i += 50) chunks.push(gameIds.slice(i, i + 50));
      const gameResults = await Promise.all(
        chunks.map((chunk) =>
          base44.asServiceRole.entities.Game.filter({ id: { $in: chunk } }, '-played_at', 50).catch(() => [])
        )
      );
      const games = gameResults.flat();

      // Fetch all participant rows per game
      const participantArrays = await Promise.all(
        games.map((g) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: g.id }, '-created_date', 20).catch(() => [])
        )
      );

      const participantMap = {};
      games.forEach((g, i) => {
        participantMap[g.id] = participantArrays[i].map(sanitizeParticipant);
      });

      // Profiles for co-participants
      const allProfileIds = [...new Set(
        participantArrays.flat().map((p) => p.participant_profile_id).filter(Boolean)
      )];

      let profileMap = {};
      if (allProfileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: allProfileIds } }, '-created_date', 200
        );
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, sanitizeProfile(p)]));
      }

      return Response.json({
        games: games.map(sanitizeGame),
        participants: participantMap,
        profiles: profileMap,
      });
    }

    // ── podGameDetails ────────────────────────────────────────────────────────
    // Returns sanitized details for a single pod game, for active pod members.
    // Gate: callerProfileId must be an active member of the game's pod.
    // Does NOT require the caller to be a direct participant in the game.
    // Does NOT broaden raw Game access — uses service role projection only.
    if (action === 'podGameDetails') {
      const { gameId } = body;
      if (!gameId) return Response.json({ error: 'gameId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      // Fetch the game first (service role — bypasses RLS)
      const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gameId });
      if (!gameArr.length) return Response.json({ error: 'not_found' }, { status: 404 });
      const game = gameArr[0];

      // Gate: must be a pod game with a pod_id
      if (!game.pod_id || game.context_type !== 'pod') {
        return Response.json({ error: 'Forbidden: not a pod game' }, { status: 403 });
      }

      // Gate: caller must be an active member of this pod
      const membership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: game.pod_id,
        profile_id: callerProfileId,
        membership_status: 'active',
      });
      if (membership.length === 0) {
        return Response.json({ error: 'Forbidden: not an active pod member' }, { status: 403 });
      }

      // Fetch participants
      const participantArr = await base44.asServiceRole.entities.GameParticipant.filter(
        { game_id: gameId }, '-created_date', 20
      );

      // Fetch profiles for all participants
      const profileIds = [...new Set(participantArr.map((p) => p.participant_profile_id).filter(Boolean))];
      let profileMap = {};
      if (profileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: profileIds } }, '-created_date', 200
        );
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, sanitizeProfile(p)]));
      }

      // Assemble sanitized participant rows with inlined profile display data
      const participants = participantArr.map((p) => {
        const profile = profileMap[p.participant_profile_id] || {};
        return {
          userId: p.participant_profile_id,
          display_name: profile.display_name || "Unknown",
          avatar_url: profile.avatar_url || null,
          is_creator: p.is_creator || false,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: p.approval_status || "pending",
          deck: p.deck_name_at_time ? {
            name: p.deck_name_at_time,
            color_identity: p.deck_snapshot_json?.color_identity || [],
            commander_name: p.commander_name_at_time || null,
          } : null,
        };
      });

      const nonCreators = participantArr.filter((p) => !p.is_creator);
      const assembled = {
        id: game.id,
        status: game.status,
        played_at: game.played_at || game.created_date || null,
        notes: game.notes || "",
        context_type: game.context_type,
        pod_id: game.pod_id,
        participants,
        approvalSummary: {
          total: nonCreators.length,
          approved: nonCreators.filter((p) => p.approval_status === 'approved').length,
          rejected: nonCreators.filter((p) => p.approval_status === 'rejected').length,
          pending: nonCreators.filter((p) => p.approval_status === 'pending').length,
        },
      };

      return Response.json({ game: assembled });
    }

    // ── podLeaderboard ────────────────────────────────────────────────────────
    // Returns computed leaderboard for a pod, for active pod members only.
    // Gate: callerProfileId must be an active member of podId.
    if (action === 'podLeaderboard') {
      if (!podId) return Response.json({ error: 'podId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      // Gate: verify caller is an active member of this pod
      const callerMembership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId,
        profile_id: callerProfileId,
        membership_status: 'active',
      });
      if (callerMembership.length === 0) {
        return Response.json({ error: 'Forbidden: not an active pod member' }, { status: 403 });
      }

      // Fetch all active members
      const activeMembers = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId,
        membership_status: 'active',
      });
      if (activeMembers.length === 0) return Response.json({ leaderboard: [], profiles: {} });

      // Seed stats map with zeroes for every active member
      const statsMap = {};
      for (const m of activeMembers) {
        if (!m.profile_id) continue;
        statsMap[m.profile_id] = { profileId: m.profile_id, games: 0, wins: 0, points: 0 };
      }

      // Fetch approved games for this pod and compute stats
      const allGames = await base44.asServiceRole.entities.Game.filter(
        { pod_id: podId, status: 'approved' }, '-played_at', 200
      );
      if (allGames.length > 0) {
        const participantArrays = await Promise.all(
          allGames.map((g) =>
            base44.asServiceRole.entities.GameParticipant.filter({ game_id: g.id }, '-created_date', 20).catch(() => [])
          )
        );
        for (const p of participantArrays.flat()) {
          const pid = p.participant_profile_id;
          if (!pid || !statsMap[pid]) continue;
          statsMap[pid].games += 1;
          if (p.placement === 1 || p.result === 'win') {
            statsMap[pid].wins += 1;
            statsMap[pid].points += 1;
          }
        }
      }

      const leaderboard = Object.values(statsMap)
        .map((s) => ({ ...s, winRate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : '0.0' }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (parseFloat(b.winRate) !== parseFloat(a.winRate)) return parseFloat(b.winRate) - parseFloat(a.winRate);
          return b.games - a.games;
        });

      // Fetch profiles for all members
      const memberProfileIds = activeMembers.map((m) => m.profile_id).filter(Boolean);
      let profiles = {};
      if (memberProfileIds.length > 0) {
        const profileRows = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: memberProfileIds } }, '-created_date', 200
        );
        profiles = Object.fromEntries(profileRows.map((p) => [p.id, sanitizeProfile(p)]));
      }

      return Response.json({ leaderboard, profiles });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});