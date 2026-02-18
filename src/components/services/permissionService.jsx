/**
 * Permission Service - Centralized access control helpers.
 *
 * Guest Mode: read-only access to public leagues and approved games.
 * Registered: full access per rules (own decks, league membership, game participation).
 */
import { base44 } from "@/api/base44Client";

/** Check if the current session is authenticated. */
export async function isAuthenticated() {
  return base44.auth.isAuthenticated();
}

/** Get all active league memberships for a user. */
export async function getUserMemberships(profileId) {
  if (!profileId) return [];
  return base44.entities.LeagueMember.filter({ user_id: profileId, status: "active" });
}

/** Check if a user is an active member of a specific league. */
export async function isMemberOfLeague(leagueId, profileId) {
  if (!profileId) return false;
  const members = await base44.entities.LeagueMember.filter({
    league_id: leagueId,
    user_id: profileId,
    status: "active",
  });
  return members.length > 0;
}

/** Check if user is a participant of a game. */
export async function isGameParticipant(gameId, profileId) {
  if (!profileId) return false;
  const participants = await base44.entities.GameParticipant.filter({
    game_id: gameId,
    user_id: profileId,
  });
  return participants.length > 0;
}

/** Filter games based on user permissions. */
export function filterGamesForUser(games, leagues, { profileId, memberships, isGuest }) {
  const memberLeagueIds = new Set((memberships || []).map((m) => m.league_id));
  const publicLeagueIds = new Set(leagues.filter((l) => l.is_public).map((l) => l.id));

  return games.filter((game) => {
    if (isGuest) {
      return publicLeagueIds.has(game.league_id) && game.status === "approved";
    }
    if (memberLeagueIds.has(game.league_id)) return true;
    if (publicLeagueIds.has(game.league_id) && game.status === "approved") return true;
    return false;
  });
}

/** Can the user modify a deck? (owner only) */
export function canModifyDeck(deck, profileId) {
  return !!profileId && deck.owner_id === profileId;
}

/** Can the user modify league settings? (admin or creator) */
export function canModifyLeague(league, profileId, memberships) {
  if (league.created_by === profileId) return true;
  const membership = memberships?.find(
    (m) => m.league_id === league.id && m.user_id === profileId
  );
  return membership?.role === "admin";
}

// ─── New helpers for gating ──────────────────────────────────────────────────

/** Can this user create a new deck? Requires auth. */
export function canCreateDeck({ isGuest }) {
  return !isGuest;
}

/** Can this user edit/delete a specific deck? Requires auth + ownership. */
export function canEditDeck({ isGuest, currentUser }, deckOwnerId) {
  if (isGuest || !currentUser) return false;
  return currentUser.id === deckOwnerId;
}

/** Can this user log a game in a league? Requires auth + membership (checked async). */
export function canLogGame({ isGuest }) {
  return !isGuest;
}

/** Can this user approve/reject a game? Requires auth. */
export function canApproveGame({ isGuest }) {
  return !isGuest;
}

/** Can this user view a league? Public leagues visible to all; private requires membership. */
export function canViewLeague(league, { isGuest, memberships }) {
  if (league.is_public) return true;
  if (isGuest) return false;
  return (memberships || []).some((m) => m.league_id === league.id);
}

/** Can this user view a specific game? */
export function canViewGame(game, league, { isGuest, memberships }) {
  if (isGuest) {
    return league.is_public && game.status === "approved";
  }
  const isMember = (memberships || []).some((m) => m.league_id === league.id);
  if (isMember) return true;
  return league.is_public && game.status === "approved";
}