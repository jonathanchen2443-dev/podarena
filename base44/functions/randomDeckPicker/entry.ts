import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * randomDeckPicker — backend function for the Random Deck Picker feature.
 *
 * Eligibility rules (enforced server-side):
 *   - Only the authenticated caller's decks (owner_id === caller's Profile ID)
 *   - Only active decks (is_active === true)
 *   - Random selection is done here — UI receives a single ready-to-display deck
 *
 * Returns: { deck: object } on success, or { deck: null } if no eligible decks exist.
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

  // Fetch all eligible active decks owned by the caller
  const decks = await base44.asServiceRole.entities.Deck.filter(
    { owner_id: profileId, is_active: true },
    '-updated_date',
    200
  );

  if (!decks || decks.length === 0) {
    return Response.json({ deck: null });
  }

  // Select a random deck server-side
  const idx = Math.floor(Math.random() * decks.length);
  return Response.json({ deck: decks[idx] });
});