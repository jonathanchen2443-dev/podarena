import { createPageUrl } from "@/utils";

/**
 * Single source of truth for all app routes.
 * Uses createPageUrl() so paths always match Base44's router registration.
 * Sub-views (new/edit deck, league details) use query params to avoid
 * unregistered nested paths that cause 404s.
 *
 * PODS MIGRATION (Phase 1):
 * League routes are preserved below for reference but all active entry
 * points now redirect to PODS. Do not use LEAGUES/LEAGUE_DETAILS/CREATE_LEAGUE
 * in new UI code — use PODS instead.
 */
export const ROUTES = {
  HOME: createPageUrl("Dashboard"),
  DASHBOARD: createPageUrl("Dashboard"),
  LANDING: createPageUrl("Landing"),
  // PODS — main landing redirects to MyPods
  PODS: createPageUrl("MyPods"),
  MY_PODS: createPageUrl("MyPods"),
  ALL_PODS: createPageUrl("AllPods"),
  EXPLORE_PODS: createPageUrl("ExplorePods"),
  POD: (podId) => `${createPageUrl("Pod")}?podId=${podId}`,
  EDIT_POD: (podId) => `${createPageUrl("EditPod")}?podId=${podId}`,
  CREATE_POD: createPageUrl("CreatePod"),
  LOG_GAME: createPageUrl("LogGame"),
  INBOX: createPageUrl("Inbox"),
  PROFILE: createPageUrl("Profile"),
  REGISTER: createPageUrl("Register"),

  // Decks — all on the ProfileDecks page, mode via ?mode= query param
  PROFILE_DECKS: createPageUrl("ProfileDecks"),
  PROFILE_DECK_NEW: `${createPageUrl("ProfileDecks")}?mode=new`,
  PROFILE_DECK_EDIT: (id) => `${createPageUrl("ProfileDecks")}?mode=edit&deckId=${id}`,



  // Public user profile — read-only, id via ?userId= query param
  USER_PROFILE: (userId) => `${createPageUrl("UserProfile")}?userId=${userId}`,

  // Praises — full collection screen; own profile or public (?userId=profileId)
  PRAISES: createPageUrl("Praises"),
  PRAISES_FOR: (userId) => `${createPageUrl("Praises")}?userId=${userId}`,

  // Random Deck Picker
  RANDOM_DECK_PICKER: createPageUrl("RandomDeckPicker"),
};