/**
 * deckLinkValidator — validates external decklist links.
 * Only allows https links pointing to recognized decklist platforms.
 */

const ALLOWED_HOSTS = [
  "moxfield.com",
  "www.moxfield.com",
  "archidekt.com",
  "www.archidekt.com",
  "edhrec.com",
  "www.edhrec.com",
  "tappedout.net",
  "www.tappedout.net",
  "deckstats.net",
  "www.deckstats.net",
  "mtggoldfish.com",
  "www.mtggoldfish.com",
  "aetherhub.com",
  "www.aetherhub.com",
  "scryfall.com",
  "www.scryfall.com",
  "cubecobra.com",
  "www.cubecobra.com",
  "cardhoarder.com",
  "www.cardhoarder.com",
  "manastack.com",
  "www.manastack.com",
  "pennydreadfulmagic.com",
  "www.pennydreadfulmagic.com",
];

/**
 * Validates an external deck link.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateExternalDeckLink(url) {
  if (!url || !url.trim()) return { valid: true }; // empty is allowed (optional field)

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, error: "Must be a valid URL (e.g. https://moxfield.com/...)" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Link must use https://" };
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return {
      valid: false,
      error: "Link must point to a recognized site (Moxfield, Archidekt, EDHREC, MTGGoldfish, etc.)",
    };
  }

  return { valid: true };
}