/**
 * POD Service — Business logic for POD creation, membership, and games.
 *
 * IDENTITY CONTRACT — see components/auth/IDENTITY_CONTRACT.md for full spec.
 *   authUserId / *_user_id   = Auth User ID ({{user.id}}) — RLS permissions
 *   profileId  / *_profile_id = Profile entity UUID       — display, joins, stats
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
  // Check for existing live membership via backend (RLS blocks cross-user reads)
  // callerProfileId = inviterProfileId (the admin doing the inviting)
  if (inviterProfileId) {
    const check = await base44.functions.invoke('publicProfiles', {
      action: 'checkMembership',
      podId,
      targetAuthUserId: authUserId,
      callerProfileId: inviterProfileId,
    });
    const liveRow = check.data?.membership;
    if (liveRow) return liveRow;
  }

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

// ── POD GAME ─────────────────────────────────────────────────────────────────

export async function validatePODMembership(podId, participantProfileId, callerProfileId) {
  // callerProfileId = the user doing the check (must be active member of the pod)
  // participantProfileId = the profile being validated
  if (!callerProfileId) {
    // Fallback: try direct query (works for own membership check)
    const rows = await base44.entities.PODMembership.filter({ pod_id: podId, profile_id: participantProfileId });
    return rows.find((r) => r.membership_status === "active") || null;
  }
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'validateParticipantMembership',
    podId,
    participantProfileId,
    callerProfileId,
  });
  return res.data?.isActiveMember ? { membership_status: "active" } : null;
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────

/**
 * getPODLeaderboard — delegates to the publicProfiles backend (service role).
 * Cross-user reads (PODMembership, Game, GameParticipant) are blocked by RLS for
 * normal users, so all computation is done server-side via asServiceRole.
 *
 * @param {string} podId
 * @param {string} callerProfileId — Profile entity UUID of the requesting user (gate check)
 * @returns {{ leaderboard: array, profiles: object }}
 */
export async function getPODLeaderboard(podId, callerProfileId) {
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'podLeaderboard',
    podId,
    callerProfileId,
  });
  const data = res.data || {};
  return {
    leaderboard: data.leaderboard || [],
    profiles: data.profiles || {},
  };
}

// ── ACTIVE MEMBER COUNT ───────────────────────────────────────────────────────

export async function getActiveMemberCount(podId) {
  const rows = await base44.entities.PODMembership.filter({ pod_id: podId, membership_status: "active" });
  return rows.length;
}