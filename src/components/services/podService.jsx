/**
 * POD Service — Business logic for POD creation, membership, and games.
 *
 * IDENTITY CONTRACT (same as gameService):
 *   user_id      = Auth User ID ({{user.id}}) — RLS permissions
 *   profile_id   = Profile entity UUID — display, joins, stats
 */
import { base44 } from "@/api/base44Client";

// ── PODID Generation ─────────────────────────────────────────────────────────

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function _randomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return code;
}

export async function generateUniquePodCode() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = _randomCode();
    const existing = await base44.entities.POD.filter({ pod_code: candidate });
    if (existing.length === 0) return candidate;
  }
  throw new Error("Could not generate a unique PODID. Please try again.");
}

// ── POD CRUD ─────────────────────────────────────────────────────────────────

export async function createPOD({ podName, description, imageUrl, maxMembers, isPublic, creatorProfileId, creatorAuthUserId }) {
  const pod_code = await generateUniquePodCode();

  const pod = await base44.entities.POD.create({
    pod_name: podName,
    pod_code,
    description: description || "",
    image_url: imageUrl || null,
    max_members: maxMembers || 8,
    is_public: isPublic !== false,
    created_by_user_id: creatorAuthUserId,
    created_by_profile_id: creatorProfileId,
    admin_user_id: creatorAuthUserId,
    admin_profile_id: creatorProfileId,
    status: "active",
  });

  // Creator becomes admin + active member
  await base44.entities.PODMembership.create({
    pod_id: pod.id,
    user_id: creatorAuthUserId,
    profile_id: creatorProfileId,
    role: "admin",
    membership_status: "active",
    source: "creator",
    joined_at: new Date().toISOString(),
    is_favorite: false,
  });

  return pod;
}

export async function updatePOD(podId, updates) {
  return base44.entities.POD.update(podId, updates);
}

// ── MEMBERSHIP ────────────────────────────────────────────────────────────────

export async function getMyMembership(podId, authUserId) {
  if (!authUserId) return null;
  const rows = await base44.entities.PODMembership.filter({ pod_id: podId, user_id: authUserId });
  // Return the most recent non-removed/left or the most relevant row
  const active = rows.find((r) => r.membership_status === "active");
  if (active) return active;
  return rows[0] || null;
}

export async function requestJoinPOD(podId, authUserId, profileId) {
  // Check for existing membership
  const existing = await base44.entities.PODMembership.filter({ pod_id: podId, user_id: authUserId });
  const liveRow = existing.find((r) => ["active", "pending_request", "invited_pending"].includes(r.membership_status));
  if (liveRow) return liveRow; // already in a live state

  return base44.entities.PODMembership.create({
    pod_id: podId,
    user_id: authUserId,
    profile_id: profileId,
    role: "member",
    membership_status: "pending_request",
    source: "join_request",
    requested_at: new Date().toISOString(),
    is_favorite: false,
  });
}

export async function acceptJoinRequest(membershipId) {
  return base44.entities.PODMembership.update(membershipId, {
    membership_status: "active",
    joined_at: new Date().toISOString(),
    decided_at: new Date().toISOString(),
  });
}

export async function rejectJoinRequest(membershipId) {
  return base44.entities.PODMembership.update(membershipId, {
    membership_status: "rejected",
    decided_at: new Date().toISOString(),
  });
}

export async function leavePOD(membershipId) {
  return base44.entities.PODMembership.update(membershipId, {
    membership_status: "left",
    left_at: new Date().toISOString(),
  });
}

export async function removeMember(membershipId) {
  return base44.entities.PODMembership.update(membershipId, {
    membership_status: "removed",
    left_at: new Date().toISOString(),
  });
}

export async function toggleFavorite(membershipId, currentValue) {
  return base44.entities.PODMembership.update(membershipId, { is_favorite: !currentValue });
}

export async function createInviteMembership(podId, authUserId, profileId, inviterAuthUserId, inviterProfileId) {
  const allRows = await base44.entities.PODMembership.list("-created_date", 200);
  const existing = allRows.filter((r) => r.pod_id === podId && r.user_id === authUserId);
  const liveRow = existing.find((r) => ["active", "invited_pending"].includes(r.membership_status));
  if (liveRow) return liveRow;

  return base44.entities.PODMembership.create({
    pod_id: podId,
    user_id: authUserId,
    profile_id: profileId,
    role: "member",
    membership_status: "invited_pending",
    source: "invite",
    invited_at: new Date().toISOString(),
    invited_by_user_id: inviterAuthUserId || null,
    invited_by_profile_id: inviterProfileId || null,
    is_favorite: false,
  });
}

export async function inviteUserToPOD(pod, invitee, inviterAuthUserId, inviterProfileId) {
  const inviteeAuthUserId = invitee.user_id || null;
  const inviteeProfileId = invitee.id;

  const membership = await createInviteMembership(
    pod.id,
    inviteeAuthUserId || "",
    inviteeProfileId,
    inviterAuthUserId,
    inviterProfileId
  );

  if (inviteeAuthUserId) {
    const existingNotifs = await base44.entities.Notification.list("-created_date", 50);
    const alreadySent = existingNotifs.find(
      (n) =>
        n.type === "pod_invite" &&
        n.recipient_user_id === inviteeAuthUserId &&
        n.metadata?.pod_id === pod.id &&
        !n.read_at
    );
    if (!alreadySent) {
      await base44.entities.Notification.create({
        type: "pod_invite",
        pod_id: pod.id,
        actor_user_id: inviterAuthUserId,
        recipient_user_id: inviteeAuthUserId,
        metadata: {
          pod_id: pod.id,
          pod_name: pod.pod_name,
          pod_code: pod.pod_code,
          pod_description: pod.description || "",
          membership_id: membership.id,
        },
      });
    }
  }

  return membership;
}

export async function createInviteMembership(podId, authUserId, profileId, inviterAuthUserId, inviterProfileId) {
  // Check for existing live row first
  const allRows = await base44.entities.PODMembership.list("-created_date", 200);
  const existing = allRows.filter((r) => r.pod_id === podId && r.user_id === authUserId);
  const liveRow = existing.find((r) => ["active", "invited_pending"].includes(r.membership_status));
  if (liveRow) return liveRow;

  return base44.entities.PODMembership.create({
    pod_id: podId,
    user_id: authUserId,
    profile_id: profileId,
    role: "member",
    membership_status: "invited_pending",
    source: "invite",
    invited_at: new Date().toISOString(),
    invited_by_user_id: inviterAuthUserId || null,
    invited_by_profile_id: inviterProfileId || null,
    is_favorite: false,
  });
}

/**
 * Full invite flow: creates PODMembership (invited_pending) + Notification (pod_invite).
 * Idempotent — will not create duplicates if a live membership already exists.
 *
 * @param {object} pod          - { id, pod_name, pod_code, description }
 * @param {object} invitee      - { id (profileId), user_id (authUserId), display_name }
 * @param {string} inviterAuthUserId
 * @param {string} inviterProfileId
 */
export async function inviteUserToPOD(pod, invitee, inviterAuthUserId, inviterProfileId) {
  const inviteeAuthUserId = invitee.user_id || null;
  const inviteeProfileId = invitee.id;

  // 1. Create (or reuse) membership row
  const membership = await createInviteMembership(
    pod.id,
    inviteeAuthUserId || "",
    inviteeProfileId,
    inviterAuthUserId,
    inviterProfileId
  );

  // 2. Guard against duplicate notification for the same pod+user combination
  if (inviteeAuthUserId) {
    const existingNotifs = await base44.entities.Notification.list("-created_date", 50);
    const alreadySent = existingNotifs.find(
      (n) =>
        n.type === "pod_invite" &&
        n.recipient_user_id === inviteeAuthUserId &&
        n.metadata?.pod_id === pod.id &&
        !n.read_at
    );
    if (!alreadySent) {
      await base44.entities.Notification.create({
        type: "pod_invite",
        pod_id: pod.id,
        actor_user_id: inviterAuthUserId,
        recipient_user_id: inviteeAuthUserId,
        metadata: {
          pod_id: pod.id,
          pod_name: pod.pod_name,
          pod_code: pod.pod_code,
          pod_description: pod.description || "",
          membership_id: membership.id,
        },
      });
    }
  }

  return membership;
}

// ── POD GAME ─────────────────────────────────────────────────────────────────

export async function validatePODMembership(podId, profileId) {
  const rows = await base44.entities.PODMembership.filter({ pod_id: podId, profile_id: profileId });
  return rows.find((r) => r.membership_status === "active") || null;
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────

export async function getPODLeaderboard(podId) {
  // Fetch all approved POD games for this POD
  const allGames = await base44.entities.Game.filter({ pod_id: podId, status: "approved" });
  if (allGames.length === 0) return [];

  const gameIds = allGames.map((g) => g.id);

  // Fetch all participants for these games
  const participantArrays = await Promise.all(
    gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }).catch(() => []))
  );
  const allParticipants = participantArrays.flat();

  // Fetch active members only for leaderboard display
  const activeMembers = await base44.entities.PODMembership.filter({ pod_id: podId, membership_status: "active" });
  const activeMemberProfileIds = new Set(activeMembers.map((m) => m.profile_id));

  // Aggregate stats per profile_id
  const statsMap = {};
  for (const p of allParticipants) {
    const pid = p.participant_profile_id;
    if (!pid) continue;
    if (!statsMap[pid]) statsMap[pid] = { profileId: pid, games: 0, wins: 0, points: 0 };
    statsMap[pid].games += 1;
    if (p.placement === 1 || p.result === "win") {
      statsMap[pid].wins += 1;
      statsMap[pid].points += 1;
    }
  }

  // Only show active members
  const leaderboard = Object.values(statsMap)
    .filter((s) => activeMemberProfileIds.has(s.profileId))
    .map((s) => ({
      ...s,
      winRate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "0.0",
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (parseFloat(b.winRate) !== parseFloat(a.winRate)) return parseFloat(b.winRate) - parseFloat(a.winRate);
      if (b.games !== a.games) return b.games - a.games;
      return 0;
    });

  return leaderboard;
}

// ── ACTIVE MEMBER COUNT ───────────────────────────────────────────────────────

export async function getActiveMemberCount(podId) {
  const rows = await base44.entities.PODMembership.filter({ pod_id: podId, membership_status: "active" });
  return rows.length;
}