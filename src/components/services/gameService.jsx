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
  // Route entire creation through backend — asServiceRole bypasses RLS for all participant/notification writes
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'createGame',
    podId: podId || null,
    contextType,
    creatorProfileId,
    creatorAuthUserId,
    playedAt: playedAt || new Date().toISOString(),
    notes: notes || '',
    participants,
  });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.game;
}

/**
 * Approve a game — routed through backend action (approveGameReview) for RLS-safe writes.
 * Works for all user types including regular non-founder users.
 *
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID ({{user.id}})
 * @param {string} approverProfileId   - Profile.id
 * @param {string} deckId              - required: the deck this participant played
 */
export async function approveGame(gameId, approverAuthUserId, approverProfileId, deckId) {
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'approveGameReview',
    gameId,
    callerAuthUserId: approverAuthUserId,
    callerProfileId: approverProfileId,
    deckId,
  });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

/**
 * Reject a game — routed through backend action (rejectGameReview) for RLS-safe writes.
 * Works for all user types including regular non-founder users.
 *
 * @param {string} gameId
 * @param {string} approverAuthUserId  - Auth User ID
 * @param {string} approverProfileId   - Profile.id
 * @param {string} reason              - optional (not currently stored)
 */
export async function rejectGame(gameId, approverAuthUserId, approverProfileId, reason) {
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'rejectGameReview',
    gameId,
    callerAuthUserId: approverAuthUserId,
    callerProfileId: approverProfileId,
    reason: reason || '',
  });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}


export async function recalculateGameStatus(gameId) {
  // Route through backend so asServiceRole reads ALL participant rows (not just caller's own)
  await base44.functions.invoke('publicProfiles', { action: 'recalculateGameStatus', gameId });
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
  const profileId = auth.currentUser?.id || null;
  if (!authUid || !profileId) return [];

  const res = await base44.functions.invoke('publicProfiles', {
    action: 'pendingApprovalDetails',
    callerAuthUserId: authUid,
    callerProfileId: profileId,
  });
  return res.data?.approvals || [];
}