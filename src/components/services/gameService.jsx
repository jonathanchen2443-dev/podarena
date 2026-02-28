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
 * @param {string} params.leagueId - The league ID
 * @param {string} params.creatorProfileId - The profile ID of the creator
 * @param {string} params.playedAt - ISO date string of when the game was played
 * @param {string} params.notes - Optional notes
 * @param {Array<{user_id: string, deck_id?: string, result?: string, placement?: number}>} params.participants
 * @returns {object} The created game
 */
export async function createGameWithParticipants({
  leagueId,
  creatorProfileId,
  playedAt,
  notes,
  participants,
}) {
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

  // 3. Create the game record
  const game = await base44.entities.Game.create({
    league_id: leagueId,
    played_at: playedAt || new Date().toISOString(),
    status: "pending",
    notes: notes || "",
  });

  // 4. Create participant records
  const participantRecords = participants.map((p) => ({
    game_id: game.id,
    user_id: p.user_id,
    deck_id: p.deck_id || null,
    result: p.result || null,
    placement: p.placement || null,
  }));
  await base44.entities.GameParticipant.bulkCreate(participantRecords);

  // 5. Create approval records for everyone except the creator
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
 * On creation, sets display_name_lc and avatar_url if available.
 */
let _provisioningInFlight = false;
export async function getOrCreateProfile() {
  const user = await base44.auth.me();
  if (!user) return null;

  const profiles = await base44.entities.Profile.filter({ email: user.email });

  if (profiles.length > 0) {
    return profiles[0];
  }

  if (_provisioningInFlight) {
    // Wait a beat and retry once to avoid race on double mount
    await new Promise((r) => setTimeout(r, 800));
    const retry = await base44.entities.Profile.filter({ email: user.email });
    if (retry.length > 0) return retry[0];
  }

  _provisioningInFlight = true;
  try {
    const displayName = (user.full_name || user.email.split("@")[0]).trim();
    const payload = {
      display_name: displayName,
      display_name_lc: displayName.toLowerCase(),
      email: user.email,
    };
    if (user.avatar_url) payload.avatar_url = user.avatar_url;

    const newProfile = await base44.entities.Profile.create(payload);
    return newProfile;
  } finally {
    _provisioningInFlight = false;
  }
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
  const leagueIds = [...new Set(validGames.map((g) => g.league_id))];
  const allParticipants = participantArrays.flat();
  const participantUserIds = [...new Set(allParticipants.map((p) => p.user_id))];

  const [allLeagues, allProfiles] = await Promise.all([
    base44.entities.League.list("-created_date", 200),
    base44.entities.Profile.list("-created_date", 200),
  ]);

  const leagueMap = {};
  allLeagues.forEach((l) => { leagueMap[l.id] = l; });
  const profileMap = {};
  allProfiles.forEach((p) => { profileMap[p.id] = p; });

  // 4. Assemble rows
  return gameIds
    .map((gid, i) => {
      const game = games[i];
      if (!game || !validGameIds.has(gid)) return null;

      const approval = myApprovals.find((a) => a.game_id === gid);
      const league = leagueMap[game.league_id];
      const participants = participantArrays[i].map((p) => ({
        userId: p.user_id,
        display_name: profileMap[p.user_id]?.display_name || "Unknown",
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
        leagueId: game.league_id,
        leagueName: league?.name || "Unknown League",
        submittedByName: submittedByProfile?.display_name || null,
      };
    })
    .filter(Boolean);
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