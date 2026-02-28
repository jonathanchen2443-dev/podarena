/**
 * League Service - Centralized league data fetching with visibility enforcement.
 *
 * Cache key scheme: `${op}::${leagueId}::${userId||"guest"}::${inviteToken||"none"}`
 * - All keys are scoped by operation + leagueId + userId + inviteToken
 * - invited_view results never pollute member/public cache entries (different token in key)
 * - invalidateLeagueCache(leagueId) wipes all keys containing leagueId
 */
import { base44 } from "@/api/base44Client";

// ── Simple in-memory cache ────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000; // 60 seconds
const _cache = new Map();
// In-flight promise dedup: prevent concurrent identical requests
const _inflight = new Map();

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

/** Dedup concurrent async calls with the same key. */
async function dedupedFetch(key, fn) {
  if (_inflight.has(key)) return _inflight.get(key);
  const promise = fn().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}

export function invalidateLeagueCache(leagueId) {
  for (const key of _cache.keys()) {
    if (key.includes(leagueId)) _cache.delete(key);
  }
  for (const key of _inflight.keys()) {
    if (key.includes(leagueId)) _inflight.delete(key);
  }
}

/** Call after join/leave so the leagues list re-fetches for the current user. */
export function invalidateLeaguesListCache() {
  for (const key of _cache.keys()) {
    if (key.startsWith("visibleLeagues::") || key.startsWith("leaguesForLogging::")) _cache.delete(key);
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
 * Returns leagues visible to the current user. Cached 60s, deduped.
 */
export async function listVisibleLeagues(auth) {
  const userId = auth.currentUser?.id || "guest";
  const cKey = cacheKey("visibleLeagues", userId);
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  return dedupedFetch(cKey, async () => {
    const allLeagues = await base44.entities.League.list("-created_date", 100);

    if (auth.isGuest || !auth.currentUser) {
      return cacheSet(cKey, allLeagues.filter((l) => l.is_public));
    }

    const memberships = await base44.entities.LeagueMember.filter({
      user_id: auth.currentUser.id,
      status: "active",
    });
    const memberLeagueIds = new Set(memberships.map((m) => m.league_id));
    return cacheSet(cKey, allLeagues.filter((l) => l.is_public || memberLeagueIds.has(l.id)));
  });
}

/**
 * Fetch a single league by ID and enforce visibility.
 * Returns { league, isMember, accessMode: "member" | "public" | "invited_view" }
 * Cached per leagueId + userId + inviteToken.
 */
export async function getLeagueById(auth, leagueId, inviteToken = null) {
  const userId = auth.currentUser?.id || "guest";
  // Key includes token so member vs invited_view results never cross-pollute
  const key = cacheKey("leagueById", leagueId, userId, inviteToken || "none");
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  return dedupedFetch(key, async () => {
    const results = await base44.entities.League.filter({ id: leagueId });
    const league = results[0];
    if (!league) throw new Error("not_found");

    if (league.is_public) {
      const isMember = auth.isGuest || !auth.currentUser
        ? false
        : await _checkMembership(auth.currentUser.id, leagueId);
      const accessMode = isMember ? "member" : "public";
      return cacheSet(key, { league, isMember, accessMode });
    }

    if (auth.isGuest || !auth.currentUser) throw new Error("private");

    const isMember = await _checkMembership(auth.currentUser.id, leagueId);
    if (isMember) return cacheSet(key, { league, isMember: true, accessMode: "member" });

    if (inviteToken) {
      const { valid } = await _validateInviteInternal(leagueId, inviteToken);
      if (valid) return cacheSet(key, { league, isMember: false, accessMode: "invited_view" });
    }

    throw new Error("restricted");
  });
}

async function _validateInviteInternal(leagueId, token) {
  if (!token) return { valid: false };
  const results = await base44.entities.LeagueInvite.filter({ league_id: leagueId, token, is_active: true });
  const invite = results[0] || null;
  if (!invite) return { valid: false };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { valid: false };
  return { valid: true, invite };
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

export async function getLeagueStandings(auth, leagueId, inviteToken = null) {
  const userId = auth.currentUser?.id || "guest";
  const cKey = cacheKey("standings", leagueId, userId, inviteToken || "none");
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  await getLeagueById(auth, leagueId, inviteToken);

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

  const promise = Promise.resolve(rows);
  _inflight.set(cKey, promise);
  promise.finally(() => _inflight.delete(cKey));
  return cacheSet(cKey, rows);
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function listLeagueGames(auth, leagueId, { includeRejected = false, inviteToken = null } = {}) {
  const userId = auth.currentUser?.id || "guest";
  const cKey = cacheKey("games", leagueId, userId, inviteToken || "none", String(includeRejected));
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  await getLeagueById(auth, leagueId, inviteToken);

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

  const gamesPromise = Promise.resolve(result);
  _inflight.set(cKey, gamesPromise);
  gamesPromise.finally(() => _inflight.delete(cKey));
  return cacheSet(cKey, result);
}

// ── Update League ─────────────────────────────────────────────────────────────

/**
 * Check if current user is an active admin of a league.
 * Uses cached membership check to avoid extra DB reads.
 */
export async function isLeagueAdmin(auth, leagueId) {
  if (auth.isGuest || !auth.currentUser) return false;
  const cKey = cacheKey("adminCheck", leagueId, auth.currentUser.id);
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: auth.currentUser.id,
    status: "active",
  });
  return cacheSet(cKey, members.length > 0 && members[0].role === "admin");
}

/**
 * Update league details (name, description, is_public, max_members).
 * Only active admins may call this.
 */
export async function updateLeague(auth, leagueId, updates) {
  if (auth.isGuest || !auth.currentUser) {
    throw new Error("You must be signed in to edit a league.");
  }
  const admin = await isLeagueAdmin(auth, leagueId);
  if (!admin) throw new Error("Only admins can edit this league.");

  const trimmedName = (updates.name || "").trim();
  if (!trimmedName) throw new Error("League name is required.");
  if (trimmedName.length > 100) throw new Error("League name is too long (max 100 characters).");

  const payload = {
    name: trimmedName,
    description: (updates.description || "").trim(),
    is_public: updates.is_public !== false,
  };
  if (updates.max_members != null) {
    payload.max_members = Math.min(10, Math.max(2, Number(updates.max_members)));
  }

  const updated = await base44.entities.League.update(leagueId, payload);
  invalidateLeagueCache(leagueId);
  invalidateLeaguesListCache();
  return updated;
}

// ── Create League ─────────────────────────────────────────────────────────────

/**
 * Create a new league and add the creator as admin member.
 * Returns { league, membership }.
 */
export async function createLeague(auth, { name, description, is_public, max_members }) {
  if (auth.isGuest || !auth.currentUser) {
    throw new Error("You must be signed in to create a league.");
  }
  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new Error("League name is required.");
  if (trimmedName.length > 100) throw new Error("League name is too long (max 100 characters).");

  const clampedMax = Math.min(10, Math.max(2, Number(max_members) || 10));

  const league = await base44.entities.League.create({
    name: trimmedName,
    description: (description || "").trim(),
    is_public: is_public !== false,
    max_members: clampedMax,
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
  invalidateLeaguesListCache();

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

// ── Invite ────────────────────────────────────────────────────────────────────

function _generateToken() {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export async function validateInvite(leagueId, token) {
  if (!token) return { valid: false, invite: null };
  const cKey = cacheKey("invite_validate", leagueId, token);
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  const results = await base44.entities.LeagueInvite.filter({ league_id: leagueId, token, is_active: true });
  const invite = results[0] || null;
  if (!invite) return cacheSet(cKey, { valid: false, invite: null });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return cacheSet(cKey, { valid: false, invite: null });
  return cacheSet(cKey, { valid: true, invite });
}

/**
 * getOrCreateInvite: Get or create an active invite for a league.
 * For PRIVATE leagues: only admins can generate invite links.
 * For PUBLIC leagues: any active member can share.
 * Returns { token, url }
 */
export async function getOrCreateInvite(auth, leagueId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");

  // Determine league visibility
  const leagueResults = await base44.entities.League.filter({ id: leagueId });
  const league = leagueResults[0];

  if (league && !league.is_public) {
    // Private league: admin-only
    const admin = await isLeagueAdmin(auth, leagueId);
    if (!admin) throw new Error("Only admins can share invite links for private leagues.");
  } else {
    // Public league: any member
    const isMember = await _checkMembership(auth.currentUser.id, leagueId);
    if (!isMember) throw new Error("Only members can create invite links.");
  }

  // Check cache first
  const cKey = cacheKey("invite_get", leagueId);
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;

  // Try to reuse existing active invite
  const existing = await base44.entities.LeagueInvite.filter({
    league_id: leagueId,
    is_active: true,
  });
  const validInvite = existing.find((i) => !i.expires_at || new Date(i.expires_at) > new Date());

  let token;
  if (validInvite) {
    token = validInvite.token;
  } else {
    token = _generateToken();
    await base44.entities.LeagueInvite.create({
      league_id: leagueId,
      token,
      created_by_user_id: auth.currentUser.id,
      is_active: true,
    });
  }

  // Build short invite URL using the /invite page
  const base = window.location.origin;
  const invitePath = "/invite"; // Base44 registers Invite page at /invite
  const url = `${base}${invitePath}?token=${encodeURIComponent(token)}`;
  const result = { token, url };
  return cacheSet(cKey, result);
}

/**
 * Join a public league (authed non-member).
 * Checks capacity and notifies admins.
 */
export async function joinPublicLeague(auth, leagueId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in to join.");

  const results = await base44.entities.League.filter({ id: leagueId });
  const league = results[0];
  if (!league) throw new Error("League not found.");
  if (!league.is_public) throw new Error("This league is private. Use an invite link to join.");

  // Capacity check
  const activeMembers = await base44.entities.LeagueMember.filter({ league_id: leagueId, status: "active" });
  const maxMembers = league.max_members || 10;
  if (activeMembers.length >= maxMembers) throw new Error("This league is full.");

  // Idempotency: check if already member
  const existing = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: auth.currentUser.id,
  });
  if (existing.length > 0 && existing[0].status === "active") {
    throw new Error("You are already a member.");
  }

  let membership;
  if (existing.length > 0) {
    membership = await base44.entities.LeagueMember.update(existing[0].id, { status: "active" });
  } else {
    membership = await base44.entities.LeagueMember.create({
      league_id: leagueId,
      user_id: auth.currentUser.id,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    });
  }
  invalidateLeagueCache(leagueId);
  invalidateLeaguesListCache();

  // Notify all active admins (fire & forget, don't block join on failure)
  try {
    const admins = activeMembers.filter((m) => m.role === "admin");
    if (admins.length > 0) {
      const notifications = admins.map((admin) => ({
        type: "league_join",
        league_id: leagueId,
        actor_user_id: auth.currentUser.id,
        recipient_user_id: admin.user_id,
        message: `${auth.currentUser.display_name || "Someone"} joined ${league.name}`,
      }));
      await base44.entities.Notification.bulkCreate(notifications);
    }
  } catch (_) { /* non-critical */ }

  return membership;
}

/**
 * Accept an invite and join the league.
 * Checks capacity.
 */
export async function acceptInviteJoinLeague(auth, leagueId, token) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in to join.");

  const { valid } = await validateInvite(leagueId, token);
  if (!valid) throw new Error("This invite link is invalid or expired.");

  // Capacity check
  const [leagueResults, activeMembers] = await Promise.all([
    base44.entities.League.filter({ id: leagueId }),
    base44.entities.LeagueMember.filter({ league_id: leagueId, status: "active" }),
  ]);
  const league = leagueResults[0];
  const maxMembers = league?.max_members || 10;
  if (activeMembers.length >= maxMembers) throw new Error("This league is full.");

  // Idempotency
  const existing = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: auth.currentUser.id,
  });
  if (existing.length > 0 && existing[0].status === "active") {
    throw new Error("You are already a member.");
  }

  let membership;
  if (existing.length > 0) {
    membership = await base44.entities.LeagueMember.update(existing[0].id, {
      status: "active",
      joined_at: new Date().toISOString(),
    });
  } else {
    membership = await base44.entities.LeagueMember.create({
      league_id: leagueId,
      user_id: auth.currentUser.id,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    });
  }
  invalidateLeagueCache(leagueId);
  invalidateLeaguesListCache();
  return membership;
}

/**
 * Leave a league. Blocks if last admin.
 */
export async function leaveLeague(auth, leagueId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");

  const allMembers = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  const myMembership = allMembers.find((m) => m.user_id === auth.currentUser.id);
  if (!myMembership) throw new Error("You are not an active member of this league.");

  // Block if last admin
  if (myMembership.role === "admin") {
    const adminCount = allMembers.filter((m) => m.role === "admin").length;
    if (adminCount <= 1) {
      throw new Error("You are the only admin. Promote another member to admin before leaving.");
    }
  }

  await base44.entities.LeagueMember.update(myMembership.id, { status: "left" });
  invalidateLeagueCache(leagueId);
  invalidateLeaguesListCache();
}

/**
 * Admin removes a member from the league.
 */
export async function removeMember(auth, leagueId, memberUserId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");

  const allMembers = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  const myMembership = allMembers.find((m) => m.user_id === auth.currentUser.id);
  if (!myMembership || myMembership.role !== "admin") throw new Error("Only admins can remove members.");

  const targetMembership = allMembers.find((m) => m.user_id === memberUserId);
  if (!targetMembership) throw new Error("Member not found.");

  await base44.entities.LeagueMember.update(targetMembership.id, { status: "removed" });
  invalidateLeagueCache(leagueId);
  invalidateLeaguesListCache();
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function listLeagueMembers(auth, leagueId, inviteToken = null) {
  const userId = auth.currentUser?.id || "guest";
  const cKey = cacheKey("members", leagueId, userId, inviteToken || "none");
  const cached = cacheGet(cKey);
  if (cached !== null) return cached;
  if (_inflight.has(cKey)) return _inflight.get(cKey);

  await getLeagueById(auth, leagueId, inviteToken);

  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  const userIds = members.map((m) => m.user_id);
  const profileMap = await _fetchProfileMap(userIds);

  const result = members.map((m) => {
    const profile = profileMap[m.user_id];
    return {
      membershipId: m.id, // exposed so promote/remove can use it
      userId: m.user_id,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      role: m.role,
    };
  });

  const membersPromise = Promise.resolve(result);
  _inflight.set(cKey, membersPromise);
  membersPromise.finally(() => _inflight.delete(cKey));
  return cacheSet(cKey, result);
}

/**
 * Promote a member to admin. Admin-only.
 * Does not allow demoting last admin.
 */
export async function promoteMemberToAdmin(auth, leagueId, memberUserId) {
  if (auth.isGuest || !auth.currentUser) throw new Error("Must be signed in.");

  const allMembers = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    status: "active",
  });

  const myMembership = allMembers.find((m) => m.user_id === auth.currentUser.id);
  if (!myMembership || myMembership.role !== "admin") throw new Error("Only admins can promote members.");

  const targetMembership = allMembers.find((m) => m.user_id === memberUserId);
  if (!targetMembership) throw new Error("Member not found.");
  if (targetMembership.role === "admin") throw new Error("This member is already an admin.");

  await base44.entities.LeagueMember.update(targetMembership.id, { role: "admin" });
  invalidateLeagueCache(leagueId);
}