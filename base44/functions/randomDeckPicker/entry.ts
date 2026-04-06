import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * randomDeckPicker — backend function for the Random Deck Picker feature.
 *
 * Modes (controlled by request body):
 *
 *   { mode: "count" }
 *     Returns { count: number } — number of eligible active decks for the caller.
 *     Used by the UI on page load to detect the no-decks state before any pick attempt.
 *
 *   { mode: "pick", excludeId?: string }
 *     Default mode. Returns { deck: object | null }.
 *     If excludeId is provided, that deck is excluded from selection (supports the
 *     client-side "no 3 in a row" consecutive-repeat guard).
 *
 * Eligibility rules (enforced server-side):
 *   - Only the authenticated caller's decks (owner_id === caller's Profile ID)
 *   - Only active decks (is_active === true)
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve caller's Profile entity ID
  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  if (!profiles || profiles.length === 0) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }
  const profileId = profiles[0].id;

  // Parse request body
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const mode = body.mode || 'pick';

  // Fetch all eligible active decks owned by the caller
  const decks = await base44.asServiceRole.entities.Deck.filter(
    { owner_id: profileId, is_active: true },
    '-updated_date',
    200
  );
  const eligible = decks || [];

  // ── count mode ──────────────────────────────────────────────────────────────
  if (mode === 'count') {
    return Response.json({ count: eligible.length });
  }

  // ── pick mode (default) ─────────────────────────────────────────────────────
  if (eligible.length === 0) {
    return Response.json({ deck: null });
  }

  // Apply optional exclusion (consecutive-repeat guard driven by the client)
  const excludeId = body.excludeId || null;
  let pool = eligible;
  if (excludeId && eligible.length > 1) {
    const filtered = eligible.filter((d) => d.id !== excludeId);
    if (filtered.length > 0) pool = filtered;
  }

  const idx = Math.floor(Math.random() * pool.length);
  return Response.json({ deck: pool[idx] });
});