/**
 * AppSettings Service — single global row pattern.
 * Caches the settings row for 60s.
 */
import { base44 } from "@/api/base44Client";

export const DEFAULT_FEATURE_FLAGS = {
  enableCasualGames: true,
  enableDeckInsightsModal: true,
  requireDeckOnApprove: true,
  enableLeagueInvites: true,
  enableLeagueCapacity: true,
  enableInboxNotifications: true,
};

export const DEFAULT_NAV_CONFIG = [
  { key: "leagues",  label: "Leagues",  icon: "Users",      routeKey: "LEAGUES",  enabled: true },
  { key: "logGame",  label: "Log Game", icon: "PlusCircle", routeKey: "LOG_GAME", enabled: true },
  { key: "home",     label: "Home",     icon: "Home",       routeKey: "HOME",     enabled: true },
  { key: "inbox",    label: "Inbox",    icon: "Bell",       routeKey: "INBOX",    enabled: true },
  { key: "profile",  label: "Profile",  icon: "User",       routeKey: "PROFILE",  enabled: true },
];

let _cache = null;
let _cacheTs = 0;
let _inflight = null;
const CACHE_TTL = 60_000;

export async function getSettings() {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL) return _cache;
  if (_inflight) return _inflight;

  _inflight = base44.entities.AppSettings.filter({ singleton_key: "global" })
    .then((rows) => {
      const row = rows[0] || null;
      _cache = row;
      _cacheTs = Date.now();
      return row;
    })
    .finally(() => { _inflight = null; });

  return _inflight;
}

export function invalidateSettingsCache() {
  _cache = null;
  _cacheTs = 0;
}

export async function upsertSettings(partial) {
  const existing = await getSettings();
  let updated;
  if (existing) {
    updated = await base44.entities.AppSettings.update(existing.id, partial);
  } else {
    updated = await base44.entities.AppSettings.create({
      singleton_key: "global",
      founder_user_ids: [],
      bottom_nav_config: DEFAULT_NAV_CONFIG,
      feature_flags: DEFAULT_FEATURE_FLAGS,
      ...partial,
    });
  }
  _cache = updated;
  _cacheTs = Date.now();
  return updated;
}

/**
 * Called on app boot: if no settings row exists, create one with the
 * current user as the first founder. Safe to call multiple times.
 */
export async function ensureSettings(auth) {
  if (auth.isGuest || !auth.currentUser) return null;
  const existing = await getSettings();
  if (existing) return existing;

  const created = await base44.entities.AppSettings.create({
    singleton_key: "global",
    founder_user_ids: [auth.currentUser.id],
    bottom_nav_config: DEFAULT_NAV_CONFIG,
    feature_flags: DEFAULT_FEATURE_FLAGS,
  });
  _cache = created;
  _cacheTs = Date.now();
  return created;
}

export async function getFeatureFlags() {
  const s = await getSettings();
  return { ...DEFAULT_FEATURE_FLAGS, ...(s?.feature_flags || {}) };
}