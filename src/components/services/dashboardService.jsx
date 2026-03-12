/**
 * Dashboard Service — Phase 1 simplified version.
 * Returns safe defaults on any missing data. No chained enrichments.
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

export function invalidateDashboardCache(userId) {
  if (!userId) return;
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

const EMPTY = { myLeaguesCount: 0, myPodsCount: 0, pendingApprovalsCount: 0, myDecksCount: 0, recentGames: [] };

export async function getDashboardData(auth) {
  if (auth.isGuest || !auth.currentUser) return null;
  const userId = auth.currentUser.id;
  if (!userId) return EMPTY;

  const cKey = `dashboard::${userId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  try {
    // Parallel: memberships, decks, pending approvals — all independent
    const [memberships, podMemberships, decks, pendingApprovals] = await Promise.all([
      base44.entities.LeagueMember.filter({ user_id: userId, status: "active" }).catch(() => []),
      base44.entities.PODMembership.filter({ user_id: userId, membership_status: "active" }).catch(() => []),
      base44.entities.Deck.filter({ owner_id: userId }).catch(() => []),
      listMyPendingApprovals(auth).catch(() => []),
    ]);

    // Recent games: fetch my participations, sort by newest, then fetch game records
    // Use participant_profile_id (Profile.id) for the lookup — matches auth.currentUser.id
    const participations = await base44.entities.GameParticipant.filter(
      { participant_profile_id: userId }, "-created_date", 20
    ).catch(() => []);

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
          league_id: game.league_id || null,
          context_type: game.context_type || (game.league_id ? "league" : "casual"),
          leagueName: (game.context_type === "casual" || !game.league_id) ? "Casual Game" : "League Game",
          status: game.status,
          played_at: game.played_at || game.created_date,
          participantsSummary: "",
        }));
    }

    const result = {
      myLeaguesCount: memberships.length,
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