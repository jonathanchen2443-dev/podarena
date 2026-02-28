/**
 * Dashboard Service — aggregates data for the home screen.
 * Rate-limit safe: batches all secondary fetches, reuses cached patterns.
 * TTL: 60s in-memory cache per user.
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
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

/**
 * getDashboardData(auth)
 * Returns:
 * {
 *   myLeaguesCount,
 *   pendingApprovalsCount,
 *   myDecksCount,
 *   recentGames: Array<{ id, league_id, leagueName, status, played_at, participantsSummary }>
 * }
 */
export async function getDashboardData(auth) {
  if (auth.isGuest || !auth.currentUser) return null;

  const userId = auth.currentUser.id;
  const cKey = `dashboard::${userId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  // 1. Parallel: memberships, decks, pending approvals
  const [memberships, decks, pendingApprovals] = await Promise.all([
    base44.entities.LeagueMember.filter({ user_id: userId, status: "active" }),
    base44.entities.Deck.filter({ owner_id: userId }),
    listMyPendingApprovals(auth),
  ]);

  const leagueIds = [...new Set(memberships.map((m) => m.league_id))];

  // 2. Parallel: leagues + recent participations (league + casual)
  const [allLeagues, recentParticipations] = await Promise.all([
    leagueIds.length > 0 ? base44.entities.League.list("-created_date", 200) : Promise.resolve([]),
    base44.entities.GameParticipant.filter({ user_id: userId }),
  ]);

  // Build leagueMap from my memberships
  const myLeagueSet = new Set(leagueIds);
  const myLeagues = allLeagues.filter((l) => myLeagueSet.has(l.id));
  const leagueMap = {};
  myLeagues.forEach((l) => { leagueMap[l.id] = l; });

  // 3. Fetch recent games I participated in (up to 8, includes league + casual)
  const gameIds = [...new Set(recentParticipations.map((gp) => gp.game_id))].slice(0, 8);
  let recentGames = [];

  if (gameIds.length > 0) {
    const gameFetches = await Promise.all(
      gameIds.map((gid) => base44.entities.Game.filter({ id: gid }).then((r) => r[0]).catch(() => null))
    );

    // Fetch league names for games not already in leagueMap
    const extraLeagueIds = [...new Set(
      gameFetches.filter(Boolean).map((g) => g.league_id).filter((id) => id && !leagueMap[id])
    )];
    if (extraLeagueIds.length > 0) {
      const extraLeagues = await base44.entities.League.list("-created_date", 200);
      extraLeagues.forEach((l) => { if (extraLeagueIds.includes(l.id)) leagueMap[l.id] = l; });
    }

    // Fetch participants for those games (batch)
    const participantArrays = await Promise.all(
      gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }).catch(() => []))
    );

    // Batch-fetch profiles
    const allParticipantUserIds = [...new Set(participantArrays.flat().map((p) => p.user_id))];
    let profileMap = {};
    if (allParticipantUserIds.length > 0) {
      const profiles = await base44.entities.Profile.list("-created_date", 200);
      profiles.forEach((p) => { profileMap[p.id] = p; });
    }

    recentGames = gameFetches
      .filter(Boolean)
      .sort((a, b) => new Date(b.played_at || b.created_date) - new Date(a.played_at || a.created_date))
      .slice(0, 5)
      .map((game) => {
        const participants = participantArrays[gameIds.indexOf(game.id)] || [];
        const names = participants.map((p) => profileMap[p.user_id]?.display_name || "?");
        const participantsSummary =
          names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

        const isCasual = game.context_type === "casual" || !game.league_id;

        return {
          id: game.id,
          league_id: game.league_id || null,
          context_type: game.context_type || (game.league_id ? "league" : "casual"),
          leagueName: isCasual ? "Casual Game" : (leagueMap[game.league_id]?.name || "Unknown League"),
          status: game.status,
          played_at: game.played_at || game.created_date,
          participantsSummary,
        };
      });
  }

  const result = {
    myLeaguesCount: leagueIds.length,
    pendingApprovalsCount: pendingApprovals.length,
    myDecksCount: decks.length,
    recentGames,
  };

  return cacheSet(cKey, result);
}