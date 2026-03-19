/**
 * Game Service — Business logic for creating games and handling participant review.
 *
 * IDENTITY CONTRACT — see components/auth/IDENTITY_CONTRACT.md for full spec.
 *
 * authUserId / *_user_id    = Auth User ID ({{user.id}}) — RLS fields, approval matching
 * profileId  / *_profile_id = Profile entity UUID        — display, joins, deck ownership
 *
 * ARCHITECTURE (post-cutover):
 * - GameApproval is DEPRECATED from live runtime flow.
 * - GameParticipant.approval_status is the single source of truth for participant review state.
 * - Notification (type: game_review_request) is the inbox prompt layer only.
 * - Game.status is recalculated from GameParticipant approval states.
 * - Game is readable by participants (via RLS) so non-founders can access pending reviews.
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
 * Create a casual or POD game with participants and review notifications.
 * GameApproval records are NOT created — GameParticipant is the sole source of truth.
 *
 * @param {object} params
 * @param {string}       params.contextType         - "casual" or "pod"
 * @param {string}       params.creatorProfileId    - Profile.id of the creator
 * @param {string}       params.creatorAuthUserId   - Auth User ID of the creator
 * @param {string}       params.playedAt
 * @param {string}       params.notes
 * @param {Array<{
 *   profileId: string,       Profile.id
 *   authUserId: string,      Auth User ID
 *   deck_id?: string,        Only for creator — others choose at review time
 *   deckData?: object,       live deck object for snapshot (creator only)
 *   result?: string,
 *   placement?: number,
 * }>} params.participants
 */
export async function createGameWithParticipants({
  podId,
  contextType = "casual",
  creatorProfileId,
  creatorAuthUserId,
  playedAt,
  notes,
  participants,
}) {
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
    pod_id: podId || null,
    context_type: contextType,
    played_at: playedAt || new Date().toISOString(),
    status: "pending",
    notes: notes || "",
    created_by_user_id: creatorAuthUserId || null,
    created_by_profile_id: creatorProfileId || null,
  });

  const nonCreators = participants.filter((p) => p.profileId !== creatorProfileId);

  // Create participant records
  const participantRecords = participants.map((p) => {
    const isCreator = p.profileId === creatorProfileId;
    // Only snapshot deck for the creator — others choose at review time
    const snapshot = isCreator && p.deckData ? _buildDeckSnapshot(p.deckData) : null;
    return {
      game_id: game.id,
      participant_user_id: p.authUserId || null,
      participant_profile_id: p.profileId,
      is_creator: isCreator,
      selected_deck_id: isCreator ? (p.deck_id || null) : null,
      deck_snapshot_json: snapshot,
      deck_name_at_time: snapshot?.name || null,
      commander_name_at_time: snapshot?.commander_name || null,
      commander_image_at_time: snapshot?.commander_image_url || null,
      result: p.result || null,
      placement: p.placement || null,
      // Creator is auto-approved; non-creators start pending
      approval_status: isCreator ? "approved" : "pending",
      approved_at: isCreator ? new Date().toISOString() : null,
      rejected_at: null,
    };
  });
  await base44.entities.GameParticipant.bulkCreate(participantRecords);

  if (nonCreators.length === 0) {
    // Solo game — auto-approve
    await base44.entities.Game.update(game.id, { status: "approved" });
  } else {
    // Create a Notification (inbox prompt) for each non-creator participant
    // metadata carries game_id + participant identity so the review modal can open directly
    const podName = podId ? (await base44.entities.POD.get(podId).catch(() => null))?.pod_name || null : null;
    const reviewNotifications = nonCreators
      .filter((p) => !!p.authUserId)
      .map((p) => ({
        type: "game_review_request",
        actor_user_id: creatorAuthUserId,
        recipient_user_id: p.authUserId,
        metadata: {
          game_id: game.id,
          // game_participant_id will be populated after we fetch the newly created records
          context_type: contextType,
          pod_name: podName || null,
        },
      }));

    if (reviewNotifications.length > 0) {
      // Fetch created participant rows to get their IDs for metadata
      const createdParticipants = await base44.entities.GameParticipant.filter({ game_id: game.id });
      const participantByProfile = Object.fromEntries(
        createdParticipants.map((p) => [p.participant_profile_id, p])
      );

      const notificationsWithIds = reviewNotifications.map((notif) => {
        const matchingParticipant = nonCreators.find((p) => p.authUserId === notif.recipient_user_id);
        const participantRow = matchingParticipant ? participantByProfile[matchingParticipant.profileId] : null;
        return {
          ...notif,
          metadata: {
            ...notif.metadata,
            game_participant_id: participantRow?.id || null,
          },
        };
      });

      await base44.entities.Notification.bulkCreate(notificationsWithIds);
    }
  }

  return game;
}

/**
 * Approve a game — updates the participant's own GameParticipant row.
 * Deck selection is required and saved as a snapshot on the participant row.
 *
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID ({{user.id}})
 * @param {string} approverProfileId   - Profile.id (for participant row update)
 * @param {string} deckId              - required: the deck this participant played
 */
export async function approveGame(gameId, approverAuthUserId, approverProfileId, deckId) {
  // Find the participant row by auth user id (RLS ensures only own row is visible)
  const participants = await base44.entities.GameParticipant.filter({ game_id: gameId });
  const myParticipant = participants.find(
    (p) => p.participant_user_id === approverAuthUserId && p.approval_status === "pending"
  );
  if (!myParticipant) throw new Error("No pending review found for you on this game.");

  const participantUpdate = {
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    rejected_at: null,
  };

  if (deckId) {
    participantUpdate.selected_deck_id = deckId;
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

  // Mark the review notification as read
  await _markReviewNotificationRead(gameId, approverAuthUserId);

  await recalculateGameStatus(gameId);
}

/**
 * Reject a game — updates the participant's own GameParticipant row.
 * No deck selection required for rejection.
 *
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID
 * @param {string} approverProfileId   - Profile.id
 * @param {string} reason              - optional reason (stored in notes-style, no dedicated field)
 */
export async function rejectGame(gameId, approverAuthUserId, approverProfileId, reason) {
  const participants = await base44.entities.GameParticipant.filter({ game_id: gameId });
  const myParticipant = participants.find(
    (p) => p.participant_user_id === approverAuthUserId && p.approval_status === "pending"
  );
  if (!myParticipant) throw new Error("No pending review found for you on this game.");

  await base44.entities.GameParticipant.update(myParticipant.id, {
    approval_status: "rejected",
    rejected_at: new Date().toISOString(),
    approved_at: null,
  });

  // Mark the review notification as read
  await _markReviewNotificationRead(gameId, approverAuthUserId);

  await recalculateGameStatus(gameId);
}

async function _markReviewNotificationRead(gameId, recipientAuthUserId) {
  try {
    const notifs = await base44.entities.Notification.list("-created_date", 50);
    const pending = notifs.find(
      (n) =>
        n.type === "game_review_request" &&
        n.recipient_user_id === recipientAuthUserId &&
        n.metadata?.game_id === gameId &&
        !n.read_at
    );
    if (pending) {
      await base44.entities.Notification.update(pending.id, { read_at: new Date().toISOString() });
    }
  } catch (_) {
    // Non-critical — don't block the approval
  }
}

export async function recalculateGameStatus(gameId) {
  const allParticipants = await base44.entities.GameParticipant.filter({ game_id: gameId });
  // Only non-creator participants gate the status
  const reviewable = allParticipants.filter((p) => !p.is_creator);
  if (reviewable.length === 0) {
    // Solo or all-creator (shouldn't happen, but handle gracefully)
    await base44.entities.Game.update(gameId, { status: "approved" });
    return;
  }
  const hasRejection = reviewable.some((p) => p.approval_status === "rejected");
  const allApproved = reviewable.every((p) => p.approval_status === "approved");
  let newStatus = "pending";
  if (hasRejection) newStatus = "rejected";
  else if (allApproved) newStatus = "approved";
  await base44.entities.Game.update(gameId, { status: newStatus });
}

/**
 * List all pending game review requests for the current user.
 * Source of truth: GameParticipant.approval_status === "pending"
 * Cross-referenced with Notification for inbox prompt context.
 * GameApproval is NOT used.
 */
export async function listMyPendingApprovals(auth) {
  if (auth.isGuest || !auth.currentUser) return [];

  const authUid = auth.authUserId || auth.currentUser?.user_id || null;
  if (!authUid) return [];

  // Find participant rows where this user has a pending review
  // GameParticipant RLS allows this — user can read their own rows
  const allMyParticipations = await base44.entities.GameParticipant.list("-created_date", 200);
  const myPendingRows = allMyParticipations.filter(
    (p) => p.participant_user_id === authUid && p.approval_status === "pending" && !p.is_creator
  );
  if (myPendingRows.length === 0) return [];

  const gameIds = [...new Set(myPendingRows.map((p) => p.game_id).filter(Boolean))];
  if (gameIds.length === 0) return [];

  // Fetch games (now readable via RLS since user is a participant)
  const [games, allParticipantArrays] = await Promise.all([
    Promise.all(gameIds.map((gid) => base44.entities.Game.get(gid).catch(() => null))),
    Promise.all(gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }).catch(() => []))),
  ]);

  // Only show games still pending overall
  const validGames = games.filter(Boolean).filter((g) => g.status === "pending");
  const validGameIds = new Set(validGames.map((g) => g.id));

  const podIds = [...new Set(validGames.map((g) => g.pod_id).filter(Boolean))];
  const [allPods, allProfiles] = await Promise.all([
    podIds.length > 0
      ? Promise.all(podIds.map((id) => base44.entities.POD.get(id).catch(() => null)))
      : Promise.resolve([]),
    base44.entities.Profile.list("-created_date", 200).catch(() => []),
  ]);

  const podMap = Object.fromEntries(allPods.filter(Boolean).map((p) => [p.id, p]));
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));

  return gameIds
    .map((gid, i) => {
      const game = games[i];
      if (!game || !validGameIds.has(gid)) return null;

      const myRow = myPendingRows.find((p) => p.game_id === gid);
      const allParticipants = allParticipantArrays[i];

      const participants = allParticipants.map((p) => {
        const profile = profileMap[p.participant_profile_id];
        return {
          userId: p.participant_profile_id,
          authUserId: p.participant_user_id,
          display_name: profile?.display_name || profile?.username || "Unknown",
          avatar_url: profile?.avatar_url || null,
          result: p.result || null,
          placement: p.placement || null,
          approval_status: p.approval_status || "pending",
          is_creator: p.is_creator || false,
          // Historical deck display uses snapshot — never reads another user's live Deck entity
          deck: p.deck_name_at_time
            ? {
                id: p.selected_deck_id,
                name: p.deck_name_at_time,
                color_identity: p.deck_snapshot_json?.color_identity || [],
                commander_name: p.commander_name_at_time || null,
                commander_image: p.commander_image_at_time || null,
              }
            : null,
        };
      });

      const approvalSummary = {
        total: allParticipants.filter((p) => !p.is_creator).length,
        approved: allParticipants.filter((p) => !p.is_creator && p.approval_status === "approved").length,
        rejected: allParticipants.filter((p) => !p.is_creator && p.approval_status === "rejected").length,
        pending: allParticipants.filter((p) => !p.is_creator && p.approval_status === "pending").length,
      };

      const submitterProfile = game.created_by_profile_id
        ? profileMap[game.created_by_profile_id]
        : allProfiles.find((p) => p.email === game.created_by);

      return {
        // game_participant_id for the current user's pending row — used as the item key
        approvalId: myRow?.id,
        gameParticipantId: myRow?.id,
        game: {
          id: game.id,
          status: game.status,
          played_at: game.played_at || game.created_date,
          created_date: game.created_date,
          notes: game.notes || "",
          participants,
          approvalSummary,
        },
        podId: game.pod_id || null,
        contextLabel: game.context_type === "pod"
          ? (podMap[game.pod_id]?.pod_name || "POD Game")
          : "Casual Game",
        contextType: game.context_type || "casual",
        submittedByName: submitterProfile?.display_name || null,
      };
    })
    .filter(Boolean);
}