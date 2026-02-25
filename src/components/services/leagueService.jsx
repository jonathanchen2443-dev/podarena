/**
 * League Service - Centralized league data fetching with visibility enforcement.
 *
 * Optimizations applied:
 * - Simple in-memory cache with TTL (60s) per leagueId + operation
 * - Visibility gate result is cached so tab-switches don't repeat it
 * - Removed N+1 patterns: profile/deck lookups are batched via list() with post-filter
 * - Service methods accept a pre-validated leagueId to skip redundant visibility calls
 */
import { base44 } from "@/api/base44Client";

// ── Simple in-memory cache ────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000; // 60 seconds
const _cache = new Map();

function cacheKey(...parts) {
  return parts.join("::");
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  _cache.set(key, { ts: Date.now(), value });
  return value;
}

export function invalidateLeagueCache(leagueId) {
  for (const key of _cache.keys()) {
    if (key.includes(leagueId)) _cache.delete(key);
  }
}

// ── Visibility Gate ───────────────────────────────────────────────────────────

async function _checkMembership(profileId, leagueId) {
  const key = cacheKey("membership", profileId, leagueId);
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  const m = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: profileId,
    status: "active",
  });
  return cacheSet(key, m.length > 0);
}

/**
 * Returns leagues visible to the current user.
 */
export async function listVisibleLeagues(auth) {
  const allLeagues = await base44.entities.League.list("-created_date", 100);

  if (auth.isGuest || !auth.currentUser) {
    return allLeagues.filter((l) => l.is_public);
  }

  const memberships = await base44.entities.LeagueMember.filter({
    user_id: auth.currentUser.id,
    status: "active",
  });
  const memberLeagueIds = new Set(memberships.map((m) => m.league_id));
  return allLeagues.filter((l) => l.is_public || memberLeagueIds.has(l.id));
}

/**
 * Fetch a single league by ID and enforce visibility.
 * Returns { league, isMember }
 * Cached per leagueId + userId.
 */
export async function getLeagueById(auth, leagueId) {
  const userId = auth.currentUser?.id || "guest";
  const key = cacheKey("leagueById", leagueId, userId);
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const results = await base44.entities.League.filter({ id: leagueId });
  const league = results[0];
  if (!league) throw new Error("not_found");

  if (league.is_public) {
    const isMember = auth.isGuest || !auth.currentUser
      ? false
      : await _checkMembership(auth.currentUser.id, leagueId);
    return cacheSet(key, { league, isMember });
  }

  // Private league
  if (auth.isGuest || !auth.currentUser) throw new Error("private");

  const isMember = await _checkMembership(auth.currentUser.id, leagueId);
  if (!isMember) throw new Error("restricted");

  return cacheSet(key, { league, isMember });
}

// ── Shared batch helpers ──────────────────────────────────────────────────────

/**
 * Fetch all profiles by IDs using a single list call, then map by id.
 * Avoids N+1 filter-per-user.
 */
async function _fetchProfileMap(userIds) {
  if (userIds.length === 0) return {};
  // Fetch up to 200 profiles and filter client-side — much cheaper than N individual calls
  const allProfiles = await base44.entities.Profile.list("-created_date", 200);
  const needed = new Set(userIds);
  const map = {};
  for (const p of allProfiles) {
    if (needed.has(p.id)) map[p.id] = p;
  }
  return map;
}

/**
 * Fetch all decks by IDs using a single list call, then map by id.
 */
async function _fetchDeckMap(deckIds) {
  if (deckIds.length === 0) return {};
  const allDecks = await base44.entities.Deck.list("-created_date", 500);
  const needed = new Set(deckIds);
  const map = {};
  for (const d of allDecks) {
    if (needed.has(d.id)) map[d.id] = d;
  }
  return map;
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getLeagueStandings(auth, leagueId) {
  const cKey = cacheKey("standings", leagueId, auth.currentUser?.id || "guest");
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  // Visibility gate (cached internally)
  await getLeagueById(auth, leagueId);

  // 1. Fetch all active league members (determines who appears in standings)
  const activeMembers = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });
  const allMemberUserIds = [...new Set(activeMembers.map((m) => m.user_id))];

  // 2. Fetch approved games
  const games = await base44.entities.Game.filter({ league_id: leagueId, status: "approved" });
  const gameIds = games.map((g) => g.id);

  // 3. Fetch all participants for all games in parallel
  const participantArrays = gameIds.length > 0
    ? await Promise.all(gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid })))
    : [];
  const allParticipants = participantArrays.flat();

  // 4. Batch-fetch profiles (union of member ids + participant ids) and decks
  const participantUserIds = allParticipants.map((p) => p.user_id);
  const allUserIds = [...new Set([...allMemberUserIds, ...participantUserIds])];
  const deckIds = [...new Set(allParticipants.map((p) => p.deck_id).filter(Boolean))];

  const [profileMap, deckMap] = await Promise.all([
    _fetchProfileMap(allUserIds),
    _fetchDeckMap(deckIds),
  ]);

  // 5. Build game date lookup
  const gameDateMap = {};
  games.forEach((g) => { gameDateMap[g.id] = g.played_at || g.created_date; });

  // 6. Aggregate stats per user from approved game participants
  const statsMap = {};
  for (const p of allParticipants) {
    if (!statsMap[p.user_id]) {
      statsMap[p.user_id] = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, participations: [] };
    }
    const s = statsMap[p.user_id];
    s.gamesPlayed++;
    let result = p.result;
    if (!result && p.placement != null) result = p.placement === 1 ? "win" : "loss";
    if (result === "win") s.wins++;
    else if (result === "draw") s.draws++;
    else s.losses++;
    s.participations.push({ game_id: p.game_id, deck_id: p.deck_id, date: gameDateMap[p.game_id] });
  }

  // 7. Shape rows — start from ALL active members (zero-game members included)
  const rows = allMemberUserIds.map((uid) => {
    const s = statsMap[uid] || { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, participations: [] };
    const profile = profileMap[uid];
    const totalPoints = s.wins; // win=1, draw=0, loss=0
    const winRate = s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 1000) / 10 : 0;

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

  // 8. Sort: points → winRate → wins → losses (asc) → name (asc)
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.display_name.localeCompare(b.display_name);
  });

  return cacheSet(cKey, rows);
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function listLeagueGames(auth, leagueId, { includeRejected = false } = {}) {
  const cKey = cacheKey("games", leagueId, auth.currentUser?.id || "guest", String(includeRejected));
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  // Visibility gate (cached internally)
  await getLeagueById(auth, leagueId);

  const allGames = await base44.entities.Game.filter({ league_id: leagueId }, "-created_date", 100);
  const games = includeRejected ? allGames : allGames.filter((g) => g.status !== "rejected");
  if (games.length === 0) return cacheSet(cKey, []);

  const gameIds = games.map((g) => g.id);

  // Fetch participants + approvals for all games in parallel
  const [participantArrays, approvalArrays] = await Promise.all([
    Promise.all(gameIds.map((gid) => base44.entities.GameParticipant.filter({ game_id: gid }))),
    Promise.all(gameIds.map((gid) => base44.entities.GameApproval.filter({ game_id: gid }))),
  ]);

  const allParticipants = participantArrays.flat();
  const userIds = [...new Set(allParticipants.map((p) => p.user_id))];
  const deckIds = [...new Set(allParticipants.map((p) => p.deck_id).filter(Boolean))];

  // Batch fetch profiles and decks
  const [profileMap, deckMap] = await Promise.all([
    _fetchProfileMap(userIds),
    _fetchDeckMap(deckIds),
  ]);

  const result = games.map((game, i) => {
    const participants = participantArrays[i].map((p) => {
      const profile = profileMap[p.user_id];
      const deck = p.deck_id ? deckMap[p.deck_id] : null;
      return {
        userId: p.user_id,
        display_name: profile?.display_name || "Unknown",
        avatar_url: profile?.avatar_url || null,
        result: p.result || null,
        placement: p.placement || null,
        deck: deck
          ? { id: deck.id, name: deck.name, color_identity: deck.color_identity || [] }
          : null,
      };
    });

    const approvals = approvalArrays[i];
    const approvalSummary = {
      total: approvals.length,
      approved: approvals.filter((a) => a.status === "approved").length,
      rejected: approvals.filter((a) => a.status === "rejected").length,
      pending: approvals.filter((a) => a.status === "pending").length,
      records: approvals,
    };

    return {
      id: game.id,
      status: game.status,
      played_at: game.played_at || game.created_date,
      created_date: game.created_date,
      notes: game.notes || "",
      participants,
      approvalSummary,
    };
  });

  return cacheSet(cKey, result);
}

// ── Create League ─────────────────────────────────────────────────────────────

/**
 * Create a new league and add the creator as admin member.
 * Returns { league, membership }.
 */
export async function createLeague(auth, { name, description, is_public }) {
  if (auth.isGuest || !auth.currentUser) {
    throw new Error("You must be signed in to create a league.");
  }
  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new Error("League name is required.");
  if (trimmedName.length > 100) throw new Error("League name is too long (max 100 characters).");

  const league = await base44.entities.League.create({
    name: trimmedName,
    description: (description || "").trim(),
    is_public: is_public !== false, // default true
  });

  const membership = await base44.entities.LeagueMember.create({
    league_id: league.id,
    user_id: auth.currentUser.id,
    role: "admin",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  // Invalidate relevant caches
  invalidateLeagueCache(league.id);

  return { league, membership };
}

// ── Leagues for Game Logging ──────────────────────────────────────────────────

/**
 * Returns only leagues where the current user is an active member
 * (they can submit games to these leagues).
 * Result is cached 60s.
 */
export async function listLeaguesForGameLogging(auth) {
  if (auth.isGuest || !auth.currentUser) return [];
  const cKey = cacheKey("leaguesForLogging", auth.currentUser.id);
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  const memberships = await base44.entities.LeagueMember.filter({
    user_id: auth.currentUser.id,
    status: "active",
  });
  if (memberships.length === 0) return cacheSet(cKey, []);

  const leagueIds = memberships.map((m) => m.league_id);
  const allLeagues = await base44.entities.League.list("-created_date", 100);
  const result = allLeagues.filter((l) => leagueIds.includes(l.id));
  return cacheSet(cKey, result);
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function listLeagueMembers(auth, leagueId) {
  const cKey = cacheKey("members", leagueId, auth.currentUser?.id || "guest");
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  await getLeagueById(auth, leagueId);

  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  const userIds = members.map((m) => m.user_id);
  const profileMap = await _fetchProfileMap(userIds);

  const result = members.map((m) => {
    const profile = profileMap[m.user_id];
    return {
      userId: m.user_id,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      role: m.role,
    };
  });

  return cacheSet(cKey, result);
}