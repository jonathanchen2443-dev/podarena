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

const EMPTY = { myLeaguesCount: 0, pendingApprovalsCount: 0, myDecksCount: 0, recentGames: [] };

export async function getDashboardData(auth) {
  if (auth.isGuest || !auth.currentUser) return null;
  const userId = auth.currentUser.id;
  if (!userId) return EMPTY;

  const cKey = `dashboard::${userId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  try {
    // Parallel: memberships, decks, pending approvals — all independent
    const [memberships, decks, pendingApprovals] = await Promise.all([
      base44.entities.LeagueMember.filter({ user_id: userId, status: "active" }).catch(() => []),
      base44.entities.Deck.filter({ owner_id: userId }).catch(() => []),
      listMyPendingApprovals(auth).catch(() => []),
    ]);

    // Recent games: simple flat fetch of my participations, no enrichment
    const participations = await base44.entities.GameParticipant.filter({ user_id: userId }).catch(() => []);
    const gameIds = [...new Set(participations.map((p) => p.game_id))].slice(0, 5);

    let recentGames = [];
    if (gameIds.length > 0) {
      const games = await Promise.all(
        gameIds.map((gid) => base44.entities.Game.filter({ id: gid }).then((r) => r[0]).catch(() => null))
      );
      recentGames = games
        .filter(Boolean)
        .sort((a, b) => new Date(b.played_at || b.created_date) - new Date(a.played_at || a.created_date))
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