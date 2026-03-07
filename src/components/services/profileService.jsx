/**
 * profileService — public, read-only profile lookups via backend service role.
 * All cross-user queries go through the publicProfiles backend function,
 * which uses asServiceRole to bypass RLS and returns sanitized public fields only.
 * Email and private fields are NEVER returned.
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

// Shape guarantee — only safe public fields ever leave this service
export function toPublicProfile(p) {
  return {
    id: p.id,
    display_name: p.display_name || "Unknown",
    public_user_id: p.public_user_id || null,
    avatar_url: p.avatar_url || null,
    created_date: p.created_date || null,
    // email intentionally omitted
  };
}

async function callBackend(payload) {
  const res = await base44.functions.invoke('publicProfiles', payload);
  // Surface HTTP-level errors (401, 500, etc.) so callers can distinguish
  // backend failure from empty results.
  if (res.status && res.status >= 400) {
    const msg = res.data?.error || `Backend error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.data;
}

/**
 * searchProfiles — searches all profiles via service-role backend.
 * Returns sanitized public profiles only. Bypasses RLS.
 */
export async function searchProfiles(query, limit = 20) {
  if (!query || query.trim().length < 3) return [];

  const data = await callBackend({ action: 'search', query: query.trim() });
  const results = (data.results || []).slice(0, limit);
  return results.map(toPublicProfile);
}

/**
 * getPublicProfile — fetches a single public profile by its record id.
 * Uses backend service role, falls back to own-scoped lookup for self.
 */
export async function getPublicProfile(profileId) {
  if (!profileId) throw new Error("not_found");
  const cKey = `pub::${profileId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const data = await callBackend({ action: 'get', profileId });
    if (data.error === 'not_found' || !data.profile) throw new Error("not_found");
    return cacheSet(cKey, toPublicProfile(data.profile));
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}

/**
 * getPublicProfileDecks — fetches public-facing active decks for a profile.
 * Uses backend service role to bypass Deck RLS.
 */
export async function getPublicProfileDecks(profileId) {
  if (!profileId) return [];
  const cKey = `pubDecks::${profileId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  const data = await callBackend({ action: 'getDecks', profileId });
  return cacheSet(cKey, data.decks || []);
}

/**
 * getPublicProfileStats — fetches game/deck stats for a public profile.
 * Uses backend service role to bypass RLS on GameParticipant and Deck.
 */
export async function getPublicProfileStats(profileId) {
  if (!profileId) return null;
  const cKey = `pubStats::${profileId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const data = await callBackend({ action: 'getStats', profileId });
    return cacheSet(cKey, data.stats || null);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}