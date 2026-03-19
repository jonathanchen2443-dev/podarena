/**
 * Dashboard Service — aggregates stats for the home dashboard.
 *
 * IDENTITY: see components/auth/IDENTITY_CONTRACT.md
 *   profileId  = auth.currentUser.id    — Deck.owner_id, GameParticipant.participant_profile_id
 *   authUserId = auth.authUserId        — PODMembership.user_id, listMyPendingApprovals
 */
import { base44 } from "@/api/base44Client";
import { listMyPendingApprovals } from "@/components/services/gameService";

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
    // Guard: skip any query that requires a valid id to avoid "invalid query" errors.
    // This can happen during post-submit navigation when auth state is briefly in flux.
    if (!profileId) {
      console.warn("[dashboardService] getDashboardData skipped: profileId is missing.");
      return EMPTY;
    }

    // Parallel: POD memberships, decks, pending approvals — all independent.
    // Each query is individually guarded and caught so one failure can't blank the dashboard.
    // PODMembership.user_id = Auth User ID (RLS field) → must use authUserId
    // Deck.owner_id         = Profile ID → uses profileId
    const [podMemberships, decks, pendingApprovals] = await Promise.all([
      authUserId
        ? base44.entities.PODMembership.filter({ user_id: authUserId, membership_status: "active" })
            .catch((e) => { console.warn("[dashboardService] PODMembership query failed:", e?.message); return []; })
        : (console.warn("[dashboardService] PODMembership query skipped: authUserId is missing."), Promise.resolve([])),
      base44.entities.Deck.filter({ owner_id: profileId })
        .catch((e) => { console.warn("[dashboardService] Deck query failed:", e?.message); return []; }),
      listMyPendingApprovals(auth)
        .catch((e) => { console.warn("[dashboardService] listMyPendingApprovals failed:", e?.message); return []; }),
    ]);

    // Recent games: GameParticipant.participant_profile_id = Profile ID → correct
    const participations = await base44.entities.GameParticipant.filter(
      { participant_profile_id: profileId }, "-created_date", 20
    ).catch((e) => { console.warn("[dashboardService] GameParticipant query failed:", e?.message); return []; });

    // Sort newest first before slicing
    const sortedParticipations = participations
      .slice()
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const gameIds = [...new Set(sortedParticipations.map((p) => p.game_id))].slice(0, 10);

    let recentGames = [];
    if (gameIds.length > 0) {
      const games = await Promise.all(
        gameIds.map((gid) => base44.entities.Game.get(gid).catch(() => null))
      );
      recentGames = games
        .filter(Boolean)
        // Include pending + approved + rejected so creator sees their own submissions immediately
        .sort((a, b) => new Date(b.played_at || b.created_date) - new Date(a.played_at || a.created_date))
        .slice(0, 5)
        .map((game) => ({
          id: game.id,
          context_type: game.context_type || "casual",
          status: game.status,
          played_at: game.played_at || game.created_date,
          participantsSummary: "",
        }));
    }

    const result = {
      myPodsCount: podMemberships.length,
      pendingApprovalsCount: pendingApprovals.length,
      myDecksCount: decks.length,
      recentGames,
    };
    return cacheSet(cKey, result);
  } catch (e) {
    console.warn("[dashboardService] getDashboardData error:", e?.message);
    return EMPTY;
  }
}