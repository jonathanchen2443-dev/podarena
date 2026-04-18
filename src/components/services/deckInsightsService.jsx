/**
 * deckInsightsService — thin client wrapper around the deckInsights backend function.
 *
 * All aggregation is done server-side via asServiceRole.
 * This service only handles caching, in-flight dedup, and cache invalidation.
 *
 * Payload shape (from backend):
 * {
 *   deck: { id, name, commander_name, commander_image_url, color_identity, first_logged_at, last_played_at },
 *   summary: { games_played, wins, win_rate_percent, pod_games, pod_wins, pod_win_rate_percent,
 *              casual_games, casual_wins, casual_win_rate_percent },
 *   eligibility: { insights_unlocked, games_needed_to_unlock, minimum_games_required },
 *   insights: { most_played_pod, best_against_player, toughest_opponent, best_against_deck },
 *   props: { total_received, by_type, sorted[] }
 * }
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

/**
 * Invalidate cache entries for a given user or deck.
 * Pass a userId or deckId string — all keys containing it will be cleared.
 */
export function invalidateDeckInsightsCache(key) {
  if (!key) { _cache.clear(); return; }
  for (const k of _cache.keys()) {
    if (k.includes(key)) _cache.delete(k);
  }
}

/**
 * getDeckInsights(auth, deckId)
 *
 * Returns the full deck insights payload from the backend.
 * Any authenticated user can view insights — data is public-safe (approved/non-hidden games only).
 * Returns null if the caller is not authenticated or required IDs are missing.
 *
 * @param {{ isGuest, authUserId, currentUser: { id } }} auth
 * @param {string} deckId
 * @returns {Promise<object|null>}
 */
export async function getDeckInsights(auth, deckId) {
  if (auth.isGuest || !auth.authUserId || !auth.currentUser?.id) return null;
  if (!deckId) return null;

  const cKey = `deckInsights::${auth.currentUser.id}::${deckId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const res = await base44.functions.invoke('deckInsights', {
      deckId,
      callerAuthUserId: auth.authUserId,
      callerProfileId: auth.currentUser.id,
    });
    if (res.data?.error) throw new Error(res.data.error);
    return cacheSet(cKey, res.data);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}