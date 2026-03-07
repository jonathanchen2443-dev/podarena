/**
 * Profile Service — public, read-only profile lookups + public stats.
 * Never returns email or sensitive/self-only fields.
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

export function invalidatePublicProfileCache(userId) {
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

export function toPublicProfile(profile) {
  return {
    id: profile.id,
    display_name: profile.display_name || "Unknown",
    public_user_id: profile.public_user_id || null,
    avatar_url: profile.avatar_url || null,
    created_date: profile.created_date || null,
  };
}

export async function getPublicProfile(userId) {
  if (!userId) throw new Error("not_found");
  const cKey = `pub::${userId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  const results = await base44.entities.Profile.filter({ id: userId });
  if (!results.length) throw new Error("not_found");
  return cacheSet(cKey, toPublicProfile(results[0]));
}

export async function searchProfiles(query, limit = 20) {
  if (!query || query.trim().length < 3) return [];
  const q = query.trim().toLowerCase();

  // Use filter({}) instead of list() — list() can be scope-limited by the SDK
  // to the current user's own records. filter({}) with an empty predicate respects
  // the open authenticated-read RLS on Profile and returns all visible profiles.
  const all = await base44.entities.Profile.filter({}, "-created_date", 300).catch(() => []);

  const matched = all.filter((p) => {
    const name = (p.display_name || "").toLowerCase();
    const uid = (p.public_user_id || "").toLowerCase();
    // Partial match on display_name; partial match on public_user_id (not exact-only)
    return name.includes(q) || uid.includes(q);
  });

  return matched.slice(0, limit).map(toPublicProfile);
}

export async function getPublicProfileStats(userId) {
  if (!userId) return null;
  const cKey = `pubStats::${userId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const [participations, decks, games] = await Promise.all([
      base44.entities.GameParticipant.filter({ user_id: userId }).catch(() => []),
      base44.entities.Deck.filter({ owner_id: userId }).catch(() => []),
      base44.entities.Game.list("-created_date", 500).catch(() => []),
    ]);

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
      decksCount: decks.length,
      activeDecksCount: decks.filter((d) => d.is_active !== false).length,
    };
    return cacheSet(cKey, result);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}