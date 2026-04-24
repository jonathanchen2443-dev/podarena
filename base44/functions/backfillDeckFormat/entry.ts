/**
 * backfillDeckFormat — Admin-only one-time migration.
 * Sets deck_format = "commander" on all Deck records that don't have it set yet.
 *
 * Invoke from dashboard: functions/backfillDeckFormat
 * Payload: {} (no params needed)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin gate
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Load all decks in batches of 200
    let offset = 0;
    const BATCH = 200;
    let totalFound = 0;
    let totalUpdated = 0;
    let errors = 0;

    while (true) {
      const batch = await base44.asServiceRole.entities.Deck.list('-created_date', BATCH);
      if (!batch || batch.length === 0) break;

      totalFound += batch.length;

      // Filter: only update decks that are missing deck_format
      const needsUpdate = batch.filter((d) => !d.deck_format);

      await Promise.all(
        needsUpdate.map((d) =>
          base44.asServiceRole.entities.Deck.update(d.id, { deck_format: 'commander' })
            .then(() => { totalUpdated++; })
            .catch((e) => { console.error('[backfillDeckFormat] update failed', d.id, e?.message); errors++; })
        )
      );

      // If we got fewer than BATCH, we've reached the end
      if (batch.length < BATCH) break;
      offset += BATCH;
    }

    console.log('[backfillDeckFormat] done', { totalFound, totalUpdated, errors });
    return Response.json({ success: true, totalFound, totalUpdated, errors });

  } catch (error) {
    console.error('[backfillDeckFormat] FAILED', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});