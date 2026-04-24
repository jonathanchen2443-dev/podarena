/**
 * Deck Link Validation Service
 *
 * Single source of truth for external deck-link validation.
 * Merges a hardcoded baseline (always safe) with founder-managed approved hosts
 * stored in AppSettings.approved_deck_link_hosts.
 *
 * Validation rules (never loosened):
 *  - https only
 *  - hostname must appear in approved list
 *  - unsafe schemes (javascript:, data:, etc.) are always rejected
 */
import { getSettings } from "@/components/services/appSettingsService";

/**
 * Hardcoded baseline — these are always approved regardless of AppSettings.
 * Only add here for well-known, established MTG decklist platforms.
 * New/experimental sources should go through the founder-managed list instead.
 */
export const BASELINE_DECK_LINK_HOSTS = [
  "moxfield.com",     "www.moxfield.com",
  "archidekt.com",    "www.archidekt.com",
  "edhrec.com",       "www.edhrec.com",
  "tappedout.net",    "www.tappedout.net",
  "deckstats.net",    "www.deckstats.net",
  "mtggoldfish.com",  "www.mtggoldfish.com",
  "aetherhub.com",    "www.aetherhub.com",
  "scryfall.com",     "www.scryfall.com",
  "cubecobra.com",    "www.cubecobra.com",
  "manabox.app",      "www.manabox.app",
];

/**
 * Returns the merged list of approved hostnames:
 * baseline (always on) + founder-managed enabled entries from AppSettings.
 * Safe to call from anywhere — falls back to baseline if settings unavailable.
 */
export async function getApprovedHosts() {
  try {
    const settings = await getSettings();
    const founderHosts = (settings?.approved_deck_link_hosts || [])
      .filter((entry) => entry.enabled !== false)
      .flatMap((entry) => {
        const h = entry.host?.trim().toLowerCase();
        if (!h) return [];
        // include both bare and www variant automatically
        return h.startsWith("www.") ? [h, h.slice(4)] : [h, `www.${h}`];
      });
    return [...new Set([...BASELINE_DECK_LINK_HOSTS, ...founderHosts])];
  } catch {
    return BASELINE_DECK_LINK_HOSTS;
  }
}

/**
 * Synchronous validator using a pre-fetched host list.
 * Use this when you already have the approved hosts (e.g. in the form).
 */
export function validateDeckLinkSync(url, approvedHosts) {
  if (!url || !url.trim()) return { valid: true };
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return { valid: false, error: "Must be a valid URL" }; }
  if (parsed.protocol !== "https:") return { valid: false, error: "Link must use https://" };
  if (!approvedHosts.includes(parsed.hostname)) {
    return { valid: false, error: "Link must point to a recognized site (Moxfield, Archidekt, ManaBox, EDHREC, MTGGoldfish, etc.)" };
  }
  return { valid: true };
}

/**
 * Async validator — fetches approved hosts then validates.
 * Use this in service/save paths where async is fine.
 */
export async function validateDeckLink(url) {
  const hosts = await getApprovedHosts();
  return validateDeckLinkSync(url, hosts);
}

/**
 * Extracts the hostname from a URL string, or returns null if invalid.
 * Used by the Founder UI test-URL feature.
 */
export function extractHost(url) {
  if (!url || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}