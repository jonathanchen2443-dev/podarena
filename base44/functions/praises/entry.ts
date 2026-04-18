/**
 * praises — dedicated backend function for the PRAISES feature.
 *
 * All praise creation, validation, visibility management, and aggregation.
 * Uses asServiceRole for all entity reads/writes (bypasses RLS).
 *
 * ACTIONS:
 *   savePraise              — upsert praise for a giver in a game
 *   activateGamePraises     — set is_visible=true when game becomes approved
 *   deactivateGamePraises   — set is_visible=false when game is rejected/hidden
 *   getGamePraises          — list visible praises for one approved game (gated to participants)
 *   getPlayerPraiseSummary  — count-by-type for a player's received praises (approved games only)
 *   getDeckPraiseSummary    — count-by-type for a deck's received praises (approved games only)
 *
 * BUSINESS RULES enforced here:
 * 1. One praise per giver per game (upsert by giver_user_id + game_id)
 * 2. No self-praise (giver_profile_id !== receiver_profile_id)
 * 3. Both giver and receiver must be participants in the same game
 * 4. praise_type must be one of 10 fixed values
 * 5. is_visible=false until parent game is fully approved and not hidden
 * 6. Aggregations only count is_visible=true rows
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const VALID_PRAISE_TYPES = ['on_fire', 'no_mercy', 'puppet_master', 'fortress', 'clutch', 'crowned_commander', 'should_have_been_you', 'troublemaker', 'phoenix', 'knockout'];

function _emptyPraiseSummary() {
  return { on_fire: 0, no_mercy: 0, puppet_master: 0, fortress: 0, clutch: 0, crowned_commander: 0, should_have_been_you: 0, troublemaker: 0, phoenix: 0, knockout: 0, total: 0 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Auth gate
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── savePraise ────────────────────────────────────────────────────────────
    // Upsert: create or replace the caller's praise for a specific game.
    // Enforces all business rules server-side.
    if (action === 'savePraise') {
      const { gameId, receiverProfileId, praiseType, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!gameId || !receiverProfileId || !praiseType || !callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'gameId, receiverProfileId, praiseType, callerAuthUserId, callerProfileId required' }, { status: 400 });
        }
        if (!VALID_PRAISE_TYPES.includes(praiseType)) {
          return Response.json({ error: `Invalid praise_type. Must be one of: ${VALID_PRAISE_TYPES.join(', ')}` }, { status: 400 });
        }

        // Gate: verify caller identity
        step = 'verify_identity';
        const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        // Gate: no self-praise
        step = 'check_self_praise';
        if (callerProfileId === receiverProfileId) {
          return Response.json({ error: 'Cannot give praise to yourself' }, { status: 400 });
        }

        // Gate: load game
        step = 'load_game';
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gameId });
        if (!gameArr.length) return Response.json({ error: 'Game not found' }, { status: 404 });
        const game = gameArr[0];
        if (game.is_hidden) return Response.json({ error: 'Cannot praise a hidden game' }, { status: 400 });

        // Gate: both giver and receiver must be participants
        step = 'validate_participants';
        const allParticipants = await base44.asServiceRole.entities.GameParticipant.filter({ game_id: gameId }, '-created_date', 20);

        const giverParticipant = allParticipants.find(
          (p) => p.participant_user_id === callerAuthUserId || p.participant_profile_id === callerProfileId
        );
        if (!giverParticipant) {
          return Response.json({ error: 'You are not a participant in this game' }, { status: 403 });
        }

        const receiverParticipant = allParticipants.find((p) => p.participant_profile_id === receiverProfileId);
        if (!receiverParticipant) {
          return Response.json({ error: 'Receiver is not a participant in this game' }, { status: 400 });
        }

        // Resolve receiver's auth user ID for storage
        const receiverProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: receiverProfileId });
        const receiverAuthUserId = receiverProfileRows[0]?.user_id || null;

        // Extract receiver deck context from GameParticipant snapshot (immutable history)
        const snap = receiverParticipant.deck_snapshot_json || {};
        const receiverDeckIdAtTime = receiverParticipant.selected_deck_id || null;
        const receiverDeckNameAtTime = receiverParticipant.deck_name_at_time || snap.name || snap.commander_name || null;
        const receiverCommanderNameAtTime = receiverParticipant.commander_name_at_time || snap.commander_name || null;

        // Visibility: only true when game is already approved + not hidden
        const isVisible = game.status === 'approved' && !game.is_hidden;
        const gameApprovedAt = isVisible ? (game.updated_date || new Date().toISOString()) : null;

        // Upsert: check for existing praise from this giver in this game
        step = 'check_existing_praise';
        const existing = await base44.asServiceRole.entities.Praise.filter({
          game_id: gameId,
          giver_user_id: callerAuthUserId,
        }).catch(() => []);

        let praise;
        if (existing.length > 0) {
          step = 'update_praise';
          praise = await base44.asServiceRole.entities.Praise.update(existing[0].id, {
            praise_type: praiseType,
            receiver_profile_id: receiverProfileId,
            receiver_user_id: receiverAuthUserId,
            receiver_deck_id_at_time: receiverDeckIdAtTime,
            receiver_deck_name_at_time: receiverDeckNameAtTime,
            receiver_commander_name_at_time: receiverCommanderNameAtTime,
            is_visible: isVisible,
            game_approved_at: gameApprovedAt,
          });
          console.log('[savePraise] updated', existing[0].id, 'game', gameId, 'by', callerProfileId);
        } else {
          step = 'create_praise';
          praise = await base44.asServiceRole.entities.Praise.create({
            game_id: gameId,
            giver_user_id: callerAuthUserId,
            giver_profile_id: callerProfileId,
            receiver_profile_id: receiverProfileId,
            receiver_user_id: receiverAuthUserId,
            praise_type: praiseType,
            receiver_deck_id_at_time: receiverDeckIdAtTime,
            receiver_deck_name_at_time: receiverDeckNameAtTime,
            receiver_commander_name_at_time: receiverCommanderNameAtTime,
            is_visible: isVisible,
            game_approved_at: gameApprovedAt,
          });
          console.log('[savePraise] created', praise?.id, 'game', gameId, 'by', callerProfileId);
        }

        return Response.json({ praise });
      } catch (err) {
        console.error('[savePraise] FAILED', { step, gameId, callerProfileId, error: err?.message });
        return Response.json({ error: err.message || 'savePraise failed' }, { status: 500 });
      }
    }

    // ── activateGamePraises ───────────────────────────────────────────────────
    // Called by the game approval flow when a game transitions to 'approved'.
    // Sets is_visible=true and stamps game_approved_at on all praise rows for that game.
    if (action === 'activateGamePraises') {
      const { gameId: activateGameId, approvedAt } = body;
      if (!activateGameId) return Response.json({ error: 'gameId required' }, { status: 400 });
      try {
        const praises = await base44.asServiceRole.entities.Praise.filter({ game_id: activateGameId }).catch(() => []);
        if (praises.length > 0) {
          await Promise.all(praises.map((p) =>
            base44.asServiceRole.entities.Praise.update(p.id, {
              is_visible: true,
              game_approved_at: approvedAt || new Date().toISOString(),
            }).catch(() => {})
          ));
          console.log('[activateGamePraises] activated', praises.length, 'praises for game', activateGameId);
        }
        return Response.json({ activated: praises.length });
      } catch (err) {
        console.error('[activateGamePraises] FAILED', { activateGameId, error: err?.message });
        return Response.json({ error: err.message || 'activateGamePraises failed' }, { status: 500 });
      }
    }

    // ── deactivateGamePraises ─────────────────────────────────────────────────
    // Called when a game is rejected or hidden. Praises remain in DB but is_visible=false.
    // Excluded from all live aggregation surfaces until re-activated (if ever).
    if (action === 'deactivateGamePraises') {
      const { gameId: deactivateGameId } = body;
      if (!deactivateGameId) return Response.json({ error: 'gameId required' }, { status: 400 });
      try {
        const praises = await base44.asServiceRole.entities.Praise.filter({ game_id: deactivateGameId }).catch(() => []);
        if (praises.length > 0) {
          await Promise.all(praises.map((p) =>
            base44.asServiceRole.entities.Praise.update(p.id, { is_visible: false }).catch(() => {})
          ));
          console.log('[deactivateGamePraises] deactivated', praises.length, 'for game', deactivateGameId);
        }
        return Response.json({ deactivated: praises.length });
      } catch (err) {
        console.error('[deactivateGamePraises] FAILED', { deactivateGameId, error: err?.message });
        return Response.json({ error: err.message || 'deactivateGamePraises failed' }, { status: 500 });
      }
    }

    // ── deleteGamePraises ─────────────────────────────────────────────────────
    // Called by founder hard-delete flow to permanently remove praise rows for a game.
    if (action === 'deleteGamePraises') {
      const { gameId: delGameId } = body;
      if (!delGameId) return Response.json({ error: 'gameId required' }, { status: 400 });
      try {
        const praises = await base44.asServiceRole.entities.Praise.filter({ game_id: delGameId }).catch(() => []);
        await Promise.all(praises.map((p) => base44.asServiceRole.entities.Praise.delete(p.id).catch(() => {})));
        console.log('[deleteGamePraises] deleted', praises.length, 'praises for game', delGameId);
        return Response.json({ deleted: praises.length });
      } catch (err) {
        console.error('[deleteGamePraises] FAILED', { delGameId, error: err?.message });
        return Response.json({ error: err.message || 'deleteGamePraises failed' }, { status: 500 });
      }
    }

    // ── getGamePraises ────────────────────────────────────────────────────────
    // Returns visible praises for one approved game.
    // Gate (two paths):
    //   1. Direct participant: callerAuthUserId has a GameParticipant row for this game.
    //   2. POD member viewer: game is a POD game, is approved, not hidden, and
    //      callerProfileId is an active member of that POD.
    // Returns [] for pending/rejected/hidden games or unauthorized callers.
    if (action === 'getGamePraises') {
      const { gameId: gpGameId, callerAuthUserId, callerProfileId } = body;
      if (!gpGameId || !callerAuthUserId) return Response.json({ praises: [] });
      try {
        // Load game to check status, hidden state, context, and pod_id
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: gpGameId }).catch(() => []);
        if (!gameArr.length) return Response.json({ praises: [] });
        const game = gameArr[0];

        // Gate: never expose praises for hidden or non-approved games
        if (game.is_hidden || game.status !== 'approved') return Response.json({ praises: [] });

        // Path 1: caller is a direct participant
        const participantRows = await base44.asServiceRole.entities.GameParticipant.filter({
          game_id: gpGameId, participant_user_id: callerAuthUserId,
        }).catch(() => []);

        let authorized = participantRows.length > 0;

        // Path 2: POD game — caller is an active member of the game's POD
        if (!authorized && game.context_type === 'pod' && game.pod_id && callerProfileId) {
          const podMembership = await base44.asServiceRole.entities.PODMembership.filter({
            pod_id: game.pod_id,
            profile_id: callerProfileId,
            membership_status: 'active',
          }).catch(() => []);
          authorized = podMembership.length > 0;
        }

        if (!authorized) return Response.json({ praises: [] });

        const praises = await base44.asServiceRole.entities.Praise.filter({
          game_id: gpGameId,
          is_visible: true,
        }, '-created_date', 50).catch(() => []);

        return Response.json({
          praises: praises.map((p) => ({
            id: p.id,
            giver_profile_id: p.giver_profile_id,
            receiver_profile_id: p.receiver_profile_id,
            praise_type: p.praise_type,
            receiver_deck_id_at_time: p.receiver_deck_id_at_time || null,
            receiver_deck_name_at_time: p.receiver_deck_name_at_time || null,
            receiver_commander_name_at_time: p.receiver_commander_name_at_time || null,
          })),
        });
      } catch (err) {
        console.error('[getGamePraises] FAILED', { gpGameId, error: err?.message });
        return Response.json({ praises: [] });
      }
    }

    // ── getPlayerPraiseSummary ────────────────────────────────────────────────
    // Count-by-type of praises received by a player.
    // Only counts is_visible=true rows (approved + not hidden games).
    // Public — any authenticated user can query any player's summary.
    if (action === 'getPlayerPraiseSummary') {
      const { receiverProfileId: summaryProfileId } = body;
      if (!summaryProfileId) return Response.json({ summary: _emptyPraiseSummary() });
      try {
        const praises = await base44.asServiceRole.entities.Praise.filter({
          receiver_profile_id: summaryProfileId,
          is_visible: true,
        }, '-created_date', 1000).catch(() => []);

        const summary = _emptyPraiseSummary();
        for (const p of praises) {
          if (p.praise_type && Object.prototype.hasOwnProperty.call(summary, p.praise_type)) {
            summary[p.praise_type] += 1;
            summary.total += 1;
          }
        }
        return Response.json({ summary });
      } catch (err) {
        console.error('[getPlayerPraiseSummary] FAILED', { summaryProfileId, error: err?.message });
        return Response.json({ summary: _emptyPraiseSummary() });
      }
    }

    // ── getDeckPraiseSummary ──────────────────────────────────────────────────
    // Count-by-type of praises for a specific deck (by receiver_deck_id_at_time).
    // Only counts is_visible=true rows (approved + not hidden games).
    if (action === 'getDeckPraiseSummary') {
      const { deckId: summaryDeckId } = body;
      if (!summaryDeckId) return Response.json({ summary: _emptyPraiseSummary() });
      try {
        const praises = await base44.asServiceRole.entities.Praise.filter({
          receiver_deck_id_at_time: summaryDeckId,
          is_visible: true,
        }, '-created_date', 1000).catch(() => []);

        const summary = _emptyPraiseSummary();
        for (const p of praises) {
          if (p.praise_type && Object.prototype.hasOwnProperty.call(summary, p.praise_type)) {
            summary[p.praise_type] += 1;
            summary.total += 1;
          }
        }
        return Response.json({ summary });
      } catch (err) {
        console.error('[getDeckPraiseSummary] FAILED', { summaryDeckId, error: err?.message });
        return Response.json({ summary: _emptyPraiseSummary() });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});