/**
 * deckSave — backend-enforced deck create/update with allowlist validation.
 *
 * Enforces:
 *  - https only for external_deck_link
 *  - hostname must be in baseline or founder-managed approved list
 *  - unsafe schemes (javascript:, data:, etc.) always rejected
 *
 * Actions:
 *   createDeck — create a new Deck for the authenticated user
 *   updateDeck — update an existing Deck the caller owns
 *
 * Input (createDeck):  { action, name, commander_name, commander_image_url, color_identity, is_active, deck_format, external_deck_link, is_favorite }
 * Input (updateDeck):  { action, deckId, name, commander_name, commander_image_url, color_identity, is_active, deck_format, external_deck_link, is_favorite }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Baseline approved deck-link hosts (mirrors deckLinkService.jsx) ───────────
// Always approved — never read from DB for this list.
// Founder-managed extras come from AppSettings.approved_deck_link_hosts.
const BASELINE_DECK_LINK_HOSTS = [
  'moxfield.com',     'www.moxfield.com',
  'archidekt.com',    'www.archidekt.com',
  'edhrec.com',       'www.edhrec.com',
  'tappedout.net',    'www.tappedout.net',
  'deckstats.net',    'www.deckstats.net',
  'mtggoldfish.com',  'www.mtggoldfish.com',
  'aetherhub.com',    'www.aetherhub.com',
  'scryfall.com',     'www.scryfall.com',
  'cubecobra.com',    'www.cubecobra.com',
  'manabox.app',      'www.manabox.app',
];

/**
 * Build the merged approved host list: baseline + founder-managed enabled entries.
 */
async function getApprovedHosts(base44) {
  try {
    const rows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
    const settings = rows[0] || null;
    const founderEntries = settings?.approved_deck_link_hosts || [];
    const founderHosts = founderEntries
      .filter((e) => e.enabled !== false)
      .flatMap((e) => {
        const h = (e.host || '').trim().toLowerCase();
        if (!h) return [];
        return h.startsWith('www.') ? [h, h.slice(4)] : [h, `www.${h}`];
      });
    return [...new Set([...BASELINE_DECK_LINK_HOSTS, ...founderHosts])];
  } catch {
    return BASELINE_DECK_LINK_HOSTS;
  }
}

/**
 * Validate external_deck_link against the approved host list.
 * Returns { valid: true } or { valid: false, error: string }.
 */
function validateDeckLink(url, approvedHosts) {
  if (!url || !url.trim()) return { valid: true };
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Must be a valid URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Link must use https://' };
  }
  if (!approvedHosts.includes(parsed.hostname)) {
    return { valid: false, error: 'Link must point to a recognized site (Moxfield, Archidekt, ManaBox, EDHREC, MTGGoldfish, etc.)' };
  }
  return { valid: true };
}

/**
 * Sanitize and validate deck payload fields.
 * Throws if external_deck_link is invalid.
 */
async function sanitizePayload(body, approvedHosts) {
  const link = body.external_deck_link?.trim() || null;
  if (link) {
    const check = validateDeckLink(link, approvedHosts);
    if (!check.valid) throw new Error(`Invalid deck link: ${check.error}`);
  }
  return {
    name: (body.name || '').trim(),
    commander_name: (body.commander_name || '').trim(),
    commander_image_url: (body.commander_image_url || '').trim(),
    commander_full_card_image_url: (body.commander_full_card_image_url || '').trim(),
    commander_scryfall_id: (body.commander_scryfall_id || '').trim(),
    color_identity: Array.isArray(body.color_identity) ? body.color_identity : [],
    is_active: body.is_active !== undefined ? !!body.is_active : true,
    deck_format: body.deck_format || 'commander',
    external_deck_link: link,
    is_favorite: body.is_favorite !== undefined ? !!body.is_favorite : false,
    show_deck_list_publicly: body.show_deck_list_publicly !== undefined ? !!body.show_deck_list_publicly : false,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let step = 'init';
  try {
    const base44 = createClientFromRequest(req);

    // Auth gate
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Resolve caller identity
    step = 'resolve_identity';
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find caller's profile (needed for owner_id)
    step = 'load_profile';
    const profileRows = await base44.asServiceRole.entities.Profile.filter({ user_id: me.id });
    const profile = profileRows[0] || null;
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // Build approved host list (shared for all actions in this request)
    step = 'load_approved_hosts';
    const approvedHosts = await getApprovedHosts(base44);

    // ── createDeck ─────────────────────────────────────────────────────────────
    if (action === 'createDeck') {
      step = 'sanitize_payload';
      const safe = await sanitizePayload(body, approvedHosts);

      step = 'create_deck';
      const deck = await base44.entities.Deck.create({
        owner_id: profile.id,
        ...safe,
      });

      console.log('[deckSave] createDeck success deckId=', deck.id, 'callerProfileId=', profile.id);
      return Response.json({ deck });
    }

    // ── updateDeck ─────────────────────────────────────────────────────────────
    if (action === 'updateDeck') {
      const { deckId } = body;
      if (!deckId) return Response.json({ error: 'deckId required' }, { status: 400 });

      // Ownership gate
      step = 'verify_ownership';
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      const deck = deckRows[0] || null;
      if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });
      if (deck.owner_id !== profile.id) {
        return Response.json({ error: 'Forbidden: you do not own this deck' }, { status: 403 });
      }

      step = 'sanitize_payload';
      const safe = await sanitizePayload(body, approvedHosts);

      step = 'update_deck';
      const updated = await base44.entities.Deck.update(deckId, safe);

      console.log('[deckSave] updateDeck success deckId=', deckId, 'callerProfileId=', profile.id);
      return Response.json({ deck: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('[deckSave] FAILED', { step, error: err?.message });
    return Response.json({ error: err.message || 'deckSave failed' }, { status: 500 });
  }
});