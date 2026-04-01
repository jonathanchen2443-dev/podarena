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
 * Normalizes a raw GameParticipant row for display.
 * Builds a consistent `deck` object using all available snapshot fallbacks.
 * Exposes only snapshot fields — never raw selected_deck_id or owner-linked data.
 */
function normalizeParticipant(raw) {
  const snap = raw.deck_snapshot_json || {};
  // Fallback order: deck_name_at_time → snap.name → commander_name_at_time → snap.commander_name
  const deckName = raw.deck_name_at_time || snap.name || raw.commander_name_at_time || snap.commander_name || null;
  const commanderName = raw.commander_name_at_time || snap.commander_name || null;
  const commanderImage = raw.commander_image_at_time || snap.commander_image_url || null;
  const colorIdentity = snap.color_identity || [];
  return {
    participant_profile_id: raw.participant_profile_id,
    is_creator: raw.is_creator || false,
    result: raw.result || null,
    placement: raw.placement || null,
    approval_status: raw.approval_status || "pending",
    deck: deckName ? {
      name: deckName,
      color_identity: colorIdentity,
      commander_name: commanderName,
      commander_image: commanderImage,
    } : null,
  };
}

// Keep sanitizeParticipant as an alias for legacy call sites that don't need the deck object
function sanitizeParticipant(raw) {
  return normalizeParticipant(raw);
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

    // ── getStats / myProfileStats ─────────────────────────────────────────────
    // getStats: public stats for any profile (used by UserProfile page).
    // myProfileStats: self-only stats with POD count, identity-verified.
    //   Uses union of participant_user_id + participant_profile_id to cover all records.
    if (action === 'getStats' || action === 'myProfileStats') {
      const isSelf = action === 'myProfileStats';
      const { callerAuthUserId, callerProfileId } = body;

      // For myProfileStats: identity gate required
      if (isSelf) {
        if (!callerAuthUserId || !callerProfileId) return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden' }, { status: 403 });
      } else {
        if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 });
      }

      const targetProfileId = isSelf ? callerProfileId : profileId;

      // For self: union both query paths to catch all records regardless of linkage
      const [byProfileId, byUserId, decks, podMemberships] = await Promise.all([
        base44.asServiceRole.entities.GameParticipant.filter({ participant_profile_id: targetProfileId }, '-created_date', 500).catch(() => []),
        isSelf && callerAuthUserId
          ? base44.asServiceRole.entities.GameParticipant.filter({ participant_user_id: callerAuthUserId }, '-created_date', 500).catch(() => [])
          : Promise.resolve([]),
        base44.asServiceRole.entities.Deck.filter({ owner_id: targetProfileId }, '-created_date', 200).catch(() => []),
        isSelf
          ? base44.asServiceRole.entities.PODMembership.filter({ user_id: callerAuthUserId, membership_status: 'active' }, '-created_date', 200).catch(() => [])
          : Promise.resolve([]),
      ]);

      // Deduplicate union
      const seenPIds = new Set();
      const allParticipations = [];
      for (const p of [...byProfileId, ...byUserId]) {
        if (!seenPIds.has(p.id)) { seenPIds.add(p.id); allParticipations.push(p); }
      }

      const gameIds = [...new Set(allParticipations.map((p) => p.game_id))];
      let approvedGameIds = new Set();
      if (gameIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < gameIds.length; i += 50) chunks.push(gameIds.slice(i, i + 50));
        const gameResults = await Promise.all(
          chunks.map((chunk) =>
            base44.asServiceRole.entities.Game.filter({ id: { $in: chunk }, status: 'approved' }, '-played_at', 50).catch(() => [])
          )
        );
        approvedGameIds = new Set(gameResults.flat().filter((g) => !g.is_hidden).map((g) => g.id));
      }

      const approved = allParticipations.filter((p) => approvedGameIds.has(p.game_id));
      const gamesPlayed = approved.length;
      const wins = approved.filter((p) => p.placement === 1).length;

      return Response.json({
        stats: {
          gamesPlayed,
          wins,
          decksCount: decks.length,
          activeDecksCount: decks.filter((d) => d.is_active !== false).length,
          // Only included for myProfileStats (private to owner)
          ...(isSelf ? { leaguesCount: podMemberships.length, podsCount: podMemberships.length } : {}),
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

      // Fetch all pod games (all statuses — pod members see full history; hidden games excluded)
      const rawPodGames = await base44.asServiceRole.entities.Game.filter(
        { pod_id: podId, context_type: 'pod' }, '-played_at', 100
      );
      const podGames = rawPodGames.filter((g) => !g.is_hidden);
      if (podGames.length === 0) return Response.json({ games: [], participants: {} });

      const gameIds = podGames.map((g) => g.id);

      // Fetch all participant rows for these games in batches
      const participantArrays = await Promise.all(
        gameIds.map((gid) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: gid }, '-created_date', 20).catch(() => [])
        )
      );

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

      // Build participant map with normalized deck objects + inlined profile display fields
      const participantMap = {};
      gameIds.forEach((gid, i) => {
        participantMap[gid] = participantArrays[i].map((raw) => {
          const normalized = normalizeParticipant(raw);
          const profile = profileMap[raw.participant_profile_id] || {};
          return {
            ...normalized,
            userId: raw.participant_profile_id,
            authUserId: raw.participant_user_id || null,
            display_name: profile.display_name || "Unknown",
            avatar_url: profile.avatar_url || null,
          };
        });
      });

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
      const [byUid, byPid] = await Promise.all([
        callerAuthUserId
          ? base44.asServiceRole.entities.GameParticipant.filter({ participant_user_id: callerAuthUserId }, '-created_date', 200).catch(() => [])
          : Promise.resolve([]),
        base44.asServiceRole.entities.GameParticipant.filter({ participant_profile_id: profileId }, '-created_date', 200).catch(() => []),
      ]);
      const seenParticipationIds = new Set();
      const myParticipations = [];
      for (const p of [...byUid, ...byPid]) {
        if (!seenParticipationIds.has(p.id)) { seenParticipationIds.add(p.id); myParticipations.push(p); }
      }
      if (myParticipations.length === 0) return Response.json({ games: [], participants: {} });

      const gameIds = [...new Set(myParticipations.map((p) => p.game_id))];

      // Fetch games in batches (hidden games excluded from normal user history)
      const chunks = [];
      for (let i = 0; i < gameIds.length; i += 50) chunks.push(gameIds.slice(i, i + 50));
      const gameResults = await Promise.all(
        chunks.map((chunk) =>
          base44.asServiceRole.entities.Game.filter({ id: { $in: chunk } }, '-played_at', 50).catch(() => [])
        )
      );
      const games = gameResults.flat().filter((g) => !g.is_hidden);

      // Fetch all participant rows per game
      const participantArrays = await Promise.all(
        games.map((g) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: g.id }, '-created_date', 20).catch(() => [])
        )
      );

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

      // Build participant map with normalized deck objects + inlined profile display fields
      const participantMap = {};
      games.forEach((g, i) => {
        participantMap[g.id] = participantArrays[i].map((raw) => {
          const normalized = normalizeParticipant(raw);
          const profile = profileMap[raw.participant_profile_id] || {};
          return {
            ...normalized,
            userId: raw.participant_profile_id,
            authUserId: raw.participant_user_id || null,
            display_name: profile.display_name || "Unknown",
            avatar_url: profile.avatar_url || null,
          };
        });
      });

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

      // Fetch pod name for the assembled game response
      let podName = null;
      if (game.pod_id) {
        const podArr2 = await base44.asServiceRole.entities.POD.filter({ id: game.pod_id });
        podName = podArr2[0]?.pod_name || null;
      }

      // Assemble sanitized participant rows with inlined profile display data
      const participants = participantArr.map((p) => {
        const profile = profileMap[p.participant_profile_id] || {};
        const snap = p.deck_snapshot_json || {};
        // Resolve deck fields: prefer explicit snapshot columns, fall back to deck_snapshot_json fields
        const deckName = p.deck_name_at_time || snap.name || null;
        const commanderName = p.commander_name_at_time || snap.commander_name || null;
        const commanderImage = p.commander_image_at_time || snap.commander_image_url || null;
        const colorIdentity = (p.deck_snapshot_json?.color_identity) || [];
        return {
          userId: p.participant_profile_id,
          authUserId: p.participant_user_id || null,
          display_name: profile.display_name || "Unknown",
          avatar_url: profile.avatar_url || null,
          is_creator: p.is_creator || false,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: p.approval_status || "pending",
          deck: deckName ? {
            name: deckName,
            color_identity: colorIdentity,
            commander_name: commanderName,
            commander_image: commanderImage,
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
        pod_name: podName,
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

      // Fetch approved games for this pod and compute stats (hidden games excluded)
      const allRawGames = await base44.asServiceRole.entities.Game.filter(
        { pod_id: podId, status: 'approved' }, '-played_at', 200
      );
      const allGames = allRawGames.filter((g) => !g.is_hidden);
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

    // ── explorePublicPods ─────────────────────────────────────────────────────
    // Returns public active pods with member counts, excluding pods the caller already belongs to.
    if (action === 'explorePublicPods') {
      const { callerAuthUserId } = body;

      // Fetch all public active PODs
      const allPods = await base44.asServiceRole.entities.POD.filter(
        { is_public: true, status: 'active' }, '-created_date', 200
      );
      if (allPods.length === 0) return Response.json({ pods: [] });

      const podIds = allPods.map((p) => p.id);

      // Fetch all active memberships for these pods (to count members and exclude caller's pods)
      const allMemberships = await base44.asServiceRole.entities.PODMembership.filter(
        { pod_id: { $in: podIds }, membership_status: 'active' }, '-created_date', 1000
      );

      // Build member count map
      const countMap = {};
      for (const m of allMemberships) {
        countMap[m.pod_id] = (countMap[m.pod_id] || 0) + 1;
      }

      // Determine which pods the caller is already an active member of
      const callerPodIds = new Set();
      if (callerAuthUserId) {
        for (const m of allMemberships) {
          if (m.user_id === callerAuthUserId) callerPodIds.add(m.pod_id);
        }
      }

      const pods = allPods
        .filter((p) => !callerPodIds.has(p.id))
        .map((p) => ({
          id: p.id,
          pod_name: p.pod_name,
          pod_code: p.pod_code,
          description: p.description || null,
          image_url: p.image_url || null,
          max_members: p.max_members,
          is_public: p.is_public,
          activeMemberCount: countMap[p.id] || 0,
        }));

      return Response.json({ pods });
    }

    // ── pendingApprovalDetails ────────────────────────────────────────────────
    // Returns full pending approval data for the caller, with all participants visible.
    // Gate: callerAuthUserId and callerProfileId must match a real profile.
    if (action === 'pendingApprovalDetails') {
      const { callerAuthUserId, callerProfileId } = body;
      if (!callerAuthUserId || !callerProfileId) {
        return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });
      }

      // Gate: verify callerProfileId matches callerAuthUserId
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
        return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
      }

      // Find all pending (non-creator) participant rows for this user
      const myPendingRows = await base44.asServiceRole.entities.GameParticipant.filter({
        participant_user_id: callerAuthUserId,
        approval_status: 'pending',
        is_creator: false,
      }, '-created_date', 100);

      if (myPendingRows.length === 0) return Response.json({ approvals: [] });

      const gameIds = [...new Set(myPendingRows.map((p) => p.game_id).filter(Boolean))];

      // Fetch games and all participants per game in parallel
      const [gameResults, allParticipantArrays] = await Promise.all([
        Promise.all(gameIds.map((gid) =>
          base44.asServiceRole.entities.Game.filter({ id: gid }).then((r) => r[0] || null).catch(() => null)
        )),
        Promise.all(gameIds.map((gid) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: gid }, '-created_date', 20).catch(() => [])
        )),
      ]);

      // Only keep pending games
      const validGames = gameResults.filter((g) => g && g.status === 'pending');
      const validGameIds = new Set(validGames.map((g) => g.id));

      // Collect all profile IDs and pod IDs needed
      const allProfileIds = new Set();
      const podIds = new Set();
      for (const g of validGames) { if (g.pod_id) podIds.add(g.pod_id); if (g.created_by_profile_id) allProfileIds.add(g.created_by_profile_id); }
      for (const arr of allParticipantArrays) { for (const p of arr) { if (p.participant_profile_id) allProfileIds.add(p.participant_profile_id); } }

      const [profileRows, podRows] = await Promise.all([
        allProfileIds.size > 0
          ? base44.asServiceRole.entities.Profile.filter({ id: { $in: [...allProfileIds] } }, '-created_date', 200)
          : Promise.resolve([]),
        podIds.size > 0
          ? base44.asServiceRole.entities.POD.filter({ id: { $in: [...podIds] } }, '-created_date', 50)
          : Promise.resolve([]),
      ]);

      const profileMap = Object.fromEntries(profileRows.map((p) => [p.id, sanitizeProfile(p)]));
      const podMap = Object.fromEntries(podRows.map((p) => [p.id, p]));

      const approvals = gameIds
        .map((gid, i) => {
          const game = gameResults[i];
          if (!game || !validGameIds.has(gid)) return null;

          const myRow = myPendingRows.find((p) => p.game_id === gid);
          const allParticipants = allParticipantArrays[i];

          const participants = allParticipants.map((p) => {
            const profile = profileMap[p.participant_profile_id] || {};
            const normalized = normalizeParticipant(p);
            return {
              ...normalized,
              userId: p.participant_profile_id,
              authUserId: p.participant_user_id || null,
              display_name: profile.display_name || 'Unknown',
              avatar_url: profile.avatar_url || null,
            };
          });

          const nonCreators = allParticipants.filter((p) => !p.is_creator);
          const approvalSummary = {
            total: nonCreators.length,
            approved: nonCreators.filter((p) => p.approval_status === 'approved').length,
            rejected: nonCreators.filter((p) => p.approval_status === 'rejected').length,
            pending: nonCreators.filter((p) => p.approval_status === 'pending').length,
          };

          const submitterProfile = game.created_by_profile_id ? profileMap[game.created_by_profile_id] : null;
          const pod = game.pod_id ? podMap[game.pod_id] : null;

          return {
            approvalId: myRow?.id,
            gameParticipantId: myRow?.id,
            game: {
              id: game.id,
              status: game.status,
              played_at: game.played_at || game.created_date,
              created_date: game.created_date,
              notes: game.notes || '',
              context_type: game.context_type || 'casual',
              pod_id: game.pod_id || null,
              pod_name: pod?.pod_name || null,
              participants,
              approvalSummary,
            },
            podId: game.pod_id || null,
            contextLabel: game.context_type === 'pod' ? (pod?.pod_name || 'POD Game') : 'Casual Game',
            contextType: game.context_type || 'casual',
            submittedByName: submitterProfile?.display_name || null,
          };
        })
        .filter(Boolean);

      return Response.json({ approvals });
    }

    // ── podMembers ────────────────────────────────────────────────────────────
    // Returns active members of a pod. Gate: callerProfileId must be active member.
    if (action === 'podMembers') {
      if (!podId) return Response.json({ error: 'podId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      const callerMembership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId, profile_id: callerProfileId, membership_status: 'active',
      });
      if (callerMembership.length === 0) {
        return Response.json({ error: 'Forbidden: not an active pod member' }, { status: 403 });
      }

      const allMemberships = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId,
      });
      const activeMembers = allMemberships.filter((m) => m.membership_status === 'active');
      const pendingMembers = allMemberships.filter((m) => m.membership_status === 'pending_request');

      const isAdmin = callerMembership[0]?.role === 'admin';
      const profileIds = [...new Set(
        (isAdmin ? allMemberships : activeMembers).map((m) => m.profile_id).filter(Boolean)
      )];

      let profileMap = {};
      if (profileIds.length > 0) {
        const profileRows = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: profileIds } }, '-created_date', 200
        );
        profileMap = Object.fromEntries(profileRows.map((p) => [p.id, sanitizeProfile(p)]));
      }

      const mapMember = (m) => ({
        id: m.id,
        profileId: m.profile_id,
        display_name: profileMap[m.profile_id]?.display_name || 'Unknown',
        avatar_url: profileMap[m.profile_id]?.avatar_url || null,
        public_user_id: profileMap[m.profile_id]?.public_user_id || null,
        role: m.role || 'member',
        membership_status: m.membership_status,
        joined_at: m.joined_at || null,
        is_favorite: m.is_favorite || false,
        // user_id needed for canManage check (compare with current user) — safe, caller already authenticated
        user_id: m.user_id || null,
      });

      return Response.json({
        members: activeMembers.map(mapMember),
        pendingRequests: isAdmin ? pendingMembers.map(mapMember) : [],
      });
    }

    // ── checkMembership ───────────────────────────────────────────────────────
    // Check if a target user already has a live membership. Gate: caller must be active admin.
    if (action === 'checkMembership') {
      const { targetAuthUserId } = body;
      if (!podId || !targetAuthUserId) return Response.json({ error: 'podId and targetAuthUserId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      const callerMembership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId, profile_id: callerProfileId, membership_status: 'active', role: 'admin',
      });
      if (callerMembership.length === 0) {
        return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
      }

      const existing = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId, user_id: targetAuthUserId,
      });
      const liveRow = existing.find((r) => ['active', 'invited_pending'].includes(r.membership_status));

      return Response.json({
        exists: !!liveRow,
        membership: liveRow ? { id: liveRow.id, membership_status: liveRow.membership_status } : null,
      });
    }

    // ── validateParticipantMembership ─────────────────────────────────────────
    // Check if a participant profile is an active pod member. Gate: caller must be active member.
    if (action === 'validateParticipantMembership') {
      const { participantProfileId } = body;
      if (!podId || !participantProfileId) return Response.json({ error: 'podId and participantProfileId required' }, { status: 400 });
      if (!callerProfileId) return Response.json({ error: 'callerProfileId required' }, { status: 400 });

      const callerMembership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId, profile_id: callerProfileId, membership_status: 'active',
      });
      if (callerMembership.length === 0) {
        return Response.json({ error: 'Forbidden: not an active pod member' }, { status: 403 });
      }

      const participantMembership = await base44.asServiceRole.entities.PODMembership.filter({
        pod_id: podId, profile_id: participantProfileId, membership_status: 'active',
      });

      return Response.json({ isActiveMember: participantMembership.length > 0 });
    }

    // ── createGame ────────────────────────────────────────────────────────────
    // Full game creation flow via asServiceRole — bypasses RLS for participant/notification creates.
    if (action === 'createGame') {
      const { podId, contextType = 'casual', creatorProfileId, creatorAuthUserId, playedAt, notes, participants } = body;

      let step = 'validate_input';
      let gameId = null;
      let participantsCreated = false;
      let notificationsCreated = false;

      try {
        if (!creatorProfileId || !creatorAuthUserId || !Array.isArray(participants)) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate all profile IDs exist
        step = 'validate_profile_ids';
        const profileIds = participants.map((p) => p.profileId).filter(Boolean);
        if (profileIds.length > 0) {
          const found = await base44.asServiceRole.entities.Profile.filter({ id: { $in: profileIds } });
          const foundSet = new Set(found.map((p) => p.id));
          const missing = profileIds.filter((id) => !foundSet.has(id));
          if (missing.length > 0) {
            return Response.json({ error: `Participant profile ID "${missing[0]}" has no matching Profile.` }, { status: 400 });
          }
        }

        // Create the Game record
        step = 'create_game';
        const game = await base44.asServiceRole.entities.Game.create({
          pod_id: podId || null,
          context_type: contextType,
          played_at: playedAt || new Date().toISOString(),
          status: 'pending',
          notes: notes || '',
          created_by_user_id: creatorAuthUserId,
          created_by_profile_id: creatorProfileId,
        });
        gameId = game.id;
        console.log(`[createGame] step=${step} gameId=${gameId} contextType=${contextType} participants=${participants.length}`);

        const nonCreators = participants.filter((p) => p.profileId !== creatorProfileId);

        // Build participant records
        step = 'build_participant_records';
        const participantRecords = participants.map((p) => {
          const isCreator = p.profileId === creatorProfileId;
          const snap = isCreator && p.deckData ? {
            id: p.deckData.id, name: p.deckData.name,
            commander_name: p.deckData.commander_name || null,
            commander_image_url: p.deckData.commander_image_url || null,
            color_identity: p.deckData.color_identity || [],
          } : null;
          return {
            game_id: gameId,
            participant_user_id: p.authUserId || null,
            participant_profile_id: p.profileId,
            is_creator: isCreator,
            selected_deck_id: isCreator ? (p.deck_id || null) : null,
            deck_snapshot_json: snap,
            // Fallback: if deck has no name, use commander name as historical label
            deck_name_at_time: snap?.name || snap?.commander_name || null,
            commander_name_at_time: snap?.commander_name || null,
            commander_image_at_time: snap?.commander_image_url || null,
            result: p.result || null,
            placement: p.placement || null,
            approval_status: isCreator ? 'approved' : 'pending',
            approved_at: isCreator ? new Date().toISOString() : null,
            rejected_at: null,
          };
        });

        step = 'create_participants';
        await base44.asServiceRole.entities.GameParticipant.bulkCreate(participantRecords);
        participantsCreated = true;
        console.log(`[createGame] step=${step} gameId=${gameId} count=${participantRecords.length}`);

        if (nonCreators.length === 0) {
          step = 'finalize_solo_game';
          await base44.asServiceRole.entities.Game.update(gameId, { status: 'approved' });
        } else {
          // Fetch pod name if needed
          let podName = null;
          if (podId) {
            const podArr = await base44.asServiceRole.entities.POD.filter({ id: podId });
            podName = podArr[0]?.pod_name || null;
          }

          step = 'load_created_participants';
          const createdParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId });
          const participantByProfile = Object.fromEntries(createdParticipants.map((p) => [p.participant_profile_id, p]));

          step = 'build_notifications';
          const notifications = nonCreators
            .filter((p) => !!p.authUserId)
            .map((p) => {
              const participantRow = participantByProfile[p.profileId];
              return {
                type: 'game_review_request',
                actor_user_id: creatorAuthUserId,
                recipient_user_id: p.authUserId,
                metadata: {
                  game_id: gameId,
                  game_participant_id: participantRow?.id || null,
                  context_type: contextType,
                  pod_name: podName || null,
                },
              };
            });

          if (notifications.length > 0) {
            step = 'create_notifications';
            await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
            notificationsCreated = true;
            console.log(`[createGame] step=${step} gameId=${gameId} count=${notifications.length}`);
          }
        }

        step = 'finalize_response';
        console.log(`[createGame] success gameId=${gameId}`);
        return Response.json({ game });

      } catch (innerError) {
        console.error('[createGame] FAILED', {
          step,
          error: innerError?.message,
          creatorProfileId,
          creatorAuthUserId,
          participantCount: participants?.length,
          contextType,
          podId: podId || null,
          gameId,
        });

        // Best-effort rollback — clean up in reverse order
        if (gameId) {
          if (notificationsCreated) {
            try {
              const notifs = await base44.asServiceRole.entities.Notification.filter({ metadata: { game_id: gameId } });
              await Promise.all(notifs.map((n) => base44.asServiceRole.entities.Notification.delete(n.id).catch(() => {})));
            } catch (_) {}
          }
          if (participantsCreated) {
            try {
              const parts = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId });
              await Promise.all(parts.map((p) => base44.asServiceRole.entities.GameParticipant.delete(p.id).catch(() => {})));
            } catch (_) {}
          }
          try { await base44.asServiceRole.entities.Game.delete(gameId); } catch (_) {}
        }

        return Response.json({ error: innerError.message || 'Game creation failed' }, { status: 500 });
      }
    }

    // ── dashboardData ─────────────────────────────────────────────────────────
    if (action === 'dashboardData') {
      const { callerAuthUserId, callerProfileId } = body;
      if (!callerAuthUserId || !callerProfileId) return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });

      // Gate: verify identity
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const [memberships, decks, byUserId, byProfileId] = await Promise.all([
        base44.asServiceRole.entities.PODMembership.filter({ user_id: callerAuthUserId, membership_status: 'active' }),
        base44.asServiceRole.entities.Deck.filter({ owner_id: callerProfileId }),
        base44.asServiceRole.entities.GameParticipant.filter({ participant_user_id: callerAuthUserId }, '-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.GameParticipant.filter({ participant_profile_id: callerProfileId }, '-created_date', 20).catch(() => []),
      ]);
      // Merge both queries, deduplicating by id
      const seenIds = new Set();
      const recentParticipations = [];
      for (const p of [...byUserId, ...byProfileId]) {
        if (!seenIds.has(p.id)) { seenIds.add(p.id); recentParticipations.push(p); }
      }

      const gameIds = [...new Set(recentParticipations.map((p) => p.game_id))].slice(0, 10);
      let recentGames = [];
      if (gameIds.length > 0) {
        const games = await base44.asServiceRole.entities.Game.filter({ id: { $in: gameIds } }, '-played_at', 10);
        recentGames = games
          .filter((g) => !g.is_hidden)
          .sort((a, b) => new Date(b.played_at || b.created_date) - new Date(a.played_at || a.created_date))
          .slice(0, 5)
          .map((g) => ({ id: g.id, context_type: g.context_type || 'casual', pod_id: g.pod_id || null, status: g.status, played_at: g.played_at || g.created_date }));
      }

      // Pending approvals: my non-creator pending participant rows where game is still pending
      const pendingParticipations = recentParticipations.filter((p) => p.approval_status === 'pending' && !p.is_creator);
      let pendingApprovalsCount = 0;
      if (pendingParticipations.length > 0) {
        const pendingGameIds = [...new Set(pendingParticipations.map((p) => p.game_id))];
        const pendingGames = await base44.asServiceRole.entities.Game.filter({ id: { $in: pendingGameIds }, status: 'pending' });
        pendingApprovalsCount = pendingGames.length;
      }

      // Enrich recent games with pod_name
      const podIdsForNames = [...new Set(recentGames.map((g) => g.pod_id).filter(Boolean))];
      let podNameMap = {};
      if (podIdsForNames.length > 0) {
        const podRows = await base44.asServiceRole.entities.POD.filter({ id: { $in: podIdsForNames } }, '-created_date', 20);
        podNameMap = Object.fromEntries(podRows.map((p) => [p.id, p.pod_name]));
      }
      const enrichedRecentGames = recentGames.map((g) => ({
        ...g,
        pod_name: g.pod_id ? (podNameMap[g.pod_id] || null) : null,
      }));

      return Response.json({
        myPodsCount: memberships.length,
        myDecksCount: decks.length,
        pendingApprovalsCount,
        recentGames: enrichedRecentGames,
      });
    }

    // ── myPods ────────────────────────────────────────────────────────────────
    if (action === 'myPods') {
      const { callerAuthUserId, callerProfileId } = body;
      if (!callerAuthUserId || !callerProfileId) return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });

      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const memberships = await base44.asServiceRole.entities.PODMembership.filter({ user_id: callerAuthUserId, membership_status: 'active' });
      if (memberships.length === 0) return Response.json({ pods: [], memberships: [] });

      const podIds = [...new Set(memberships.map((m) => m.pod_id))];
      const pods = await base44.asServiceRole.entities.POD.filter({ id: { $in: podIds }, status: 'active' });

      return Response.json({
        pods: pods.map((p) => ({ id: p.id, pod_name: p.pod_name, pod_code: p.pod_code, description: p.description || null, image_url: p.image_url || null, max_members: p.max_members, status: p.status })),
        memberships: memberships.map((m) => ({ id: m.id, pod_id: m.pod_id, is_favorite: m.is_favorite || false, role: m.role || 'member' })),
      });
    }

    // ── myNotifications ───────────────────────────────────────────────────────
    if (action === 'myNotifications') {
      const { callerAuthUserId } = body;
      if (!callerAuthUserId) return Response.json({ error: 'callerAuthUserId required' }, { status: 400 });

      const notifications = await base44.asServiceRole.entities.Notification.filter(
        { recipient_user_id: callerAuthUserId }, '-created_date', 100
      );
      return Response.json({ notifications });
    }

    // ── searchProfilesForGameLog ──────────────────────────────────────────────
    // On-demand profile search for the casual participant picker.
    // Returns user_id so participant_user_id linkage is correct — only for authenticated callers.
    if (action === 'searchProfilesForGameLog') {
      const { searchQuery } = body;
      if (!searchQuery || searchQuery.trim().length < 2) return Response.json({ profiles: [] });
      const q = searchQuery.trim().toLowerCase();

      // Search by display_name_lc, username_lc, and exact public_user_id in parallel
      const [byName, byUsername, byUid] = await Promise.all([
        base44.asServiceRole.entities.Profile.filter({ display_name_lc: { $regex: q } }, '-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.Profile.filter({ username_lc: { $regex: q } }, '-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.Profile.filter({ public_user_id: { $regex: q } }, '-created_date', 10).catch(() => []),
      ]);

      const seen = new Set();
      const merged = [];
      for (const p of [...byName, ...byUsername, ...byUid]) {
        if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
      }

      return Response.json({
        profiles: merged.slice(0, 15).map((p) => ({
          id: p.id,
          user_id: p.user_id || null,
          display_name: p.display_name || 'Unknown',
          public_user_id: p.public_user_id || null,
          avatar_url: p.avatar_url || null,
          username: p.username || null,
        })),
      });
    }

    // ── validateProfileIds ────────────────────────────────────────────────────
    if (action === 'validateProfileIds') {
      const { profileIds } = body;
      if (!Array.isArray(profileIds) || profileIds.length === 0) return Response.json({ valid: true, missing: [] });
      const found = await base44.asServiceRole.entities.Profile.filter({ id: { $in: profileIds } });
      const foundSet = new Set(found.map((p) => p.id));
      const missing = profileIds.filter((id) => !foundSet.has(id));
      return Response.json({ valid: missing.length === 0, missing });
    }

    // ── gameDetailsForParticipant ─────────────────────────────────────────────
    // Returns assembled game details for ANY game (casual or pod) where caller is a participant.
    // Gate: callerAuthUserId must have a row in GameParticipant for this game.
    if (action === 'gameDetailsForParticipant') {
      const { gameId, callerAuthUserId } = body;
      if (!gameId || !callerAuthUserId) return Response.json({ error: 'gameId and callerAuthUserId required' }, { status: 400 });

      const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gameId });
      if (!gameArr.length) return Response.json({ error: 'not_found' }, { status: 404 });
      const game = gameArr[0];

      const participantArr = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);

      // Gate: caller must be a participant
      const isParticipant = participantArr.some((p) => p.participant_user_id === callerAuthUserId);
      if (!isParticipant) return Response.json({ error: 'Forbidden: not a participant' }, { status: 403 });

      const profileIds = [...new Set(participantArr.map((p) => p.participant_profile_id).filter(Boolean))];
      let profileMap = {};
      if (profileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter({ id: { $in: profileIds } }, '-created_date', 200);
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, sanitizeProfile(p)]));
      }

      const participants = participantArr.map((p) => {
        const profile = profileMap[p.participant_profile_id] || {};
        const snap = p.deck_snapshot_json || {};
        const deckName = p.deck_name_at_time || snap.name || null;
        const commanderName = p.commander_name_at_time || snap.commander_name || null;
        const commanderImage = p.commander_image_at_time || snap.commander_image_url || null;
        const colorIdentity = snap.color_identity || [];
        return {
          userId: p.participant_profile_id,
          authUserId: p.participant_user_id || null,
          display_name: profile.display_name || 'Unknown',
          avatar_url: profile.avatar_url || null,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: p.approval_status || 'pending',
          is_creator: p.is_creator || false,
          deck: deckName ? {
            name: deckName,
            color_identity: colorIdentity,
            commander_name: commanderName,
            commander_image: commanderImage,
          } : null,
        };
      });

      // Fetch pod name
      let podNameForGame = null;
      if (game.pod_id) {
        const podArrForGame = await base44.asServiceRole.entities.POD.filter({ id: game.pod_id });
        podNameForGame = podArrForGame[0]?.pod_name || null;
      }

      const nonCreators = participantArr.filter((p) => !p.is_creator);
      const assembled = {
        id: game.id,
        status: game.status,
        played_at: game.played_at || game.created_date || null,
        notes: game.notes || '',
        context_type: game.context_type || 'casual',
        pod_id: game.pod_id || null,
        pod_name: podNameForGame,
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

    // ── approveGameReview ─────────────────────────────────────────────────────
    // RLS-safe approve flow for a non-creator participant.
    // All reads/writes use asServiceRole — works for any authenticated user.
    if (action === 'approveGameReview') {
      const { gameId, callerAuthUserId, callerProfileId, deckId } = body;
      let step = 'validate_input';
      try {
        if (!gameId || !callerAuthUserId || !callerProfileId || !deckId) {
          return Response.json({ error: 'gameId, callerAuthUserId, callerProfileId, and deckId are required' }, { status: 400 });
        }

        // Verify caller identity
        step = 'verify_identity';
        const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
          console.error('[approveGameReview] identity mismatch', { step, gameId, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        // Load game
        step = 'load_game';
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gameId });
        if (!gameArr.length) return Response.json({ error: 'Game not found' }, { status: 404 });
        const game = gameArr[0];
        if (game.status !== 'pending') {
          return Response.json({ error: `Game is already ${game.status}` }, { status: 400 });
        }

        // Load all participant rows for this game
        step = 'load_participants';
        const allParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);

        // Match caller — primary: participant_user_id; fallback: participant_profile_id
        step = 'match_caller_participant';
        let myParticipant = allParticipants.find((p) => p.participant_user_id === callerAuthUserId);
        if (!myParticipant) {
          myParticipant = allParticipants.find((p) => p.participant_profile_id === callerProfileId);
        }
        if (!myParticipant) {
          console.error('[approveGameReview] not a participant', { step, gameId, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: you are not a participant in this game' }, { status: 403 });
        }
        if (myParticipant.is_creator) {
          return Response.json({ error: 'Forbidden: creator cannot approve as reviewer' }, { status: 403 });
        }
        if (myParticipant.approval_status !== 'pending') {
          return Response.json({ error: `Already responded: status is ${myParticipant.approval_status}` }, { status: 400 });
        }

        // Validate deck belongs to caller
        step = 'validate_deck';
        const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
        if (!deckRows.length) {
          console.error('[approveGameReview] deck not found', { step, gameId, callerProfileId, deckId });
          return Response.json({ error: 'Deck not found' }, { status: 404 });
        }
        const deck = deckRows[0];
        if (deck.owner_id !== callerProfileId) {
          console.error('[approveGameReview] deck not owned by caller', { step, gameId, callerProfileId, deckId, deckOwnerId: deck.owner_id });
          return Response.json({ error: 'Forbidden: deck does not belong to you' }, { status: 403 });
        }
        if (deck.is_active === false) {
          return Response.json({ error: 'Selected deck is inactive' }, { status: 400 });
        }

        // Build deck snapshot
        step = 'build_snapshot';
        const snap = {
          id: deck.id,
          name: deck.name,
          commander_name: deck.commander_name || null,
          commander_image_url: deck.commander_image_url || null,
          color_identity: deck.color_identity || [],
        };

        // Update participant row
        step = 'update_participant';
        await base44.asServiceRole.entities.GameParticipant.update(myParticipant.id, {
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          rejected_at: null,
          selected_deck_id: deckId,
          deck_snapshot_json: snap,
          // Fallback: if deck has no name, use commander name as historical label
          deck_name_at_time: snap.name || snap.commander_name || null,
          commander_name_at_time: snap.commander_name || null,
          commander_image_at_time: snap.commander_image_url || null,
        });
        console.log('[approveGameReview] participant updated', { gameId, participantId: myParticipant.id, callerAuthUserId });

        // Mark review notification as read
        step = 'mark_notification_read';
        try {
          const notifs = await base44.asServiceRole.entities.Notification.filter({
            recipient_user_id: callerAuthUserId,
            type: 'game_review_request',
          });
          const pending = notifs.find((n) => n.metadata?.game_id === gameId && !n.read_at);
          if (pending) {
            await base44.asServiceRole.entities.Notification.update(pending.id, { read_at: new Date().toISOString() });
          }
        } catch (_) { /* non-critical */ }

        // Recalculate game status
        step = 'recalculate_status';
        const freshParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);
        const reviewable = freshParticipants.filter((p) => !p.is_creator);
        let newStatus = 'pending';
        if (reviewable.length === 0) newStatus = 'approved';
        else if (reviewable.some((p) => p.approval_status === 'rejected')) newStatus = 'rejected';
        else if (reviewable.every((p) => p.approval_status === 'approved')) newStatus = 'approved';
        await base44.asServiceRole.entities.Game.update(gameId, { status: newStatus });
        console.log('[approveGameReview] recalculated', { gameId, newStatus });

        step = 'finalize_response';
        return Response.json({ success: true, participantStatus: 'approved', gameStatus: newStatus });

      } catch (err) {
        console.error('[approveGameReview] FAILED', { step, gameId, callerAuthUserId, callerProfileId, deckId, error: err?.message });
        return Response.json({ error: err.message || 'Approve failed' }, { status: 500 });
      }
    }

    // ── rejectGameReview ──────────────────────────────────────────────────────
    // RLS-safe reject flow for a non-creator participant.
    if (action === 'rejectGameReview') {
      const { gameId, callerAuthUserId, callerProfileId, reason } = body;
      let step = 'validate_input';
      try {
        if (!gameId || !callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'gameId, callerAuthUserId, and callerProfileId are required' }, { status: 400 });
        }

        // Verify caller identity
        step = 'verify_identity';
        const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
          console.error('[rejectGameReview] identity mismatch', { step, gameId, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        // Load game
        step = 'load_game';
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gameId });
        if (!gameArr.length) return Response.json({ error: 'Game not found' }, { status: 404 });
        const game = gameArr[0];
        if (game.status !== 'pending') {
          return Response.json({ error: `Game is already ${game.status}` }, { status: 400 });
        }

        // Load participants
        step = 'load_participants';
        const allParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);

        // Match caller — primary: participant_user_id; fallback: participant_profile_id
        step = 'match_caller_participant';
        let myParticipant = allParticipants.find((p) => p.participant_user_id === callerAuthUserId);
        if (!myParticipant) {
          myParticipant = allParticipants.find((p) => p.participant_profile_id === callerProfileId);
        }
        if (!myParticipant) {
          console.error('[rejectGameReview] not a participant', { step, gameId, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: you are not a participant in this game' }, { status: 403 });
        }
        if (myParticipant.is_creator) {
          return Response.json({ error: 'Forbidden: creator cannot reject as reviewer' }, { status: 403 });
        }
        if (myParticipant.approval_status !== 'pending') {
          return Response.json({ error: `Already responded: status is ${myParticipant.approval_status}` }, { status: 400 });
        }

        // Update participant row
        step = 'update_participant';
        await base44.asServiceRole.entities.GameParticipant.update(myParticipant.id, {
          approval_status: 'rejected',
          rejected_at: new Date().toISOString(),
          approved_at: null,
        });
        console.log('[rejectGameReview] participant updated', { gameId, participantId: myParticipant.id, callerAuthUserId });

        // Mark review notification as read
        step = 'mark_notification_read';
        try {
          const notifs = await base44.asServiceRole.entities.Notification.filter({
            recipient_user_id: callerAuthUserId,
            type: 'game_review_request',
          });
          const pending = notifs.find((n) => n.metadata?.game_id === gameId && !n.read_at);
          if (pending) {
            await base44.asServiceRole.entities.Notification.update(pending.id, { read_at: new Date().toISOString() });
          }
        } catch (_) { /* non-critical */ }

        // Recalculate game status
        step = 'recalculate_status';
        const freshParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);
        const reviewable = freshParticipants.filter((p) => !p.is_creator);
        let newStatus = 'pending';
        if (reviewable.length === 0) newStatus = 'approved';
        else if (reviewable.some((p) => p.approval_status === 'rejected')) newStatus = 'rejected';
        else if (reviewable.every((p) => p.approval_status === 'approved')) newStatus = 'approved';
        await base44.asServiceRole.entities.Game.update(gameId, { status: newStatus });
        console.log('[rejectGameReview] recalculated', { gameId, newStatus });

        step = 'finalize_response';
        return Response.json({ success: true, participantStatus: 'rejected', gameStatus: newStatus });

      } catch (err) {
        console.error('[rejectGameReview] FAILED', { step, gameId, callerAuthUserId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'Reject failed' }, { status: 500 });
      }
    }

    // ── recalculateGameStatus ─────────────────────────────────────────────────
    // Uses asServiceRole to read ALL participants and set the correct game status.
    if (action === 'recalculateGameStatus') {
      const { gameId } = body;
      if (!gameId) return Response.json({ error: 'gameId required' }, { status: 400 });

      const allParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);
      const reviewable = allParticipants.filter((p) => !p.is_creator);

      let newStatus = 'pending';
      if (reviewable.length === 0) {
        newStatus = 'approved';
      } else {
        const hasRejection = reviewable.some((p) => p.approval_status === 'rejected');
        const allApproved = reviewable.every((p) => p.approval_status === 'approved');
        if (hasRejection) newStatus = 'rejected';
        else if (allApproved) newStatus = 'approved';
      }

      await base44.asServiceRole.entities.Game.update(gameId, { status: newStatus });
      return Response.json({ status: newStatus });
    }

    // ── searchMyPodsForLogGame ────────────────────────────────────────────────
    // Returns PODs the caller is an active member of, filtered by query.
    // Used by PodSearchPicker in free POD mode inside Log Game.
    if (action === 'searchMyPodsForLogGame') {
      const { callerAuthUserId, callerProfileId, query: searchQ } = body;
      let step = 'validate_input';
      try {
        if (!callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });
        }

        step = 'validate_identity';
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) {
          console.error('[searchMyPodsForLogGame] identity mismatch', { step, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        step = 'load_memberships';
        const memberships = await base44.asServiceRole.entities.PODMembership.filter({
          user_id: callerAuthUserId,
          membership_status: 'active',
        });
        const podIds = [...new Set(memberships.map((m) => m.pod_id).filter(Boolean))];
        console.log('[searchMyPodsForLogGame] step=load_memberships podCount=', podIds.length, 'callerAuthUserId=', callerAuthUserId);

        if (podIds.length === 0) return Response.json({ pods: [] });

        step = 'load_pods';
        const pods = await base44.asServiceRole.entities.POD.filter({
          id: { $in: podIds },
          status: 'active',
        }, '-created_date', 100);

        step = 'filter_search';
        const q = (searchQ || '').trim().toLowerCase();
        const filtered = q
          ? pods.filter((p) =>
              p.pod_name?.toLowerCase().includes(q) ||
              p.pod_code?.toLowerCase().includes(q)
            )
          : pods;

        step = 'build_response';
        const result = filtered.slice(0, 20).map((p) => ({
          id: p.id,
          pod_name: p.pod_name,
          pod_code: p.pod_code,
          image_url: p.image_url || null,
          status: p.status,
        }));
        console.log('[searchMyPodsForLogGame] success query=', q, 'results=', result.length);
        return Response.json({ pods: result });

      } catch (err) {
        console.error('[searchMyPodsForLogGame] FAILED', { step, callerAuthUserId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'searchMyPodsForLogGame failed' }, { status: 500 });
      }
    }

    // ── logGamePodContext ─────────────────────────────────────────────────────
    // Loads the POD record and its active members for the LogGame locked POD flow.
    // Used when LogGame is opened with a podId in the URL (from a POD page).
    if (action === 'logGamePodContext') {
      const { podId: ctxPodId, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!ctxPodId) return Response.json({ error: 'podId required' }, { status: 400 });
        if (!callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });
        }

        step = 'validate_identity';
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) {
          console.error('[logGamePodContext] identity mismatch', { step, ctxPodId, callerAuthUserId, callerProfileId });
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        step = 'load_pod';
        const podArr = await base44.asServiceRole.entities.POD.filter({ id: ctxPodId });
        if (!podArr.length) {
          console.error('[logGamePodContext] pod not found', { step, ctxPodId });
          return Response.json({ notFound: true, error: 'POD not found' }, { status: 404 });
        }
        const pod = podArr[0];
        if (pod.status !== 'active') {
          return Response.json({ error: 'POD is not active' }, { status: 400 });
        }

        step = 'load_memberships';
        const allMemberships = await base44.asServiceRole.entities.PODMembership.filter({ pod_id: ctxPodId });
        const activeMembers = allMemberships.filter((m) => m.membership_status === 'active');

        // Verify caller is an active member
        const callerMembership = activeMembers.find((m) => m.user_id === callerAuthUserId);
        if (!callerMembership) {
          console.error('[logGamePodContext] caller not active member', { step, ctxPodId, callerAuthUserId });
          return Response.json({ error: 'Forbidden: you are not an active member of this POD' }, { status: 403 });
        }

        step = 'derive_member_payload';
        const profileIds = [...new Set(activeMembers.map((m) => m.profile_id).filter(Boolean))];
        let profileMap = {};
        if (profileIds.length > 0) {
          const profileRows = await base44.asServiceRole.entities.Profile.filter(
            { id: { $in: profileIds } }, '-created_date', 200
          );
          profileMap = Object.fromEntries(profileRows.map((p) => [p.id, p]));
        }

        const members = activeMembers.map((m) => {
          const p = profileMap[m.profile_id] || {};
          return {
            profileId: m.profile_id,
            user_id: m.user_id || null,
            display_name: p.display_name || 'Unknown',
            avatar_url: p.avatar_url || null,
          };
        }).filter((m) => m.profileId);

        step = 'build_response';
        const safePod = {
          id: pod.id,
          pod_name: pod.pod_name,
          pod_code: pod.pod_code,
          image_url: pod.image_url || null,
          status: pod.status,
        };

        console.log('[logGamePodContext] success podId=', ctxPodId, 'memberCount=', members.length);
        return Response.json({
          pod: safePod,
          members,
          isActiveMember: true,
        });

      } catch (err) {
        console.error('[logGamePodContext] FAILED', { step, ctxPodId: body?.podId, callerAuthUserId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'logGamePodContext failed' }, { status: 500 });
      }
    }

    // ── podPageData ───────────────────────────────────────────────────────────
    // Loads all data needed for the Pod page in one call via asServiceRole.
    // Supports guests (no callerAuthUserId) for public pods.
    if (action === 'podPageData') {
      const { podId, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!podId) return Response.json({ error: 'podId required' }, { status: 400 });

        // Optional identity verification — only when both ids are provided
        step = 'validate_identity';
        if (callerAuthUserId && callerProfileId) {
          const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
          if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
            console.error('[podPageData] identity mismatch', { step, podId, callerAuthUserId, callerProfileId });
            return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
          }
        }

        // Load POD
        step = 'load_pod';
        const podArr = await base44.asServiceRole.entities.POD.filter({ id: podId });
        if (!podArr.length) {
          console.error('[podPageData] pod not found', { step, podId, callerAuthUserId });
          return Response.json({ notFound: true, error: 'POD not found' }, { status: 404 });
        }
        const pod = podArr[0];

        // Load memberships
        step = 'load_memberships';
        const allMemberships = await base44.asServiceRole.entities.PODMembership.filter({ pod_id: podId });
        const activeMembers = allMemberships.filter((m) => m.membership_status === 'active');
        const activeMemberCount = activeMembers.length;

        // Resolve caller's membership
        let myMembership = null;
        if (callerAuthUserId) {
          // Primary match: user_id; fallback: profile_id
          myMembership = allMemberships.find((m) => m.user_id === callerAuthUserId) || null;
          if (!myMembership && callerProfileId) {
            myMembership = allMemberships.find((m) => m.profile_id === callerProfileId) || null;
          }
        }

        // Derive access
        step = 'derive_access';
        const isActiveMember = myMembership?.membership_status === 'active';
        const hasPendingOrInvite = myMembership && ['pending_request', 'invited_pending'].includes(myMembership.membership_status);
        const isAdmin = myMembership?.role === 'admin' && isActiveMember;

        // Access rules: public pods viewable by all; private pods require a relationship
        const hasRelationship = isActiveMember || hasPendingOrInvite;
        if (!pod.is_public && !hasRelationship) {
          console.error('[podPageData] forbidden: private pod, no relationship', { step, podId, callerAuthUserId, access: 'forbidden' });
          return Response.json({ forbidden: true, error: 'Forbidden: this is a private POD' }, { status: 403 });
        }

        // Build response
        step = 'build_response';
        const safePod = {
          id: pod.id,
          pod_name: pod.pod_name,
          pod_code: pod.pod_code,
          description: pod.description || null,
          image_url: pod.image_url || null,
          max_members: pod.max_members,
          is_public: pod.is_public,
          status: pod.status,
          admin_user_id: pod.admin_user_id || null,
          admin_profile_id: pod.admin_profile_id || null,
        };

        step = 'finalize_response';
        console.log('[podPageData] success', { podId, callerAuthUserId, isActiveMember, isAdmin, activeMemberCount });
        return Response.json({
          pod: safePod,
          activeMemberCount,
          myMembership: myMembership || null,
          isActiveMember,
          hasPendingOrInvite,
          isAdmin,
          canRequestJoin: !!(callerAuthUserId && !isActiveMember && !hasPendingOrInvite),
        });

      } catch (err) {
        console.error('[podPageData] FAILED', { step, podId, callerAuthUserId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'podPageData failed' }, { status: 500 });
      }
    }

    // ── acceptPodInvite ───────────────────────────────────────────────────────
    if (action === 'acceptPodInvite') {
      const { membershipId, callerAuthUserId } = body;
      if (!membershipId || !callerAuthUserId) return Response.json({ error: 'membershipId and callerAuthUserId required' }, { status: 400 });

      const rows = await base44.asServiceRole.entities.PODMembership.filter({ id: membershipId });
      if (!rows.length) return Response.json({ error: 'not_found' }, { status: 404 });
      const membership = rows[0];

      if (membership.user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (membership.membership_status !== 'invited_pending') return Response.json({ error: 'Not in invited_pending state' }, { status: 400 });

      await base44.asServiceRole.entities.PODMembership.update(membershipId, {
        membership_status: 'active',
        joined_at: new Date().toISOString(),
        decided_at: new Date().toISOString(),
      });
      return Response.json({ success: true });
    }

    // ── declinePodInvite ──────────────────────────────────────────────────────
    if (action === 'declinePodInvite') {
      const { membershipId, callerAuthUserId } = body;
      if (!membershipId || !callerAuthUserId) return Response.json({ error: 'membershipId and callerAuthUserId required' }, { status: 400 });

      const rows = await base44.asServiceRole.entities.PODMembership.filter({ id: membershipId });
      if (!rows.length) return Response.json({ error: 'not_found' }, { status: 404 });
      const membership = rows[0];

      if (membership.user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden' }, { status: 403 });

      await base44.asServiceRole.entities.PODMembership.update(membershipId, {
        membership_status: 'rejected',
        decided_at: new Date().toISOString(),
      });
      return Response.json({ success: true });
    }

    // ── inboxSummary ──────────────────────────────────────────────────────────
    // Returns unread counts for the top bar badge and inbox filters.
    // Single source of truth — same query used by both TopBar and Inbox.
    if (action === 'inboxSummary') {
      const { callerAuthUserId, callerProfileId } = body;
      if (!callerAuthUserId || !callerProfileId) return Response.json({ error: 'callerAuthUserId and callerProfileId required' }, { status: 400 });

      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const [notifications, pendingParticipantRows] = await Promise.all([
        base44.asServiceRole.entities.Notification.filter({ recipient_user_id: callerAuthUserId }, '-created_date', 200),
        base44.asServiceRole.entities.GameParticipant.filter({
          participant_user_id: callerAuthUserId,
          approval_status: 'pending',
          is_creator: false,
        }, '-created_date', 100),
      ]);

      // For pending approvals count: only count games that are still pending
      let pendingApprovalsCount = 0;
      if (pendingParticipantRows.length > 0) {
        const gameIds = [...new Set(pendingParticipantRows.map((p) => p.game_id).filter(Boolean))];
        const pendingGames = await base44.asServiceRole.entities.Game.filter({ id: { $in: gameIds }, status: 'pending' });
        pendingApprovalsCount = pendingGames.length;
      }

      const podInviteNotifs = notifications.filter((n) => n.type === 'pod_invite');
      const systemNotifs = notifications.filter((n) => n.type === 'system_message' || !n.type);

      const unreadInvites = podInviteNotifs.filter((n) => !n.read_at).length;
      const unreadSystem = systemNotifs.filter((n) => !n.read_at).length;
      const totalUnread = pendingApprovalsCount + unreadInvites + unreadSystem;

      return Response.json({
        totalUnread,
        pendingApprovalsCount,
        unreadInvites,
        unreadSystem,
      });
    }

    // ── deletePOD ─────────────────────────────────────────────────────────────
    // Permanently deletes a POD. Admin-only. Cleans up memberships and notifications.
    // Game history is preserved (games/participants are kept but pod_id reference remains
    // as an archived reference — games are not deleted to preserve historical records).
    if (action === 'deletePOD') {
      const { podId: delPodId, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!delPodId || !callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'podId, callerAuthUserId, callerProfileId required' }, { status: 400 });
        }

        step = 'validate_identity';
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) {
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        step = 'validate_admin';
        const adminMembership = await base44.asServiceRole.entities.PODMembership.filter({
          pod_id: delPodId, user_id: callerAuthUserId, role: 'admin', membership_status: 'active',
        });
        if (adminMembership.length === 0) {
          return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
        }

        step = 'load_pod';
        const podRows = await base44.asServiceRole.entities.POD.filter({ id: delPodId });
        if (!podRows.length) return Response.json({ error: 'POD not found' }, { status: 404 });

        // Clean up all memberships for this pod
        step = 'delete_memberships';
        const allMemberships = await base44.asServiceRole.entities.PODMembership.filter({ pod_id: delPodId });
        await Promise.all(allMemberships.map((m) =>
          base44.asServiceRole.entities.PODMembership.delete(m.id).catch(() => {})
        ));
        console.log('[deletePOD] deleted memberships', allMemberships.length, 'for pod', delPodId);

        // Clean up pod_invite notifications for this pod
        step = 'delete_notifications';
        const podNotifs = await base44.asServiceRole.entities.Notification.filter({ pod_id: delPodId });
        await Promise.all(podNotifs.map((n) =>
          base44.asServiceRole.entities.Notification.delete(n.id).catch(() => {})
        ));
        console.log('[deletePOD] deleted notifications', podNotifs.length, 'for pod', delPodId);

        // Delete the POD record
        step = 'delete_pod';
        await base44.asServiceRole.entities.POD.delete(delPodId);
        console.log('[deletePOD] deleted pod', delPodId);

        // Note: Games and GameParticipants are preserved intentionally.
        // They retain pod_id as a historical reference but the POD record is gone.
        // This is the safest default — game history is not orphaned destructively.

        return Response.json({ success: true });
      } catch (err) {
        console.error('[deletePOD] FAILED', { step, delPodId, callerAuthUserId, error: err?.message });
        return Response.json({ error: err.message || 'Delete POD failed' }, { status: 500 });
      }
    }

    // ── founderListGames ──────────────────────────────────────────────────────
    // Founder-only: search/list games with optional ID, participant, date range, hidden filter.
    if (action === 'founderListGames') {
      const { callerProfileId, callerAuthUserId, gameId: searchGameId, participantProfileId, dateFrom, dateTo, includeHidden } = body;
      if (!callerProfileId || !callerAuthUserId) return Response.json({ error: 'callerProfileId and callerAuthUserId required' }, { status: 400 });

      // Gate: verify Founder
      const settingsRows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
      const founderIds = settingsRows[0]?.founder_user_ids || [];
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
        return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
      }
      const callerProfileEntityId = callerProfileRows[0].id;
      if (!founderIds.includes(callerProfileEntityId)) {
        return Response.json({ error: 'Forbidden: Founder only' }, { status: 403 });
      }

      // If participant filter provided, first resolve game IDs via GameParticipant
      let participantGameIds = null;
      if (participantProfileId) {
        const participantRows = await base44.asServiceRole.entities.GameParticipant.filter(
          { participant_profile_id: participantProfileId }, '-created_date', 200
        );
        participantGameIds = [...new Set(participantRows.map((p) => p.game_id).filter(Boolean))];
        if (participantGameIds.length === 0) return Response.json({ games: [] });
      }

      // Build filter
      const filter = {};
      if (searchGameId) filter.id = { $regex: searchGameId.trim() };
      if (participantGameIds) filter.id = { $in: participantGameIds };
      if (dateFrom) filter.played_at = { ...(filter.played_at || {}), $gte: new Date(dateFrom).toISOString() };
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.played_at = { ...(filter.played_at || {}), $lte: endOfDay.toISOString() };
      }

      const rawGames = await base44.asServiceRole.entities.Game.filter(filter, '-played_at', 100);
      // Filter hidden unless explicitly requested
      const visibleGames = includeHidden ? rawGames : rawGames.filter((g) => !g.is_hidden || includeHidden);

      if (visibleGames.length === 0) return Response.json({ games: [] });

      // Fetch participants to build summary
      const gameIds = visibleGames.map((g) => g.id);
      const participantArrays = await Promise.all(
        gameIds.map((gid) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: gid }, '-created_date', 20).catch(() => [])
        )
      );

      // Fetch profile names
      const allProfileIds = [...new Set(participantArrays.flat().map((p) => p.participant_profile_id).filter(Boolean))];
      let profileMap = {};
      if (allProfileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter({ id: { $in: allProfileIds } }, '-created_date', 200);
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name || 'Unknown']));
      }

      // Fetch pod names
      const podIdsNeeded = [...new Set(rawGames.map((g) => g.pod_id).filter(Boolean))];
      let podNameMap = {};
      if (podIdsNeeded.length > 0) {
        const pods = await base44.asServiceRole.entities.POD.filter({ id: { $in: podIdsNeeded } }, '-created_date', 50);
        podNameMap = Object.fromEntries(pods.map((p) => [p.id, p.pod_name]));
      }

      const games = visibleGames.map((g, i) => {
        const parts = participantArrays[i] || [];
        const names = parts.map((p) => profileMap[p.participant_profile_id] || '?').join(', ');
        return {
          id: g.id,
          status: g.status,
          context_type: g.context_type || 'casual',
          pod_id: g.pod_id || null,
          pod_name: g.pod_id ? (podNameMap[g.pod_id] || null) : null,
          played_at: g.played_at || g.created_date || null,
          created_date: g.created_date || null,
          notes: g.notes || '',
          is_hidden: g.is_hidden || false,
          hidden_at: g.hidden_at || null,
          participant_count: parts.length,
          participant_names: names,
        };
      });

      return Response.json({ games });
    }

    // ── founderHideGame ───────────────────────────────────────────────────────
    // Founder-only: soft-hide a game from all normal surfaces.
    if (action === 'founderHideGame') {
      const { callerProfileId, callerAuthUserId, gameId: hideGameId } = body;
      if (!callerProfileId || !callerAuthUserId || !hideGameId) return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });

      // Gate: verify Founder
      const settingsRows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
      const founderIds = settingsRows[0]?.founder_user_ids || [];
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
      if (!founderIds.includes(callerProfileRows[0].id)) return Response.json({ error: 'Forbidden: Founder only' }, { status: 403 });

      await base44.asServiceRole.entities.Game.update(hideGameId, {
        is_hidden: true,
        hidden_at: new Date().toISOString(),
        hidden_by_profile_id: callerProfileId,
      });
      console.log('[founderHideGame] hidden', hideGameId, 'by', callerProfileId);
      return Response.json({ success: true });
    }

    // ── founderRestoreGame ────────────────────────────────────────────────────
    // Founder-only: restore a previously hidden game back to normal surfaces.
    if (action === 'founderRestoreGame') {
      const { callerProfileId, callerAuthUserId, gameId: restoreGameId } = body;
      if (!callerProfileId || !callerAuthUserId || !restoreGameId) return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });

      // Gate: verify Founder
      const settingsRows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
      const founderIds = settingsRows[0]?.founder_user_ids || [];
      const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
      if (!founderIds.includes(callerProfileRows[0].id)) return Response.json({ error: 'Forbidden: Founder only' }, { status: 403 });

      await base44.asServiceRole.entities.Game.update(restoreGameId, {
        is_hidden: false,
        hidden_at: null,
        hidden_by_profile_id: null,
      });
      console.log('[founderRestoreGame] restored', restoreGameId, 'by', callerProfileId);
      return Response.json({ success: true });
    }

    // ── founderHardDeleteGame ─────────────────────────────────────────────────
    // Founder-only: permanently delete a game and all its related live records.
    // Cleans up: Game, GameParticipant rows, GameApproval rows, Notification rows tied to this game.
    if (action === 'founderHardDeleteGame') {
      const { callerProfileId, callerAuthUserId, gameId: delGameId } = body;
      let step = 'validate_input';
      try {
        if (!callerProfileId || !callerAuthUserId || !delGameId) return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });

        // Gate: verify Founder
        step = 'verify_founder';
        const settingsRows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
        const founderIds = settingsRows[0]?.founder_user_ids || [];
        const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        if (!founderIds.includes(callerProfileRows[0].id)) return Response.json({ error: 'Forbidden: Founder only' }, { status: 403 });

        // Verify game exists
        step = 'load_game';
        const gameRows = await base44.asServiceRole.entities.Game.filter({ id: delGameId });
        if (!gameRows.length) return Response.json({ error: 'Game not found' }, { status: 404 });

        // Delete GameParticipant rows
        step = 'delete_participants';
        const participants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: delGameId });
        await Promise.all(participants.map((p) => base44.asServiceRole.entities.GameParticipant.delete(p.id).catch(() => {})));
        console.log('[founderHardDeleteGame] deleted', participants.length, 'participants for game', delGameId);

        // Delete GameApproval rows
        step = 'delete_approvals';
        const approvals = await base44.asServiceRole.entities.GameApproval.filter({ game_id: delGameId }).catch(() => []);
        await Promise.all(approvals.map((a) => base44.asServiceRole.entities.GameApproval.delete(a.id).catch(() => {})));
        console.log('[founderHardDeleteGame] deleted', approvals.length, 'approvals for game', delGameId);

        // Delete Notifications tied to this game (via metadata.game_id)
        step = 'delete_notifications';
        const allNotifs = await base44.asServiceRole.entities.Notification.filter({ type: 'game_review_request' }, '-created_date', 500).catch(() => []);
        const gameNotifs = allNotifs.filter((n) => n.metadata?.game_id === delGameId);
        await Promise.all(gameNotifs.map((n) => base44.asServiceRole.entities.Notification.delete(n.id).catch(() => {})));
        console.log('[founderHardDeleteGame] deleted', gameNotifs.length, 'notifications for game', delGameId);

        // Delete the Game record
        step = 'delete_game';
        await base44.asServiceRole.entities.Game.delete(delGameId);
        console.log('[founderHardDeleteGame] deleted game', delGameId, 'by founder', callerProfileId);

        return Response.json({ success: true });
      } catch (err) {
        console.error('[founderHardDeleteGame] FAILED', { step, delGameId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'Hard delete failed' }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});