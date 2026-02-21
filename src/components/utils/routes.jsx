
import { createPageUrl } from "@/utils";

/**
 * Single source of truth for all app routes.
 * Uses createPageUrl() so paths always match Base44's router registration.
 * Sub-views (new/edit deck, league details) use query params to avoid
 * unregistered nested paths that cause 404s.
 */
export const ROUTES = {
  HOME: createPageUrl("Dashboard"),
  LEAGUES: createPageUrl("LeaguesList"),
  LOG_GAME: createPageUrl("LogGame"),
  INBOX: createPageUrl("Inbox"),
  PROFILE: createPageUrl("Profile"),
  REGISTER: createPageUrl("Register"),

  // Decks — all on the ProfileDecks page, mode via ?mode= query param
  PROFILE_DECKS: createPageUrl("ProfileDecks"),
  PROFILE_DECK_NEW: `${createPageUrl("ProfileDecks")}?mode=new`,
  PROFILE_DECK_EDIT: (id) => `${createPageUrl("ProfileDecks")}?mode=edit&deckId=${id}`,

  // League details — on the LeagueDetails page, id via ?leagueId= query param
  LEAGUE_DETAILS: (id) => `${createPageUrl("LeagueDetails")}?leagueId=${id}`,

  // Public user profile — read-only, id via ?userId= query param
  USER_PROFILE: (userId) => `${createPageUrl("UserProfile")}?userId=${userId}`,
};
