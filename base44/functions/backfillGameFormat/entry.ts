/**
 * backfillGameFormat — one-shot admin function to populate game_format = "commander"
 * on all Game records that currently have no game_format value.
 *
 * Safe to run multiple times (only updates records where game_format is null/missing).
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all games without game_format set
    const allGames = await base44.asServiceRole.entities.Game.list('-created_date', 1000);
    const toUpdate = allGames.filter((g) => !g.game_format);

    let updated = 0;
    let errors = 0;

    for (const game of toUpdate) {
      try {
        await base44.asServiceRole.entities.Game.update(game.id, { game_format: 'commander' });
        updated++;
      } catch (_) {
        errors++;
      }
    }

    return Response.json({
      success: true,
      total_found: allGames.length,
      needed_update: toUpdate.length,
      updated,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});