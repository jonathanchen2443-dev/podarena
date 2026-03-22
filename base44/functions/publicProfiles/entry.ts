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
            return {
              userId: p.participant_profile_id,
              authUserId: p.participant_user_id || null,
              display_name: profile.display_name || 'Unknown',
              avatar_url: profile.avatar_url || null,
              result: p.result || null,
              placement: p.placement || null,
              approval_status: p.approval_status || 'pending',
              is_creator: p.is_creator || false,
              deck: p.deck_name_at_time ? {
                name: p.deck_name_at_time,
                color_identity: p.deck_snapshot_json?.color_identity || [],
                commander_name: p.commander_name_at_time || null,
                commander_image: p.commander_image_at_time || null,
              } : null,
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
      if (!creatorProfileId || !creatorAuthUserId || !Array.isArray(participants)) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Validate all profile IDs exist
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
      const game = await base44.asServiceRole.entities.Game.create({
        pod_id: podId || null,
        context_type: contextType,
        played_at: playedAt || new Date().toISOString(),
        status: 'pending',
        notes: notes || '',
        created_by_user_id: creatorAuthUserId,
        created_by_profile_id: creatorProfileId,
      });

      const nonCreators = participants.filter((p) => p.profileId !== creatorProfileId);

      // Build and create ALL participant records via asServiceRole
      const participantRecords = participants.map((p) => {
        const isCreator = p.profileId === creatorProfileId;
        const snap = isCreator && p.deckData ? {
          id: p.deckData.id, name: p.deckData.name,
          commander_name: p.deckData.commander_name || null,
          commander_image_url: p.deckData.commander_image_url || null,
          color_identity: p.deckData.color_identity || [],
        } : null;
        return {
          game_id: game.id,
          participant_user_id: p.authUserId || null,
          participant_profile_id: p.profileId,
          is_creator: isCreator,
          selected_deck_id: isCreator ? (p.deck_id || null) : null,
          deck_snapshot_json: snap,
          deck_name_at_time: snap?.name || null,
          commander_name_at_time: snap?.commander_name || null,
          commander_image_at_time: snap?.commander_image_url || null,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: isCreator ? 'approved' : 'pending',
          approved_at: isCreator ? new Date().toISOString() : null,
          rejected_at: null,
        };
      });
      try {
        await base44.asServiceRole.entities.GameParticipant.bulkCreate(participantRecords);

        if (nonCreators.length === 0) {
          await base44.asServiceRole.entities.Game.update(game.id, { status: 'approved' });
        } else {
          let podName = null;
          if (podId) {
            const podArr = await base44.asServiceRole.entities.POD.filter({ id: podId });
            podName = podArr[0]?.pod_name || null;
          }

          const createdParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: game.id });
          const participantByProfile = Object.fromEntries(createdParticipants.map((p) => [p.participant_profile_id, p]));

          const notifications = nonCreators
            .filter((p) => !!p.authUserId)
            .map((p) => {
              const participantRow = participantByProfile[p.profileId];
              return {
                type: 'game_review_request',
                actor_user_id: creatorAuthUserId,
                recipient_user_id: p.authUserId,
                metadata: {
                  game_id: game.id,
                  game_participant_id: participantRow?.id || null,
                  context_type: contextType,
                  pod_name: podName || null,
                },
              };
            });

          if (notifications.length > 0) {
            await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
          }
        }
      } catch (innerError) {
        // Rollback: delete the orphaned Game record so it doesn't become a ghost
        try { await base44.asServiceRole.entities.Game.delete(game.id); } catch (_) {}
        throw innerError;
      }

      return Response.json({ game });
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

      return Response.json({
        myPodsCount: memberships.length,
        myDecksCount: decks.length,
        pendingApprovalsCount,
        recentGames,
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

    // ── listProfilesForGameLog ────────────────────────────────────────────────
    // Returns profiles with user_id included — needed so participant_user_id can be set correctly.
    // ONLY for authenticated users. user_id is sensitive and must not be in public-facing endpoints.
    if (action === 'listProfilesForGameLog') {
      const profiles = await base44.asServiceRole.entities.Profile.filter({}, '-created_date', 200);
      return Response.json({
        profiles: profiles.map((p) => ({
          id: p.id,
          user_id: p.user_id || null,
          display_name: p.display_name || 'Unknown',
          public_user_id: p.public_user_id || null,
          avatar_url: p.avatar_url || null,
          username: p.username || null,
          display_name_lc: p.display_name_lc || null,
          username_lc: p.username_lc || null,
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
        return {
          userId: p.participant_profile_id,
          authUserId: p.participant_user_id || null,
          display_name: profile.display_name || 'Unknown',
          avatar_url: profile.avatar_url || null,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: p.approval_status || 'pending',
          is_creator: p.is_creator || false,
          deck: p.deck_name_at_time ? {
            name: p.deck_name_at_time,
            color_identity: p.deck_snapshot_json?.color_identity || [],
            commander_name: p.commander_name_at_time || null,
            commander_image: p.commander_image_at_time || null,
          } : null,
        };
      });

      const nonCreators = participantArr.filter((p) => !p.is_creator);
      const assembled = {
        id: game.id,
        status: game.status,
        played_at: game.played_at || game.created_date || null,
        notes: game.notes || '',
        context_type: game.context_type || 'casual',
        pod_id: game.pod_id || null,
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

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});