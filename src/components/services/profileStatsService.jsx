/**
 * profileStatsService — fetches stat counts for the profile page.
 * Stats: gamesPlayed (approved), wins (approved, placement==1), decks, leagues.
 * 60s TTL cache + in-flight dedup.
 */
import { base44 } from "@/api/base44Client";

const CACHE_TTL_MS = 60_000;
const _cache = new Map();
const _inflight = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { _cache.set(key, { ts: Date.now(), value }); return value; }

export function invalidateProfileStatsCache(userId) {
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

/**
 * getProfileStats(auth)
 * Returns { gamesPlayed, wins, decksCount, leaguesCount }
 */
export async function getProfileStats(auth) {
  if (auth.isGuest || !auth.currentUser || !auth.currentUser.id) return null;
  const userId = auth.currentUser.id;
  const cKey = `profileStats::${userId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    // Fetch each entity independently so one RLS failure doesn't block all stats
    const [allParticipations, decks, allMemberships, games] = await Promise.all([
      // RLS already scopes this to the current user's rows; filter by profile_id for new records
      base44.entities.GameParticipant.filter({ participant_profile_id: userId }, "-created_date", 500).catch(() => []),
      base44.entities.Deck.filter({ owner_id: userId }, "-updated_date", 200).catch(() => []),
      base44.entities.LeagueMember.filter({ user_id: userId }, "-created_date", 200).catch(() => []),
      base44.entities.Game.list("-created_date", 500).catch(() => []),
    ]);
    // Accept both old (user_id) and new (participant_profile_id) field for migration compatibility
    const participations = allParticipations.filter((p) =>
      (p.participant_profile_id || p.user_id) === userId
    );
    const filteredDecks = decks;
    const memberships = allMemberships;

    const gameIds = new Set(participations.map((p) => p.game_id));
    const approvedGameIds = new Set(
      games.filter((g) => g.status === "approved" && gameIds.has(g.id)).map((g) => g.id)
    );

    let gamesPlayed = 0;
    let wins = 0;
    for (const p of participations) {
      if (!approvedGameIds.has(p.game_id)) continue;
      gamesPlayed++;
      if (p.placement === 1) wins++;
    }

    const result = {
      gamesPlayed,
      wins,
      decksCount: filteredDecks.length,
      leaguesCount: memberships.filter((m) => m.status === "active").length,
    };
    return cacheSet(cKey, result);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}