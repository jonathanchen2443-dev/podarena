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

async function _checkMembership(profileId, leagueId) {
  const m = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: profileId,
    status: "active",
  });
  return m.length > 0;
}