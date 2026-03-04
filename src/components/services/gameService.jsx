/**
 * Game Service - Business logic for creating games and handling approvals.
 * All permission checks and multi-entity writes are centralized here.
 */
import { base44 } from "@/api/base44Client";

/**
 * Validate that the user is an active member of the given league.
 */
export async function validateLeagueMembership(leagueId, userId) {
  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: userId,
    status: "active",
  });
  return members.length > 0 ? members[0] : null;
}

/**
 * Check if a user is a league admin.
 */
export async function isLeagueAdmin(leagueId, userId) {
  const membership = await validateLeagueMembership(leagueId, userId);
  return membership?.role === "admin";
}

/**
 * Create a game with participants and approval records.
 *
 * @param {object} params
 * @param {string|null} params.leagueId - The league ID (null for casual)
 * @param {string} params.contextType - "league" or "casual"
 * @param {string} params.creatorProfileId - The profile ID of the creator
 * @param {string} params.playedAt - ISO date string of when the game was played
 * @param {string} params.notes - Optional notes
 * @param {Array<{user_id: string, deck_id?: string, result?: string, placement?: number}>} params.participants
 * @returns {object} The created game
 */
export async function createGameWithParticipants({
  leagueId,
  contextType = "league",
  creatorProfileId,
  playedAt,
  notes,
  participants,
}) {
  if (contextType === "league") {
    // 1. Validate creator is active member
    const creatorMembership = await validateLeagueMembership(leagueId, creatorProfileId);
    if (!creatorMembership) {
      throw new Error("You must be an active member of this league to create a game.");
    }

    // 2. Validate all participants are active members
    for (const p of participants) {
      const membership = await validateLeagueMembership(leagueId, p.user_id);
      if (!membership) {
        throw new Error(`Participant ${p.user_id} is not an active member of this league.`);
      }
    }
  }
  // Casual games: no league membership validation needed

  // 3. Create the game record
  const game = await base44.entities.Game.create({
    league_id: leagueId || null,
    context_type: contextType,
    played_at: playedAt || new Date().toISOString(),
    status: "pending",
    notes: notes || "",
  });

  // 4. Validate all participant user_ids exist as Profile rows before writing
  const allProfiles = await base44.entities.Profile.list("-created_date", 200);
  const profileIdSet = new Set(allProfiles.map((p) => p.id));
  for (const p of participants) {
    if (!profileIdSet.has(p.user_id)) {
      throw new Error(
        `Cannot log game: participant user_id "${p.user_id}" has no matching Profile. ` +
        `Ensure all participants have registered profiles before logging a game.`
      );
    }
  }

  // 5. Create participant records
  const participantRecords = participants.map((p) => ({
    game_id: game.id,
    user_id: p.user_id,
    deck_id: p.deck_id || null,
    result: p.result || null,
    placement: p.placement || null,
  }));
  await base44.entities.GameParticipant.bulkCreate(participantRecords);

  // 6. Create approval records for everyone except the creator
  const approvalRecords = participants
    .filter((p) => p.user_id !== creatorProfileId)
    .map((p) => ({
      game_id: game.id,
      approver_user_id: p.user_id,
      status: "pending",
    }));

  if (approvalRecords.length > 0) {
    await base44.entities.GameApproval.bulkCreate(approvalRecords);
  } else {
    // Solo game or only creator — auto-approve
    await base44.entities.Game.update(game.id, { status: "approved" });
  }

  return game;
}

/**
 * Approve a game. Only the listed approver can approve.
 */
export async function approveGame(gameId, approverProfileId) {
  const approvals = await base44.entities.GameApproval.filter({
    game_id: gameId,
    approver_user_id: approverProfileId,
  });

  if (approvals.length === 0) {
    throw new Error("You are not listed as an approver for this game.");
  }

  const approval = approvals[0];
  if (approval.status !== "pending") {
    throw new Error("You have already responded to this game.");
  }

  await base44.entities.GameApproval.update(approval.id, {
    status: "approved",
    responded_at: new Date().toISOString(),
  });

  // Recalculate game status
  await recalculateGameStatus(gameId);
}

/**
 * Reject a game. Only the listed approver can reject.
 */
export async function rejectGame(gameId, approverProfileId, reason) {
  const approvals = await base44.entities.GameApproval.filter({
    game_id: gameId,
    approver_user_id: approverProfileId,
  });

  if (approvals.length === 0) {
    throw new Error("You are not listed as an approver for this game.");
  }

  const approval = approvals[0];
  if (approval.status !== "pending") {
    throw new Error("You have already responded to this game.");
  }

  await base44.entities.GameApproval.update(approval.id, {
    status: "rejected",
    responded_at: new Date().toISOString(),
    reason: reason || "",
  });

  // Recalculate game status
  await recalculateGameStatus(gameId);
}

/**
 * Recalculate game status based on all approval records.
 * - Any rejected → game rejected
 * - All approved → game approved
 * - Otherwise → pending
 */
async function recalculateGameStatus(gameId) {
  const allApprovals = await base44.entities.GameApproval.filter({ game_id: gameId });

  const hasRejection = allApprovals.some((a) => a.status === "rejected");
  const allApproved = allApprovals.every((a) => a.status === "approved");

  let newStatus = "pending";
  if (hasRejection) {
    newStatus = "rejected";
  } else if (allApproved && allApprovals.length > 0) {
    newStatus = "approved";
  }

  await base44.entities.Game.update(gameId, { status: newStatus });
}

/**
 * Get the current user's profile, creating one if it doesn't exist.
 * Uses a Promise-based mutex to prevent duplicate creation on double-mount.
 */

// ── public_user_id helpers ────────────────────────────────────────────────────
function _padId(n) {
  return String(n).padStart(6, "0");
}

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
  const candidates = [
    user.full_name,
    user.name,
    user.user_metadata?.name,
    user.user_metadata?.full_name,
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  if (user.email) return user.email.split("@")[0].trim() || "Player";
  return "Player";
}

/**
 * Ensures a display_name is unique (case-insensitive) across all profiles.
 * If baseName conflicts with an existing profile (other than excludeProfileId),
 * appends " 2", " 3", etc. until a free slot is found.
 */
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

// Promise-based mutex — survives React double-mount
let _provisioningPromise = null;

export async function getOrCreateProfile() {
  const user = await base44.auth.me();
  if (!user) return null;

  if (_provisioningPromise) {
    return _provisioningPromise;
  }

  _provisioningPromise = _doGetOrCreate(user).finally(() => {
    _provisioningPromise = null;
  });
  return _provisioningPromise;
}

async function _doGetOrCreate(user) {
  // 1. Try to find by user_id (auth UID) — most reliable
  const byUid = user.id ? await base44.entities.Profile.filter({ user_id: user.id }) : [];
  let existing = byUid.length > 0 ? byUid[0] : null;

  // 2. Fallback: find by email (existing profiles before user_id was added)
  if (!existing && user.email) {
    const byEmail = await base44.entities.Profile.filter({ email: user.email });
    existing = byEmail.length > 0 ? byEmail[0] : null;
  }

  if (existing) {
    const updates = {};

    // Link user_id if missing (backfill for existing profiles)
    if (!existing.user_id && user.id) {
      updates.user_id = user.id;
    }

    // Backfill public_user_id
    if (!existing.public_user_id) {
      updates.public_user_id = await _generateUniquePublicUserId();
    }

    // Backfill display_name if empty
    if (!existing.display_name || !existing.display_name.trim()) {
      const baseName = _resolveDisplayName(user);
      const uniqueName = await _uniqueDisplayName(baseName, existing.id);
      updates.display_name = uniqueName;
      updates.display_name_lc = uniqueName.toLowerCase();
    }

    // Backfill username if empty
    if (!existing.username || !existing.username.trim()) {
      const publicId = updates.public_user_id || existing.public_user_id || _padId(Math.floor(Math.random() * 1_000_000));
      const uname = await _generateUniqueUsername(`player-${publicId}`);
      updates.username = uname;
      updates.username_lc = uname;
    }

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
    email: user.email,
    public_user_id: publicId,
    username,
    username_lc: username,
  };
  if (user.avatar_url) payload.avatar_url = user.avatar_url;

  const created = await base44.entities.Profile.create(payload);

  // ── Verify persistence: newly created profile must be readable by user_id or email ──
  const verifyByUid = user.id
    ? await base44.entities.Profile.filter({ user_id: user.id })
    : [];
  const verifyByEmail = verifyByUid.length === 0 && user.email
    ? await base44.entities.Profile.filter({ email: user.email })
    : verifyByUid;
  const verified = verifyByUid.length > 0 ? verifyByUid : verifyByEmail;

  if (verified.length === 0) {
    throw new Error(
      `Profile creation verification failed for user_id=${user.id} email=${user.email}. ` +
      `Profile.create returned id=${created.id} but subsequent filter returned 0 rows.`
    );
  }

  const profile = verified[0];
  console.log(`[PROFILE OK] id=${profile.id} user_id=${profile.user_id} email=${profile.email}`);
  return profile;
}

/**
 * List all pending GameApproval records assigned to the current user,
 * enriched with game / league / participant context for Inbox display.
 * Batches all secondary fetches to avoid N+1.
 */
export async function listMyPendingApprovals(auth) {
  if (auth.isGuest || !auth.currentUser) return [];

  // 1. My pending approvals
  const myApprovals = await base44.entities.GameApproval.filter({
    approver_user_id: auth.currentUser.id,
    status: "pending",
  });
  if (myApprovals.length === 0) return [];

  const gameIds = [...new Set(myApprovals.map((a) => a.game_id))];

  // 2. Fetch games + all approvals for those games in parallel
  const [games, allApprovalArrays, participantArrays] = await Promise.all([
    Promise.all(gameIds.map((gid) => base44.entities.Game.filter({ id: gid }).then((r) => r[0]))),
    Promise.all(gameIds.map((gid) => base44.entities.GameApproval.filter({ game_id: gid }))),
    Promise.all(gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }))),
  ]);

  // Filter out any games that no longer exist or are no longer pending
  const validGames = games.filter(Boolean).filter((g) => g.status === "pending");
  const validGameIds = new Set(validGames.map((g) => g.id));

  // 3. Batch fetch leagues + profiles
  const leagueIds = [...new Set(validGames.map((g) => g.league_id).filter(Boolean))];
  const allParticipants = participantArrays.flat();
  const participantUserIds = [...new Set(allParticipants.map((p) => p.user_id))];

  const [allLeagues, allProfiles] = await Promise.all([
    leagueIds.length > 0 ? base44.entities.League.list("-created_date", 200) : Promise.resolve([]),
    base44.entities.Profile.list("-created_date", 200),
  ]);

  const leagueMap = {};
  allLeagues.forEach((l) => { leagueMap[l.id] = l; });
  const profileMap = {};
  // Key by Profile.id (primary); also key by Profile.user_id as fallback for legacy rows
  allProfiles.forEach((p) => {
    profileMap[p.id] = p;
    if (p.user_id) profileMap[p.user_id] = p;
  });

  // 4. Assemble rows
  return gameIds
    .map((gid, i) => {
      const game = games[i];
      if (!game || !validGameIds.has(gid)) return null;

      const approval = myApprovals.find((a) => a.game_id === gid);
      const league = game.league_id ? leagueMap[game.league_id] : null;
      const participants = participantArrays[i].map((p) => ({
        userId: p.user_id,
        display_name: profileMap[p.user_id]?.display_name || profileMap[p.user_id]?.username || "Unknown",
        avatar_url: profileMap[p.user_id]?.avatar_url || null,
        result: p.result || null,
        placement: p.placement || null,
        deck: null, // not needed for inbox row
      }));

      const approvalRecords = allApprovalArrays[i];
      const approvalSummary = {
        total: approvalRecords.length,
        approved: approvalRecords.filter((a) => a.status === "approved").length,
        rejected: approvalRecords.filter((a) => a.status === "rejected").length,
        pending: approvalRecords.filter((a) => a.status === "pending").length,
        records: approvalRecords,
      };

      // Who submitted? (created_by is game creator email, map to profile)
      const submittedByProfile = Object.values(profileMap).find(
        (p) => p.email === game.created_by
      );

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
        leagueName: game.context_type === "casual" ? "Casual Game" : (league?.name || "Unknown League"),
        contextType: game.context_type || "league",
        submittedByName: submittedByProfile?.display_name || null,
      };
    })
    .filter(Boolean);
}

/**
 * Set the current user's deck for a game (updates their GameParticipant row).
 */
export async function setMyDeckForGame(auth, gameId, deckId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");
  const participants = await base44.entities.GameParticipant.filter({
    game_id: gameId,
    user_id: auth.currentUser.id,
  });
  if (participants.length === 0) throw new Error("You are not a participant in this game.");
  await base44.entities.GameParticipant.update(participants[0].id, { deck_id: deckId });
}

/**
 * Permission helper: Can the current user read this league?
 */
export function canReadLeague(league, membership) {
  if (league.is_public) return true;
  return !!membership;
}

/**
 * Permission helper: Can the current user read this game?
 * @param {object} game
 * @param {boolean} isMember - is the user an active league member?
 * @param {boolean} isParticipant - is the user a participant of this game?
 * @param {boolean} isGuest - is the user not logged in?
 */
export function canReadGame(game, league, { isMember, isParticipant, isGuest }) {
  if (isGuest) {
    return league.is_public && game.status === "approved";
  }
  if (isMember) return true;
  if (isParticipant) return true;
  return league.is_public && game.status === "approved";
}