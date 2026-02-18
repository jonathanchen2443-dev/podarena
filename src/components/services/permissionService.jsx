/**
 * Permission Service - Centralized access control helpers.
 *
 * Guest Mode: read-only access to public leagues and approved games.
 * Registered: full access per rules (own decks, league membership, game participation).
 */
import { base44 } from "@/api/base44Client";

/**
 * Check if the current user is authenticated.
 */
export async function isAuthenticated() {
  return base44.auth.isAuthenticated();
}

/**
 * Get all league memberships for a user.
 */
export async function getUserMemberships(profileId) {
  if (!profileId) return [];
  return base44.entities.LeagueMember.filter({
    user_id: profileId,
    status: "active",
  });
}

/**
 * Check if a user is a member of a specific league.
 */
export async function isMemberOfLeague(leagueId, profileId) {
  if (!profileId) return false;
  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: profileId,
    status: "active",
  });
  return members.length > 0;
}

/**
 * Check if user is a participant of a game.
 */
export async function isGameParticipant(gameId, profileId) {
  if (!profileId) return false;
  const participants = await base44.entities.GameParticipant.filter({
    game_id: gameId,
    user_id: profileId,
  });
  return participants.length > 0;
}

/**
 * Filter games based on user permissions.
 * Guests: only approved games from public leagues.
 * Members: all games in their leagues.
 */
export function filterGamesForUser(games, leagues, { profileId, memberships, isGuest }) {
  const memberLeagueIds = new Set((memberships || []).map((m) => m.league_id));
  const publicLeagueIds = new Set(leagues.filter((l) => l.is_public).map((l) => l.id));

  return games.filter((game) => {
    if (isGuest) {
      return publicLeagueIds.has(game.league_id) && game.status === "approved";
    }
    // Registered user: can see all games in leagues they belong to
    if (memberLeagueIds.has(game.league_id)) return true;
    // Can also see approved games from public leagues
    if (publicLeagueIds.has(game.league_id) && game.status === "approved") return true;
    return false;
  });
}

/**
 * Can the user modify a deck?
 */
export function canModifyDeck(deck, profileId) {
  return deck.owner_id === profileId;
}

/**
 * Can the user modify league settings?
 */
export function canModifyLeague(league, profileId, memberships) {
  if (league.created_by === profileId) return true;
  const membership = memberships?.find(
    (m) => m.league_id === league.id && m.user_id === profileId
  );
  return membership?.role === "admin";
}