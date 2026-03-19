/**
 * Dashboard Service — aggregates stats for the home dashboard.
 *
 * IDENTITY: see components/auth/IDENTITY_CONTRACT.md
 *   profileId  = auth.currentUser.id    — Deck.owner_id, GameParticipant.participant_profile_id
 *   authUserId = auth.authUserId        — PODMembership.user_id, listMyPendingApprovals
 */
import { base44 } from "@/api/base44Client";

async function callBackend(payload) {
  const res = await base44.functions.invoke('publicProfiles', payload);
  if (res.status && res.status >= 400) throw new Error(res.data?.error || `Backend error (${res.status})`);
  return res.data;
}

const CACHE_TTL_MS = 60_000;
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { _cache.set(key, { ts: Date.now(), value }); return value; }

// Must pass Profile ID (currentUser.id) — cache key is dashboard::${profileId}.
// Passing authUserId will NOT match and invalidation will silently no-op.
export function invalidateDashboardCache(profileId) {
  if (!profileId) return;
  for (const key of _cache.keys()) {
    if (key.includes(profileId)) _cache.delete(key);
  }
}

const EMPTY = { myPodsCount: 0, pendingApprovalsCount: 0, myDecksCount: 0, recentGames: [] };

export async function getDashboardData(auth) {
  if (auth.isGuest || !auth.currentUser) return null;
  // profileId  = Profile entity UUID  → used for profile joins, deck lookups, game participant lookups
  // authUserId = Auth User ID         → used for RLS-sensitive queries (*_user_id fields)
  const profileId = auth.currentUser.id;
  const authUserId = auth.authUserId || auth.currentUser.user_id || null;
  if (!profileId) return EMPTY;

  const cKey = `dashboard::${profileId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  try {
    if (!profileId || !authUserId) return EMPTY;

    const data = await callBackend({ action: 'dashboardData', callerAuthUserId: authUserId, callerProfileId: profileId });
    const result = {
      myPodsCount: data.myPodsCount || 0,
      myDecksCount: data.myDecksCount || 0,
      pendingApprovalsCount: data.pendingApprovalsCount || 0,
      recentGames: (data.recentGames || []).map((g) => ({ ...g, participantsSummary: "" })),
    };
    return cacheSet(cKey, result);
  } catch (e) {
    console.warn("[dashboardService] getDashboardData error:", e?.message);
    return EMPTY;
  }
}