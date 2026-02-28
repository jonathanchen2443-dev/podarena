/**
 * deckStatsService — enriches deck list with per-deck winrate from approved games.
 * Avoids N+1 by batch-fetching all participants and approved game statuses.
 * 60s TTL cache.
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

export function invalidateDeckStatsCache(userId) {
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

/**
 * getMyDecksWithStats(auth)
 * Returns decks[] each with: gamesWithDeck, winsWithDeck, winRatePercent
 */
export async function getMyDecksWithStats(auth) {
  if (auth.isGuest || !auth.currentUser) return [];
  const userId = auth.currentUser.id;
  const cKey = `deckStats::${userId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    // 1. Fetch my decks + all my participations in parallel
    const [decks, allParticipations] = await Promise.all([
      base44.entities.Deck.filter({ owner_id: userId }, "-updated_date"),
      base44.entities.GameParticipant.filter({ user_id: userId }),
    ]);

    if (decks.length === 0) return cacheSet(cKey, []);

    const deckIds = new Set(decks.map((d) => d.id));
    // Only keep participations that used one of my decks
    const relevantParticipations = allParticipations.filter(
      (p) => p.deck_id && deckIds.has(p.deck_id)
    );

    // 2. Fetch approved game statuses for those game ids
    const gameIds = [...new Set(relevantParticipations.map((p) => p.game_id))];
    let approvedGameIds = new Set();
    if (gameIds.length > 0) {
      const games = await base44.entities.Game.list("-created_date", 500);
      for (const g of games) {
        if (g.status === "approved" && gameIds.includes(g.id)) {
          approvedGameIds.add(g.id);
        }
      }
    }

    // 3. Aggregate per deck
    const deckStats = {};
    for (const p of relevantParticipations) {
      if (!approvedGameIds.has(p.game_id)) continue;
      if (!deckStats[p.deck_id]) deckStats[p.deck_id] = { gamesWithDeck: 0, winsWithDeck: 0 };
      deckStats[p.deck_id].gamesWithDeck++;
      if (p.placement === 1) deckStats[p.deck_id].winsWithDeck++;
    }

    // 4. Attach stats to each deck
    const result = decks.map((deck) => {
      const s = deckStats[deck.id] || { gamesWithDeck: 0, winsWithDeck: 0 };
      const winRatePercent = s.gamesWithDeck > 0
        ? Math.round((s.winsWithDeck / s.gamesWithDeck) * 100)
        : 0;
      return { ...deck, ...s, winRatePercent };
    });

    return cacheSet(cKey, result);
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}