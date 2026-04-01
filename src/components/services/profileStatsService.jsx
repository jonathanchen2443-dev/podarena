/**
 * profileStatsService — fetches self profile stats via backend (myProfileStats action).
 *
 * All stat computation is done server-side via asServiceRole, which:
 *  - Bypasses RLS (regular users can't reliably filter GameParticipant client-side)
 *  - Unions participant_user_id + participant_profile_id queries to cover all records
 *  - Verifies identity server-side before returning private data (POD count etc.)
 *
 * Shape returned: { gamesPlayed, wins, decksCount, activeDecksCount, leaguesCount, podsCount }
 * leaguesCount is an alias for podsCount, kept for UI contract compatibility.
 *
 * 60s TTL cache + in-flight dedup — same pattern as profileService.
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
 * Returns { gamesPlayed, wins, decksCount, activeDecksCount, leaguesCount, podsCount }
 * Stats are computed server-side via the myProfileStats backend action.
 */
export async function getProfileStats(auth) {
  if (auth.isGuest || !auth.currentUser || !auth.currentUser.id || !auth.authUserId) return null;

  const profileId = auth.currentUser.id;
  const authUserId = auth.authUserId;
  const cKey = `profileStats::${profileId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const res = await base44.functions.invoke('publicProfiles', {
      action: 'myProfileStats',
      callerAuthUserId: authUserId,
      callerProfileId: profileId,
    });

    const stats = res.data?.stats;
    if (!stats) throw new Error(res.data?.error || 'myProfileStats returned no data');

    return cacheSet(cKey, {
      gamesPlayed:      stats.gamesPlayed      ?? 0,
      wins:             stats.wins             ?? 0,
      decksCount:       stats.decksCount       ?? 0,
      activeDecksCount: stats.activeDecksCount ?? 0,
      // leaguesCount kept as UI-compatible alias for podsCount
      leaguesCount:     stats.leaguesCount     ?? stats.podsCount ?? 0,
      podsCount:        stats.podsCount        ?? 0,
    });
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}