/**
 * Single source of truth for all app routes.
 * Use these constants everywhere instead of createPageUrl() + string concatenation.
 */

export const ROUTES = {
  HOME: "/home",
  LEAGUES: "/leagues-list",
  LOG_GAME: "/log-game",
  INBOX: "/inbox",
  PROFILE: "/profile",
  REGISTER: "/register",

  // Decks
  PROFILE_DECKS: "/profile-decks",
  PROFILE_DECK_NEW: "/profile-decks/new",
  PROFILE_DECK_EDIT: (id) => `/profile-decks/${id}/edit`,

  // League details
  LEAGUE_DETAILS: (id) => `/league-details/${id}`,
};