/**
 * League Service - Centralized league data fetching with visibility enforcement.
 */
import { base44 } from "@/api/base44Client";

/**
 * Returns leagues visible to the current user:
 * - Guest: only public leagues
 * - Authed: all public leagues + private leagues they are an active member of
 */
export async function listVisibleLeagues(auth) {
  const allLeagues = await base44.entities.League.list("-created_date", 100);

  if (auth.isGuest || !auth.currentUser) {
    return allLeagues.filter((l) => l.is_public);
  }

  // Get the user's active memberships
  const memberships = await base44.entities.LeagueMember.filter({
    user_id: auth.currentUser.id,
    status: "active",
  });
  const memberLeagueIds = new Set(memberships.map((m) => m.league_id));

  return allLeagues.filter((l) => l.is_public || memberLeagueIds.has(l.id));
}

/**
 * Fetch a single league by ID and enforce visibility:
 * - If public: always readable
 * - If private + guest: throws "private"
 * - If private + authed non-member: throws "restricted"
 * - If private + active member: returns league
 *
 * Returns { league, isMember, memberships }
 */
export async function getLeagueById(auth, leagueId) {
  const results = await base44.entities.League.filter({ id: leagueId });
  const league = results[0];
  if (!league) throw new Error("not_found");

  if (league.is_public) {
    const isMember = auth.isGuest || !auth.currentUser
      ? false
      : await _checkMembership(auth.currentUser.id, leagueId);
    return { league, isMember };
  }

  // Private league
  if (auth.isGuest || !auth.currentUser) throw new Error("private");

  const isMember = await _checkMembership(auth.currentUser.id, leagueId);
  if (!isMember) throw new Error("restricted");

  return { league, isMember };
}

/**
 * Compute standings for a league from approved games only.
 * Returns an array of player rows sorted by: totalPoints → winRate → wins → display_name.
 */
export async function getLeagueStandings(auth, leagueId) {
  // Visibility gate
  await getLeagueById(auth, leagueId);

  // 1. Fetch approved games for this league
  const games = await base44.entities.Game.filter({ league_id: leagueId, status: "approved" });
  if (games.length === 0) return [];

  const gameIds = games.map((g) => g.id);

  // 2. Fetch all participants for those games (batch per game)
  const participantArrays = await Promise.all(
    gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }))
  );
  const allParticipants = participantArrays.flat();

  // 3. Collect unique user IDs and deck IDs
  const userIds = [...new Set(allParticipants.map((p) => p.user_id))];
  const deckIds = [...new Set(allParticipants.map((p) => p.deck_id).filter(Boolean))];

  // 4. Fetch profiles and decks in parallel
  const [profileArrays, deckArrays] = await Promise.all([
    Promise.all(userIds.map((uid) => base44.entities.Profile.filter({ id: uid }))),
    Promise.all(deckIds.map((did) => base44.entities.Deck.filter({ id: did }))),
  ]);

  const profileMap = {};
  userIds.forEach((uid, i) => { if (profileArrays[i]?.[0]) profileMap[uid] = profileArrays[i][0]; });

  const deckMap = {};
  deckIds.forEach((did, i) => { if (deckArrays[i]?.[0]) deckMap[did] = deckArrays[i][0]; });

  // 5. Build a game date lookup for recency sorting
  const gameDateMap = {};
  games.forEach((g) => { gameDateMap[g.id] = g.played_at || g.created_date; });

  // 6. Aggregate per user
  const statsMap = {};
  for (const p of allParticipants) {
    if (!statsMap[p.user_id]) {
      statsMap[p.user_id] = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, participations: [] };
    }
    const s = statsMap[p.user_id];
    s.gamesPlayed++;

    // Resolve result
    let result = p.result;
    if (!result && p.placement != null) {
      result = p.placement === 1 ? "win" : "loss";
    }
    if (result === "win") s.wins++;
    else if (result === "draw") s.draws++;
    else s.losses++;

    s.participations.push({ game_id: p.game_id, deck_id: p.deck_id, date: gameDateMap[p.game_id] });
  }

  // 7. Shape rows
  const rows = userIds.map((uid) => {
    const s = statsMap[uid] || { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, participations: [] };
    const profile = profileMap[uid];
    const totalPoints = s.wins * 3 + s.draws * 1;
    const winRate = s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 1000) / 10 : 0;

    // Recent decks: last 5 participations, newest first
    const sorted = [...s.participations].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentDecks = sorted.slice(0, 5).map((part) => {
      if (!part.deck_id) return { variant: "didNotPlay", colorIdentity: [] };
      const deck = deckMap[part.deck_id];
      if (!deck) return { variant: "didNotPlay", colorIdentity: [] };
      const ci = deck.color_identity || [];
      const hasRealColors = ci.some((c) => ["W","U","B","R","G"].includes(c));
      if (!hasRealColors) return { variant: "colorless", colorIdentity: ci };
      return { variant: "deck", colorIdentity: ci };
    });

    return {
      userId: uid,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      gamesPlayed: s.gamesPlayed,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      winRate,
      totalPoints,
      recentDecks,
    };
  });

  // 8. Sort: Pts ↓, WinRate ↓, Wins ↓, Name ↑
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.display_name.localeCompare(b.display_name);
  });

  return rows;
}

async function _checkMembership(profileId, leagueId) {
  const m = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: profileId,
    status: "active",
  });
  return m.length > 0;
}

/**
 * List active members of a league with their public profile info.
 * Applies the same visibility gating as getLeagueById.
 * Returns array of { userId, display_name, avatar_url, role }
 */
export async function listLeagueMembers(auth, leagueId) {
  // Re-use visibility gating
  await getLeagueById(auth, leagueId); // throws if not visible

  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  // Fetch profiles in parallel
  const profileResults = await Promise.all(
    members.map((m) => base44.entities.Profile.filter({ id: m.user_id }))
  );

  return members.map((m, i) => {
    const profile = profileResults[i]?.[0];
    return {
      userId: m.user_id,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      role: m.role,
    };
  });
}