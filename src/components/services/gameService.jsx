/**
 * Game Service — Business logic for creating games and handling approvals.
 *
 * IDENTITY CONTRACT — see components/auth/IDENTITY_CONTRACT.md for full spec.
 *
 * authUserId / *_user_id    = Auth User ID ({{user.id}}) — RLS fields, approval matching
 * profileId  / *_profile_id = Profile entity UUID        — display, joins, deck ownership
 *
 * ⚠️ LEGACY: LeagueMember.user_id stores Profile ID — intentional exception, do not "fix".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { base44 } from "@/api/base44Client";

// ── public_user_id helpers ────────────────────────────────────────────────────
function _padId(n) { return String(n).padStart(6, "0"); }

async function _generateUniquePublicUserId() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = _padId(Math.floor(Math.random() * 1_000_000));
    const existing = await base44.entities.Profile.filter({ public_user_id: candidate });
    if (existing.length === 0) return candidate;
  }
  return _padId(Date.now() % 1_000_000);
}

async function _generateUniqueUsername(base) {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  for (let suffix = 0; suffix < 20; suffix++) {
    const candidate = suffix === 0 ? clean : `${clean}-${suffix}`;
    const existing = await base44.entities.Profile.filter({ username_lc: candidate });
    if (existing.length === 0) return candidate;
  }
  return `${clean}-${Date.now() % 10000}`;
}

function _resolveDisplayName(user) {
  const candidates = [user.full_name, user.name, user.user_metadata?.name, user.user_metadata?.full_name];
  for (const c of candidates) { if (c && c.trim()) return c.trim(); }
  if (user.email) return user.email.split("@")[0].trim() || "Player";
  return "Player";
}

async function _uniqueDisplayName(baseName, excludeProfileId = null) {
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? baseName : `${baseName} ${suffix + 1}`;
    const candidateLc = candidate.toLowerCase();
    const conflicts = await base44.entities.Profile.filter({ display_name_lc: candidateLc });
    const realConflict = conflicts.filter((p) => p.id !== excludeProfileId);
    if (realConflict.length === 0) return candidate;
  }
  return `${baseName} ${Date.now() % 10000}`;
}

// Promise-based mutex — survives React double-mount in StrictMode
let _provisioningPromise = null;

export async function getOrCreateProfile() {
  const user = await base44.auth.me();
  if (!user) return null;
  if (_provisioningPromise) return _provisioningPromise;
  _provisioningPromise = _doGetOrCreate(user).finally(() => { _provisioningPromise = null; });
  return _provisioningPromise;
}

async function _doGetOrCreate(user) {
  // 1. Try to find by user_id (auth UID)
  const byUid = user.id ? await base44.entities.Profile.filter({ user_id: user.id }) : [];
  let existing = byUid.length > 0 ? byUid[0] : null;

  // 2. Fallback: find by email
  if (!existing && user.email) {
    const byEmail = await base44.entities.Profile.filter({ email: user.email });
    existing = byEmail.length > 0 ? byEmail[0] : null;
  }

  if (existing) {
    const updates = {};
    if (!existing.user_id && user.id) updates.user_id = user.id;
    if (!existing.avatar_url && user.avatar_url) updates.avatar_url = user.avatar_url;
    if (!existing.public_user_id) updates.public_user_id = await _generateUniquePublicUserId();
    if (!existing.display_name || !existing.display_name.trim()) {
      const baseName = _resolveDisplayName(user);
      const uniqueName = await _uniqueDisplayName(baseName, existing.id);
      updates.display_name = uniqueName;
      updates.display_name_lc = uniqueName.toLowerCase();
    }
    if (!existing.username || !existing.username.trim()) {
      const publicId = updates.public_user_id || existing.public_user_id || _padId(Math.floor(Math.random() * 1_000_000));
      const uname = await _generateUniqueUsername(`player-${publicId}`);
      updates.username = uname;
      updates.username_lc = uname;
    }
    if (!existing.email && user.email) updates.email = user.email;

    let profile;
    if (Object.keys(updates).length > 0) {
      profile = await base44.entities.Profile.update(existing.id, updates);
    } else {
      profile = existing;
    }
    console.log(`[PROFILE OK] id=${profile.id} user_id=${profile.user_id} email=${profile.email}`);
    return profile;
  }

  // 3. Create new profile
  const baseName = _resolveDisplayName(user);
  const displayName = await _uniqueDisplayName(baseName);
  const publicId = await _generateUniquePublicUserId();
  const username = await _generateUniqueUsername(`player-${publicId}`);

  const payload = {
    user_id: user.id || null,
    display_name: displayName,
    display_name_lc: displayName.toLowerCase(),
    email: user.email || null,
    public_user_id: publicId,
    username,
    username_lc: username,
  };
  if (user.avatar_url) payload.avatar_url = user.avatar_url;

  const created = await base44.entities.Profile.create(payload);
  if (!created?.id) throw new Error("Profile creation returned no ID.");

  console.log(`[PROFILE OK] created id=${created.id} user_id=${created.user_id} email=${created.email}`);
  return created;
}

/**
 * Validate that the user is an active member of the given league.
 * Uses Profile.id as that's what LeagueMember.user_id stores.
 */
export async function validateLeagueMembership(leagueId, profileId) {
  const allMembers = await base44.entities.LeagueMember.filter({ league_id: leagueId }, "-created_date", 200);
  const members = allMembers.filter((m) => m.user_id === profileId && m.status === "active");
  return members.length > 0 ? members[0] : null;
}

export async function isLeagueAdmin(leagueId, profileId) {
  const membership = await validateLeagueMembership(leagueId, profileId);
  return membership?.role === "admin";
}

/**
 * Build a deck snapshot from a live deck object for historical preservation.
 */
function _buildDeckSnapshot(deck) {
  if (!deck) return null;
  return {
    id: deck.id,
    name: deck.name,
    commander_name: deck.commander_name || null,
    commander_image_url: deck.commander_image_url || null,
    color_identity: deck.color_identity || [],
  };
}

/**
 * Create a casual or league game with participants and approval records.
 *
 * @param {object} params
 * @param {string|null}  params.leagueId
 * @param {string}       params.contextType         - "league" or "casual"
 * @param {string}       params.creatorProfileId    - Profile.id of the creator
 * @param {string}       params.creatorAuthUserId   - Auth User ID of the creator
 * @param {string}       params.playedAt
 * @param {string}       params.notes
 * @param {Array<{
 *   profileId: string,       Profile.id
 *   authUserId: string,      Auth User ID
 *   deck_id?: string,
 *   deckData?: object,       live deck object for snapshot
 *   result?: string,
 *   placement?: number,
 * }>} params.participants
 */
export async function createGameWithParticipants({
  leagueId,
  podId,
  contextType = "casual",
  creatorProfileId,
  creatorAuthUserId,
  playedAt,
  notes,
  participants,
}) {
  if (contextType === "league") {
    const creatorMembership = await validateLeagueMembership(leagueId, creatorProfileId);
    if (!creatorMembership) throw new Error("You must be an active member of this league to create a game.");
    for (const p of participants) {
      const membership = await validateLeagueMembership(leagueId, p.profileId);
      if (!membership) throw new Error(`Participant is not an active member of this league.`);
    }
  }

  // Validate all profile IDs exist
  const allProfiles = await base44.entities.Profile.list("-created_date", 200);
  const profileIdSet = new Set(allProfiles.map((p) => p.id));
  for (const p of participants) {
    if (!profileIdSet.has(p.profileId)) {
      throw new Error(`Cannot log game: participant profile ID "${p.profileId}" has no matching Profile.`);
    }
  }

  // Create the game
  const game = await base44.entities.Game.create({
    league_id: leagueId || null,
    pod_id: podId || null,
    context_type: contextType,
    played_at: playedAt || new Date().toISOString(),
    status: "pending",
    notes: notes || "",
    created_by_user_id: creatorAuthUserId || null,
    created_by_profile_id: creatorProfileId || null,
  });

  // Create participant records with dual IDs + deck snapshots
  const participantRecords = participants.map((p) => {
    const isCreator = p.profileId === creatorProfileId;
    const snapshot = p.deckData ? _buildDeckSnapshot(p.deckData) : null;
    return {
      game_id: game.id,
      participant_user_id: p.authUserId || null,
      participant_profile_id: p.profileId,
      is_creator: isCreator,
      selected_deck_id: p.deck_id || null,
      deck_snapshot_json: snapshot,
      deck_name_at_time: snapshot?.name || null,
      commander_name_at_time: snapshot?.commander_name || null,
      commander_image_at_time: snapshot?.commander_image_url || null,
      result: p.result || null,
      placement: p.placement || null,
      // Creator is auto-approved; others start pending
      approval_status: isCreator ? "approved" : "pending",
      approved_at: isCreator ? new Date().toISOString() : null,
    };
  });
  await base44.entities.GameParticipant.bulkCreate(participantRecords);

  // Create GameApproval records for each non-creator participant
  const approvalRecords = participants
    .filter((p) => p.profileId !== creatorProfileId)
    .map((p) => ({
      game_id: game.id,
      approver_user_id: p.authUserId || null,   // Auth User ID — for RLS
      approver_profile_id: p.profileId,          // Profile ID — for display
      requester_user_id: creatorAuthUserId || null,
      requester_profile_id: creatorProfileId || null,
      status: "pending",
    }));

  if (approvalRecords.length > 0) {
    await base44.entities.GameApproval.bulkCreate(approvalRecords);
  } else {
    // Solo or only creator — auto-approve
    await base44.entities.Game.update(game.id, { status: "approved" });
  }

  return game;
}

/**
 * Approve a game.
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID ({{user.id}})
 * @param {string} approverProfileId   - Profile.id (for participant row update)
 * @param {string} deckId              - optional deck selected at approval time
 */
export async function approveGame(gameId, approverAuthUserId, approverProfileId, deckId) {
  // 1. Update GameApproval by auth user id
  const approvals = await base44.entities.GameApproval.filter({ game_id: gameId });
  const approval = approvals.find((a) => a.approver_user_id === approverAuthUserId && a.status === "pending");
  if (!approval) throw new Error("You are not listed as an approver for this game.");

  await base44.entities.GameApproval.update(approval.id, {
    status: "approved",
    responded_at: new Date().toISOString(),
  });

  // 2. Update this participant's row (by profile_id for the join key)
  if (approverProfileId) {
    const participants = await base44.entities.GameParticipant.filter({ game_id: gameId });
    const myParticipant = participants.find((p) => p.participant_profile_id === approverProfileId);
    if (myParticipant) {
      const participantUpdate = {
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      };
      if (deckId) {
        participantUpdate.selected_deck_id = deckId;
        // Fetch and snapshot the chosen deck
        const decks = await base44.entities.Deck.filter({ id: deckId });
        if (decks[0]) {
          const snap = _buildDeckSnapshot(decks[0]);
          participantUpdate.deck_snapshot_json = snap;
          participantUpdate.deck_name_at_time = snap.name;
          participantUpdate.commander_name_at_time = snap.commander_name;
          participantUpdate.commander_image_at_time = snap.commander_image_url;
        }
      }
      await base44.entities.GameParticipant.update(myParticipant.id, participantUpdate);
    }
  }

  await recalculateGameStatus(gameId);
}

/**
 * Reject a game.
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID
 * @param {string} approverProfileId   - Profile.id
 * @param {string} reason
 */
export async function rejectGame(gameId, approverAuthUserId, approverProfileId, reason) {
  const approvals = await base44.entities.GameApproval.filter({ game_id: gameId });
  const approval = approvals.find((a) => a.approver_user_id === approverAuthUserId && a.status === "pending");
  if (!approval) throw new Error("You are not listed as an approver for this game.");

  await base44.entities.GameApproval.update(approval.id, {
    status: "rejected",
    responded_at: new Date().toISOString(),
    reason: reason || "",
  });

  if (approverProfileId) {
    const participants = await base44.entities.GameParticipant.filter({ game_id: gameId });
    const myParticipant = participants.find((p) => p.participant_profile_id === approverProfileId);
    if (myParticipant) {
      await base44.entities.GameParticipant.update(myParticipant.id, {
        approval_status: "rejected",
        approved_at: new Date().toISOString(),
      });
    }
  }

  await recalculateGameStatus(gameId);
}

async function recalculateGameStatus(gameId) {
  const allApprovals = await base44.entities.GameApproval.filter({ game_id: gameId });
  const hasRejection = allApprovals.some((a) => a.status === "rejected");
  const allApproved = allApprovals.every((a) => a.status === "approved");
  let newStatus = "pending";
  if (hasRejection) newStatus = "rejected";
  else if (allApproved && allApprovals.length > 0) newStatus = "approved";
  await base44.entities.Game.update(gameId, { status: newStatus });
}

/**
 * Update the deck for the current user's participant row.
 * @deprecated Use approveGame(…, deckId) instead which snapshots at approval time.
 */
export async function setMyDeckForGame(auth, gameId, deckId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");
  const profileId = auth.currentUser.id;
  const participants = await base44.entities.GameParticipant.filter({ game_id: gameId });
  const mine = participants.find((p) => p.participant_profile_id === profileId);
  if (!mine) throw new Error("You are not a participant in this game.");

  const updates = { selected_deck_id: deckId };
  const decks = await base44.entities.Deck.filter({ id: deckId });
  if (decks[0]) {
    const snap = _buildDeckSnapshot(decks[0]);
    updates.deck_snapshot_json = snap;
    updates.deck_name_at_time = snap.name;
    updates.commander_name_at_time = snap.commander_name;
    updates.commander_image_at_time = snap.commander_image_url;
  }
  await base44.entities.GameParticipant.update(mine.id, updates);
}

/**
 * List all pending GameApproval records assigned to the current user,
 * enriched with game/league/participant context for Inbox display.
 */
export async function listMyPendingApprovals(auth) {
  if (auth.isGuest || !auth.currentUser) return [];

  // auth.authUserId = Auth User ID (profile.user_id) from AuthContext — always use this, no me() needed
  const authUid = auth.authUserId || auth.currentUser?.user_id || null;
  if (!authUid) return [];

  const allMyApprovals = await base44.entities.GameApproval.list("-created_date", 200);
  const myApprovals = allMyApprovals.filter(
    (a) => a.approver_user_id === authUid && a.status === "pending"
  );
  if (myApprovals.length === 0) return [];

  const gameIds = [...new Set(myApprovals.map((a) => a.game_id))];

  const [games, allApprovalArrays, participantArrays] = await Promise.all([
    Promise.all(gameIds.map((gid) => base44.entities.Game.get(gid).catch(() => null))),
    Promise.all(gameIds.map((gid) => base44.entities.GameApproval.filter({ game_id: gid }))),
    Promise.all(gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }))),
  ]);

  const validGames = games.filter(Boolean).filter((g) => g.status === "pending");
  const validGameIds = new Set(validGames.map((g) => g.id));

  const leagueIds = [...new Set(validGames.map((g) => g.league_id).filter(Boolean))];
  const podIds = [...new Set(validGames.map((g) => g.pod_id).filter(Boolean))];
  const allParticipants = participantArrays.flat();

  const [allLeagues, allPods, allProfiles] = await Promise.all([
    leagueIds.length > 0 ? base44.entities.League.list("-created_date", 200) : Promise.resolve([]),
    podIds.length > 0 ? Promise.all(podIds.map((id) => base44.entities.POD.get(id).catch(() => null))) : Promise.resolve([]),
    base44.entities.Profile.list("-created_date", 200),
  ]);

  const leagueMap = Object.fromEntries(allLeagues.map((l) => [l.id, l]));
  const podMap = Object.fromEntries(allPods.filter(Boolean).map((p) => [p.id, p]));
  // Key profiles by Profile.id (primary join key)
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));

  return gameIds
    .map((gid, i) => {
      const game = games[i];
      if (!game || !validGameIds.has(gid)) return null;

      const approval = myApprovals.find((a) => a.game_id === gid);
      const league = game.league_id ? leagueMap[game.league_id] : null;

      const participants = participantArrays[i].map((p) => {
        const profile = profileMap[p.participant_profile_id];
        return {
          userId: p.participant_profile_id,   // Profile.id — used as key for display/joins
          authUserId: p.participant_user_id,   // Auth UID — available if needed
          display_name: profile?.display_name || profile?.username || "Unknown",
          avatar_url: profile?.avatar_url || null,
          result: p.result || null,
          placement: p.placement || null,
          deck: p.selected_deck_id ? {
            id: p.selected_deck_id,
            name: p.deck_name_at_time || null,
            color_identity: p.deck_snapshot_json?.color_identity || [],
          } : null,
        };
      });

      const approvalRecords = allApprovalArrays[i];
      const approvalSummary = {
        total: approvalRecords.length,
        approved: approvalRecords.filter((a) => a.status === "approved").length,
        rejected: approvalRecords.filter((a) => a.status === "rejected").length,
        pending: approvalRecords.filter((a) => a.status === "pending").length,
        records: approvalRecords,
      };

      // Who submitted? use created_by_profile_id if available, else fall back to email
      const submitterProfile = game.created_by_profile_id
        ? profileMap[game.created_by_profile_id]
        : allProfiles.find((p) => p.email === game.created_by);

      return {
        approvalId: approval?.id,
        game: {
          id: game.id,
          status: game.status,
          played_at: game.played_at || game.created_date,
          created_date: game.created_date,
          notes: game.notes || "",
          participants,
          approvalSummary,
        },
        leagueId: game.league_id || null,
        podId: game.pod_id || null,
        leagueName: game.context_type === "casual"
          ? "Casual Game"
          : game.context_type === "pod"
            ? (podMap[game.pod_id]?.pod_name || "POD Game")
            : (league?.name || "Unknown League"),
        contextType: game.context_type || "casual",
        submittedByName: submitterProfile?.display_name || null,
      };
    })
    .filter(Boolean);
}

export function canReadLeague(league, membership) {
  if (league.is_public) return true;
  return !!membership;
}

export function canReadGame(game, league, { isMember, isParticipant, isGuest }) {
  if (isGuest) return league.is_public && game.status === "approved";
  if (isMember) return true;
  if (isParticipant) return true;
  return league.is_public && game.status === "approved";
}