/**
 * deckInsightsService — per-deck insights for the popup modal.
 * Uses approved games only. 60s TTL cache + in-flight guard.
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

export function invalidateDeckInsightsCache(userId) {
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

/**
 * getDeckInsights(auth, deck)
 * Returns: { gamesWithDeck, winsWithDeck, winRatePercent, mostDefeatedOpponent }
 * mostDefeatedOpponent: { display_name, count } or null
 */
export async function getDeckInsights(auth, deck) {
  if (auth.isGuest || !auth.currentUser) return null;
  const userId = auth.currentUser.id;
  const deckId = deck.id;
  const cKey = `deckInsights::${userId}::${deckId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    // 1. Fetch all my participations for this deck + all games in parallel
    const [myParticipations, allGames] = await Promise.all([
      base44.entities.GameParticipant.filter({ user_id: userId, deck_id: deckId }),
      base44.entities.Game.list("-created_date", 500),
    ]);

    const approvedGameIds = new Set(
      allGames.filter((g) => g.status === "approved").map((g) => g.id)
    );

    const approvedMyParticipations = myParticipations.filter((p) => approvedGameIds.has(p.game_id));

    const gamesWithDeck = approvedMyParticipations.length;
    const winsWithDeck = approvedMyParticipations.filter((p) => p.placement === 1).length;
    const winRatePercent = gamesWithDeck > 0 ? Math.round((winsWithDeck / gamesWithDeck) * 100) : 0;

    // 2. Find most defeated opponent: games where I won with this deck
    const winGameIds = approvedMyParticipations
      .filter((p) => p.placement === 1)
      .map((p) => p.game_id);

    let mostDefeatedOpponent = null;

    if (winGameIds.length > 0) {
      // Fetch all participants from those games in one batch (only way is filter by game_id array)
      // We do a single list call and filter client-side to avoid N+1
      const allParticipants = await base44.entities.GameParticipant.list("-created_date", 1000);
      const opponentCounts = {};
      for (const p of allParticipants) {
        if (winGameIds.includes(p.game_id) && p.user_id !== userId) {
          opponentCounts[p.user_id] = (opponentCounts[p.user_id] || 0) + 1;
        }
      }

      const topOpponentId = Object.keys(opponentCounts).sort(
        (a, b) => opponentCounts[b] - opponentCounts[a]
      )[0];

      if (topOpponentId) {
        const allProfiles = await base44.entities.Profile.list("-created_date", 200);
        const oppProfile = allProfiles.find((pr) => pr.id === topOpponentId);
        mostDefeatedOpponent = {
          display_name: oppProfile?.display_name || "Unknown",
          count: opponentCounts[topOpponentId],
        };
      }
    }

    return cacheSet(cKey, { gamesWithDeck, winsWithDeck, winRatePercent, mostDefeatedOpponent });
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}