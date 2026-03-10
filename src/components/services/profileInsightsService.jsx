/**
 * profileInsightsService — computes profile insight cards from approved games.
 * Batch-fetches data, no N+1. 60s TTL cache + in-flight guard.
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

export function invalidateProfileInsightsCache(userId) {
  for (const key of _cache.keys()) {
    if (key.includes(userId)) _cache.delete(key);
  }
}

/**
 * getProfileInsights(auth)
 * Returns:
 * {
 *   totalWinRatePercent: number,
 *   wins: number,
 *   gamesPlayed: number,
 *   mostDefeatedOpponent: { displayName: string, count: number } | null,
 *   mostPlayedDeck: { deckId: string, commanderName: string, imageUrl: string, count: number } | null,
 * }
 */
export async function getProfileInsights(auth) {
  if (auth.isGuest || !auth.currentUser) return null;
  const userId = auth.currentUser.id;
  const cKey = `profileInsights::${userId}`;

  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  const promise = (async () => {
    // 1. Fetch all my participations (by participant_profile_id = Profile.id) + approved games + decks
    const [myParticipations, allGames, myDecks] = await Promise.all([
      base44.entities.GameParticipant.filter({ participant_profile_id: userId }, "-created_date", 500).catch(() => []),
      base44.entities.Game.list("-played_at", 500).catch(() => []),
      base44.entities.Deck.filter({ owner_id: userId }).catch(() => []),
    ]);

    // Index approved game ids
    const approvedGameIds = new Set(
      allGames.filter((g) => g.status === "approved").map((g) => g.id)
    );

    // My participations in approved games only
    const myApproved = myParticipations.filter((p) => approvedGameIds.has(p.game_id));
    const gamesPlayed = myApproved.length;
    const wins = myApproved.filter((p) => p.placement === 1).length;
    const totalWinRatePercent = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    // Win game ids (where I got placement 1)
    const winGameIds = new Set(myApproved.filter((p) => p.placement === 1).map((p) => p.game_id));

    // Most Defeated Opponent: for each game I won, count all other participants
    let mostDefeatedOpponent = null;
    if (winGameIds.size > 0) {
      // Fetch all participants for games I won — batch (filter by game_id won't work for multiple ids so we list all and filter)
      // We already have myParticipations. We need OTHER participants in those games.
      // Re-use allGames ids to do a targeted fetch per win game is N+1; instead list all participants and filter.
      // Use myParticipations game_ids to avoid listing all participants (RLS + perf)
      // We can only see participants in our own games — sufficient for opponent counting
      const allParticipantsInWinGames = await base44.entities.GameParticipant.list("-created_date", 1000).catch(() => []);
      const opponentCounts = {};
      for (const p of allParticipantsInWinGames) {
        if (!winGameIds.has(p.game_id)) continue;
        const pid = p.participant_profile_id || p.user_id;
        if (pid === userId) continue; // skip self
        opponentCounts[pid] = (opponentCounts[pid] || 0) + 1;
      }
      const topOpponentId = Object.keys(opponentCounts).sort((a, b) => opponentCounts[b] - opponentCounts[a])[0];
      if (topOpponentId) {
        const allProfiles = await base44.entities.Profile.list("-created_date", 200);
        const oppProfile = allProfiles.find((pr) => pr.id === topOpponentId);
        mostDefeatedOpponent = {
          displayName: oppProfile?.display_name || "Unknown",
          count: opponentCounts[topOpponentId],
        };
      }
    }

    // Most Played Deck (approved games, non-null selected_deck_id)
    let mostPlayedDeck = null;
    const deckPlayCounts = {};
    for (const p of myApproved) {
      const deckId = p.selected_deck_id || p.deck_id;
      if (!deckId) continue;
      deckPlayCounts[deckId] = (deckPlayCounts[deckId] || 0) + 1;
    }
    const topDeckId = Object.keys(deckPlayCounts).sort((a, b) => deckPlayCounts[b] - deckPlayCounts[a])[0];
    if (topDeckId) {
      const deck = myDecks.find((d) => d.id === topDeckId);
      mostPlayedDeck = {
        deckId: topDeckId,
        commanderName: deck?.commander_name || "Unknown",
        imageUrl: deck?.commander_image_url || "",
        count: deckPlayCounts[topDeckId],
      };
    }

    return cacheSet(cKey, { totalWinRatePercent, wins, gamesPlayed, mostDefeatedOpponent, mostPlayedDeck });
  })();

  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return promise;
}