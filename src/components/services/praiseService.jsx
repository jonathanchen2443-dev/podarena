/**
 * praiseService — client-side service wrapper for the PRAISES feature.
 *
 * All praise creation, validation, and aggregation go through the backend
 * (publicProfiles function, praise* actions). No direct entity writes.
 *
 * PRAISE RULES (enforced backend-side):
 * 1. Optional — never required.
 * 2. One praise per giver per game (upsert semantics).
 * 3. Cannot praise yourself.
 * 4. Receiver must be another participant in the same game.
 * 5. praise_type must be one of the 6 fixed values.
 * 6. Praises only become visible/counted after the game is fully approved.
 * 7. Hidden/rejected/hard-deleted games do not count in aggregations.
 *
 * VALID PRAISE TYPES (kept here for UI use — enforcement is also backend-side):
 */

import { base44 } from "@/api/base44Client";

export const PRAISE_TYPES = [
  "on_fire",
  "no_mercy",
  "puppet_master",
  "fortress",
  "clutch",
  "crowned_commander",
];

export const PRAISE_META = {
  on_fire: {
    key: "on_fire",
    label: "On Fire",
    description: "Exceptional sequencing and maximum value from every move.",
    emoji: "🔥",
  },
  no_mercy: {
    key: "no_mercy",
    label: "No Mercy",
    description: "Played relentlessly and pressured the table with nonstop aggression.",
    emoji: "⚔️",
  },
  puppet_master: {
    key: "puppet_master",
    label: "Puppet Master",
    description: "Controlled the table with smart planning, timing, and manipulation.",
    emoji: "🧵",
  },
  fortress: {
    key: "fortress",
    label: "Fortress",
    description: "Dominated the board with resilience, presence, and control.",
    emoji: "🏰",
  },
  clutch: {
    key: "clutch",
    label: "Clutch",
    description: "Delivered the game-changing play exactly when it mattered most.",
    emoji: "🎯",
  },
  crowned_commander: {
    key: "crowned_commander",
    label: "Crowned Commander",
    description: "Made their commander the star of the game and got maximum value out of it.",
    emoji: "👑",
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

async function callPraise(payload) {
  const res = await base44.functions.invoke("praises", payload);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

// ── Cache (30s TTL for aggregation reads) ────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const _cache = new Map();
const _inflight = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { _cache.set(key, { ts: Date.now(), value }); return value; }

export function invalidatePraiseCache(key) {
  if (key) {
    for (const k of _cache.keys()) {
      if (k.includes(key)) _cache.delete(k);
    }
  } else {
    _cache.clear();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * savePraise — create or update the caller's praise choice for a game.
 * Called by:
 *   - Log Game submit flow (logger's own praise, if selected)
 *   - Review/Approve flow (participant's praise, if selected before approving)
 *
 * Backend enforces:
 *   - one praise per giver per game (upsert)
 *   - no self-praise
 *   - receiver must be another participant
 *   - praise_type must be valid
 *
 * @param {string} gameId
 * @param {string} receiverProfileId  - Profile ID of the player being praised
 * @param {string} praiseType         - one of PRAISE_TYPES
 * @param {object} auth               - { authUserId, currentUser: { id } }
 * @returns {Promise<{ praise: object }>}
 */
export async function savePraise(gameId, receiverProfileId, praiseType, auth) {
  if (!gameId || !receiverProfileId || !praiseType) return null;
  if (!auth?.authUserId || !auth?.currentUser?.id) return null;

  invalidatePraiseCache(gameId);

  return callPraise({
    action: "savePraise",
    gameId,
    receiverProfileId,
    praiseType,
    callerAuthUserId: auth.authUserId,
    callerProfileId: auth.currentUser.id,
  });
}

/**
 * getGamePraises — get all praises for a fully-approved game.
 * Returns empty array for pending/rejected/hidden games.
 * Callers that are participants in the game may retrieve this.
 *
 * Shape per item: { giver_profile_id, receiver_profile_id, praise_type,
 *   receiver_deck_name_at_time, receiver_commander_name_at_time, receiver_deck_id_at_time }
 *
 * @param {string} gameId
 * @param {string} callerAuthUserId
 * @returns {Promise<Array>}
 */
export async function getGamePraises(gameId, callerAuthUserId) {
  if (!gameId || !callerAuthUserId) return [];
  const cKey = `gamePraises::${gameId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const data = await callPraise({ action: "getGamePraises", gameId, callerAuthUserId });
    return cacheSet(cKey, data.praises || []);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}

/**
 * getPlayerPraiseSummary — count of praises received, by praise_type, for a profile.
 * Only counts from approved, non-hidden games.
 *
 * Shape returned: { on_fire: 0, no_mercy: 0, puppet_master: 0, fortress: 0, clutch: 0, crowned_commander: 0, total: 0 }
 *
 * @param {string} receiverProfileId
 * @returns {Promise<object>}
 */
export async function getPlayerPraiseSummary(receiverProfileId) {
  if (!receiverProfileId) return _emptyPraiseSummary();
  const cKey = `playerPraise::${receiverProfileId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const data = await callPraise({ action: "getPlayerPraiseSummary", receiverProfileId });
    return cacheSet(cKey, data.summary || _emptyPraiseSummary());
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}

/**
 * getDeckPraiseSummary — count of praises received by a specific deck context.
 * "Deck context" is identified by receiver_deck_id_at_time across all games.
 * Only counts from approved, non-hidden games.
 *
 * Shape returned: { on_fire: 0, no_mercy: 0, ... , total: 0 }
 *
 * @param {string} deckId
 * @returns {Promise<object>}
 */
export async function getDeckPraiseSummary(deckId) {
  if (!deckId) return _emptyPraiseSummary();
  const cKey = `deckPraise::${deckId}`;
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    const data = await callPraise({ action: "getDeckPraiseSummary", deckId });
    return cacheSet(cKey, data.summary || _emptyPraiseSummary());
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _emptyPraiseSummary() {
  return {
    on_fire: 0,
    no_mercy: 0,
    puppet_master: 0,
    fortress: 0,
    clutch: 0,
    crowned_commander: 0,
    total: 0,
  };
}