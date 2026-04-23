/**
 * founderGameActions — Founder-only game management backend.
 *
 * Actions:
 *   founderListGames      — search/filter games (all states, including hidden)
 *   founderHideGame       — soft-hide a game from all normal surfaces
 *   founderRestoreGame    — restore a previously hidden game
 *   founderHardDeleteGame — permanently delete a game and all its live records
 *
 * All actions enforce the Founder gate: caller must be listed in AppSettings.founder_user_ids.
 * All entity reads/writes use asServiceRole (bypasses RLS).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Founder gate helper ───────────────────────────────────────────────────────

async function verifyFounder(base44, callerProfileId, callerAuthUserId) {
  const settingsRows = await base44.asServiceRole.entities.AppSettings.filter({ singleton_key: 'global' });
  const founderIds = settingsRows[0]?.founder_user_ids || [];
  const callerProfileRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
  if (!callerProfileRows.length || callerProfileRows[0].user_id !== callerAuthUserId) {
    return { ok: false, reason: 'Forbidden: identity mismatch' };
  }
  if (!founderIds.includes(callerProfileRows[0].id)) {
    return { ok: false, reason: 'Forbidden: Founder only' };
  }
  return { ok: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Auth gate
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── founderListGames ──────────────────────────────────────────────────────
    if (action === 'founderListGames') {
      const { callerProfileId, callerAuthUserId, gameId: searchGameId, participantProfileId, dateFrom, dateTo, includeHidden } = body;
      if (!callerProfileId || !callerAuthUserId) return Response.json({ error: 'callerProfileId and callerAuthUserId required' }, { status: 400 });

      const gate = await verifyFounder(base44, callerProfileId, callerAuthUserId);
      if (!gate.ok) return Response.json({ error: gate.reason }, { status: 403 });

      // If participant filter provided, resolve game IDs via GameParticipant first
      let participantGameIds = null;
      if (participantProfileId) {
        const participantRows = await base44.asServiceRole.entities.GameParticipant.filter(
          { participant_profile_id: participantProfileId }, '-created_date', 200
        );
        participantGameIds = [...new Set(participantRows.map((p) => p.game_id).filter(Boolean))];
        if (participantGameIds.length === 0) return Response.json({ games: [] });
      }

      const filter = {};
      if (searchGameId) filter.id = { $regex: searchGameId.trim() };
      if (participantGameIds) filter.id = { $in: participantGameIds };
      if (dateFrom) filter.played_at = { ...(filter.played_at || {}), $gte: new Date(dateFrom).toISOString() };
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.played_at = { ...(filter.played_at || {}), $lte: endOfDay.toISOString() };
      }

      const rawGames = await base44.asServiceRole.entities.Game.filter(filter, '-played_at', 100);
      const visibleGames = includeHidden ? rawGames : rawGames.filter((g) => !g.is_hidden);
      if (visibleGames.length === 0) return Response.json({ games: [] });

      const gameIds = visibleGames.map((g) => g.id);
      const participantArrays = await Promise.all(
        gameIds.map((gid) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: gid }, '-created_date', 20).catch(() => [])
        )
      );

      const allProfileIds = [...new Set(participantArrays.flat().map((p) => p.participant_profile_id).filter(Boolean))];
      let profileMap = {};
      if (allProfileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter({ id: { $in: allProfileIds } }, '-created_date', 200);
        profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name || 'Unknown']));
      }

      const podIdsNeeded = [...new Set(rawGames.map((g) => g.pod_id).filter(Boolean))];
      let podNameMap = {};
      if (podIdsNeeded.length > 0) {
        const pods = await base44.asServiceRole.entities.POD.filter({ id: { $in: podIdsNeeded } }, '-created_date', 50);
        podNameMap = Object.fromEntries(pods.map((p) => [p.id, p.pod_name]));
      }

      const games = visibleGames.map((g, i) => {
        const parts = participantArrays[i] || [];
        return {
          id: g.id,
          status: g.status,
          context_type: g.context_type || 'casual',
          pod_id: g.pod_id || null,
          pod_name: g.pod_id ? (podNameMap[g.pod_id] || null) : null,
          played_at: g.played_at || g.created_date || null,
          created_date: g.created_date || null,
          notes: g.notes || '',
          is_hidden: g.is_hidden || false,
          hidden_at: g.hidden_at || null,
          participant_count: parts.length,
          participant_names: parts.map((p) => profileMap[p.participant_profile_id] || '?').join(', '),
        };
      });

      return Response.json({ games });
    }

    // ── founderHideGame ───────────────────────────────────────────────────────
    if (action === 'founderHideGame') {
      const { callerProfileId, callerAuthUserId, gameId: hideGameId } = body;
      if (!callerProfileId || !callerAuthUserId || !hideGameId) return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });

      const gate = await verifyFounder(base44, callerProfileId, callerAuthUserId);
      if (!gate.ok) return Response.json({ error: gate.reason }, { status: 403 });

      await base44.asServiceRole.entities.Game.update(hideGameId, {
        is_hidden: true,
        hidden_at: new Date().toISOString(),
        hidden_by_profile_id: callerProfileId,
      });
      console.log('[founderHideGame] hidden', hideGameId, 'by', callerProfileId);
      return Response.json({ success: true });
    }

    // ── founderRestoreGame ────────────────────────────────────────────────────
    if (action === 'founderRestoreGame') {
      const { callerProfileId, callerAuthUserId, gameId: restoreGameId } = body;
      if (!callerProfileId || !callerAuthUserId || !restoreGameId) return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });

      const gate = await verifyFounder(base44, callerProfileId, callerAuthUserId);
      if (!gate.ok) return Response.json({ error: gate.reason }, { status: 403 });

      await base44.asServiceRole.entities.Game.update(restoreGameId, {
        is_hidden: false,
        hidden_at: null,
        hidden_by_profile_id: null,
      });
      console.log('[founderRestoreGame] restored', restoreGameId, 'by', callerProfileId);
      return Response.json({ success: true });
    }

    // ── founderHardDeleteGame ─────────────────────────────────────────────────
    //
    // SAFETY DESIGN — no DB transactions available, so we use pseudo-transactional ordering.
    //
    // Delete order (safest for user-facing integrity):
    //   1. Notifications  — inbox/pending surfaces; removed first so inbox stops showing it
    //   2. GameApproval   — deprecated entity; no live user surface reads it
    //   3. GameParticipant — SOURCE OF TRUTH for all stats, history, leaderboard, inbox counts.
    //                        Once gone, the game is invisible on ALL user-facing surfaces.
    //   4. Game           — parent record; deleted last so all child records are gone first.
    //
    // If step 4 (Game delete) fails after steps 1-3 succeeded:
    //   The Game row becomes an orphan with no participants — invisible on all user surfaces.
    //   The Founder console can still find and retry deleting it via this same action.
    //
    // After all deletes, a post-delete verification confirms records are truly gone.
    // Only then is success: true returned to the caller.
    if (action === 'founderHardDeleteGame') {
      const { callerProfileId, callerAuthUserId, gameId: delGameId } = body;

      const deleted = [];  // entity types successfully deleted so far

      try {
        if (!callerProfileId || !callerAuthUserId || !delGameId) {
          return Response.json({ error: 'callerProfileId, callerAuthUserId, gameId required' }, { status: 400 });
        }

        const gate = await verifyFounder(base44, callerProfileId, callerAuthUserId);
        if (!gate.ok) return Response.json({ error: gate.reason }, { status: 403 });

        // Verify game exists
        const gameRows = await base44.asServiceRole.entities.Game.filter({ id: delGameId });
        if (!gameRows.length) return Response.json({ error: 'Game not found' }, { status: 404 });

        // Pre-load all dependent records before any deletes
        // This ensures we know the full scope upfront and can report what remains on failure.
        const [participants, approvals, allNotifs, praises] = await Promise.all([
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.GameApproval.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.Notification.filter({ type: 'game_review_request' }, '-created_date', 500).catch(() => []),
          base44.asServiceRole.entities.Praise.filter({ game_id: delGameId }).catch(() => []),
        ]);
        const gameNotifs = allNotifs.filter((n) => n.metadata?.game_id === delGameId);
        const participantIds = participants.map((p) => p.id);
        const approvalIds = approvals.map((a) => a.id);
        const notifIds = gameNotifs.map((n) => n.id);
        const praiseIds = praises.map((p) => p.id);

        console.log('[founderHardDeleteGame] scope', {
          gameId: delGameId, participants: participantIds.length,
          approvals: approvalIds.length, notifications: notifIds.length, praises: praiseIds.length,
        });

        // Step 1: Notifications — stop inbox from showing this game immediately
        if (notifIds.length > 0) {
          const results = await Promise.allSettled(notifIds.map((id) => base44.asServiceRole.entities.Notification.delete(id)));
          const failed = notifIds.filter((_, i) => results[i].status === 'rejected');
          if (failed.length > 0) {
            const errMsg = results.find((r) => r.status === 'rejected')?.reason?.message || 'Unknown';
            console.error('[founderHardDeleteGame] FAILED at delete_notifications', { failedCount: failed.length, error: errMsg });
            return Response.json({
              success: false, partial: false, failed_step: 'delete_notifications',
              error: `Failed to delete ${failed.length} notification(s): ${errMsg}`,
              deleted_entities: deleted,
              remaining_entities: ['notifications', 'game_approvals', 'praises', 'game_participants', 'game'],
              game_id: delGameId,
              message: 'No records were deleted. The game is still fully intact. Safe to retry.',
            }, { status: 500 });
          }
        }
        deleted.push('notifications');
        console.log('[founderHardDeleteGame] step=delete_notifications count=', notifIds.length);

        // Step 2: GameApproval — deprecated, no live surface reads it
        if (approvalIds.length > 0) {
          const results = await Promise.allSettled(approvalIds.map((id) => base44.asServiceRole.entities.GameApproval.delete(id)));
          const failed = approvalIds.filter((_, i) => results[i].status === 'rejected');
          if (failed.length > 0) {
            const errMsg = results.find((r) => r.status === 'rejected')?.reason?.message || 'Unknown';
            console.error('[founderHardDeleteGame] FAILED at delete_approvals', { failedCount: failed.length, error: errMsg });
            return Response.json({
              success: false, partial: true, failed_step: 'delete_approvals',
              error: `Failed to delete ${failed.length} approval record(s): ${errMsg}`,
              deleted_entities: deleted,
              remaining_entities: ['game_approvals', 'praises', 'game_participants', 'game'],
              game_id: delGameId,
              message: 'Partial delete: notifications removed but approvals, praises, participants, and game remain. Game still visible. Retry is safe.',
            }, { status: 500 });
          }
        }
        deleted.push('game_approvals');
        console.log('[founderHardDeleteGame] step=delete_approvals count=', approvalIds.length);

        // Step 2.5: Praises — permanently delete all praise rows for this game
        if (praiseIds.length > 0) {
          const results = await Promise.allSettled(praiseIds.map((id) => base44.asServiceRole.entities.Praise.delete(id)));
          const failed = praiseIds.filter((_, i) => results[i].status === 'rejected');
          if (failed.length > 0) {
            const errMsg = results.find((r) => r.status === 'rejected')?.reason?.message || 'Unknown';
            console.error('[founderHardDeleteGame] FAILED at delete_praises', { failedCount: failed.length, error: errMsg });
            return Response.json({
              success: false, partial: true, failed_step: 'delete_praises',
              error: `Failed to delete ${failed.length} praise row(s): ${errMsg}`,
              deleted_entities: deleted,
              remaining_entities: ['praises', 'game_participants', 'game'],
              game_id: delGameId,
              message: 'Partial delete: notifications and approvals removed but praises, participants, and game remain. Retry is safe.',
            }, { status: 500 });
          }
        }
        deleted.push('praises');
        console.log('[founderHardDeleteGame] step=delete_praises count=', praiseIds.length);

        // Step 3: GameParticipant — CRITICAL: drives all stats, leaderboard, history, inbox
        // After this step the game is invisible on all user-facing surfaces.
        if (participantIds.length > 0) {
          const results = await Promise.allSettled(participantIds.map((id) => base44.asServiceRole.entities.GameParticipant.delete(id)));
          const failed = participantIds.filter((_, i) => results[i].status === 'rejected');
          if (failed.length > 0) {
            const errMsg = results.find((r) => r.status === 'rejected')?.reason?.message || 'Unknown';
            console.error('[founderHardDeleteGame] FAILED at delete_participants', { failedCount: failed.length, error: errMsg });
            return Response.json({
              success: false, partial: true, failed_step: 'delete_participants',
              error: `Failed to delete ${failed.length} participant row(s): ${errMsg}`,
              deleted_entities: deleted,
              remaining_entities: ['game_participants', 'game'],
              game_id: delGameId,
              message: 'Partial delete: praises deleted, but some participant rows and the game record remain. Game may still affect stats. Retry is safe.',
            }, { status: 500 });
          }
        }
        deleted.push('game_participants');
        console.log('[founderHardDeleteGame] step=delete_participants count=', participantIds.length);

        // Step 4: Game record — last step; if this fails, the Game is a participant-less orphan
        // that cannot affect any user-facing surface. Retry will finish cleanup.
        try {
          await base44.asServiceRole.entities.Game.delete(delGameId);
        } catch (gameDeleteErr) {
          console.error('[founderHardDeleteGame] FAILED at delete_game', { gameId: delGameId, error: gameDeleteErr?.message });
          return Response.json({
            success: false, partial: true, failed_step: 'delete_game',
            error: `All participant data deleted but the Game record itself could not be deleted: ${gameDeleteErr?.message || 'Unknown'}`,
            deleted_entities: deleted,
            remaining_entities: ['game'],
            game_id: delGameId,
            message: 'Near-complete delete: all participant data is gone (game is invisible on all user surfaces) but the Game row itself remains. Retry to finish cleanup.',
          }, { status: 500 });
        }
        deleted.push('game');
        console.log('[founderHardDeleteGame] step=delete_game gameId=', delGameId, 'by founder=', callerProfileId);

        // Post-delete verification: confirm all targeted records are truly gone
        const [verifyGame, verifyParticipants, verifyApprovals, verifyPraises] = await Promise.all([
          base44.asServiceRole.entities.Game.filter({ id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.GameApproval.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.Praise.filter({ game_id: delGameId }).catch(() => []),
        ]);
        const verificationFailures = [];
        if (verifyGame.length > 0)        verificationFailures.push('game');
        if (verifyParticipants.length > 0) verificationFailures.push('game_participants');
        if (verifyApprovals.length > 0)    verificationFailures.push('game_approvals');
        if (verifyPraises.length > 0)      verificationFailures.push('praises');

        if (verificationFailures.length > 0) {
          console.error('[founderHardDeleteGame] POST-DELETE VERIFICATION FAILED', { gameId: delGameId, stillPresent: verificationFailures });
          return Response.json({
            success: false, partial: true, failed_step: 'post_delete_verification',
            error: `Delete operations completed but verification found remaining records: ${verificationFailures.join(', ')}`,
            deleted_entities: deleted,
            remaining_entities: verificationFailures,
            game_id: delGameId,
            message: 'Verification failed: some records may still exist. Manual inspection recommended.',
          }, { status: 500 });
        }

        console.log('[founderHardDeleteGame] SUCCESS — all records verified gone. gameId=', delGameId);
        return Response.json({ success: true, game_id: delGameId, deleted_entities: deleted });

      } catch (err) {
        console.error('[founderHardDeleteGame] UNEXPECTED ERROR', { delGameId, callerProfileId, error: err?.message });
        return Response.json({
          success: false,
          partial: deleted.length > 0,
          failed_step: 'unexpected',
          error: err.message || 'Hard delete failed unexpectedly',
          deleted_entities: deleted,
          remaining_entities: deleted.length > 0 ? ['unknown — check manually'] : ['notifications', 'game_approvals', 'praises', 'game_participants', 'game'],
          game_id: delGameId,
          message: deleted.length > 0
            ? 'Unexpected error mid-delete. Some records may have been deleted. Manual inspection recommended.'
            : 'Unexpected error before any records were deleted. Safe to retry.',
        }, { status: 500 });
      }
    }

    // ── podAdminDeleteGame ────────────────────────────────────────────────────
    // POD-admin-only: permanently delete a POD game and all its derived records.
    // Gate: caller must be authenticated, identity-verified, and an active admin
    //       of the specific POD that owns the game.
    // Delete order: Notifications → GameApproval → Praises → GameParticipant → Game
    if (action === 'podAdminDeleteGame') {
      const { gameId: delGameId, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!delGameId || !callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'gameId, callerAuthUserId, callerProfileId required' }, { status: 400 });
        }

        step = 'verify_identity';
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) {
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        step = 'load_game';
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: delGameId });
        if (!gameArr.length) return Response.json({ error: 'Game not found' }, { status: 404 });
        const podGame = gameArr[0];

        // Only POD games can be deleted this way
        if (podGame.context_type !== 'pod' || !podGame.pod_id) {
          return Response.json({ error: 'Forbidden: only POD games can be deleted via this action' }, { status: 403 });
        }

        step = 'verify_pod_admin';
        const adminMembership = await base44.asServiceRole.entities.PODMembership.filter({
          pod_id: podGame.pod_id, user_id: callerAuthUserId, role: 'admin', membership_status: 'active',
        });
        if (adminMembership.length === 0) {
          return Response.json({ error: 'Forbidden: POD admin access required' }, { status: 403 });
        }

        step = 'preload_records';
        const [delParticipants, delApprovals, allDelNotifs, delPraises] = await Promise.all([
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.GameApproval.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.Notification.filter({ type: 'game_review_request' }, '-created_date', 500).catch(() => []),
          base44.asServiceRole.entities.Praise.filter({ game_id: delGameId }).catch(() => []),
        ]);
        const delGameNotifs = allDelNotifs.filter((n) => n.metadata?.game_id === delGameId);

        console.log('[podAdminDeleteGame] scope', {
          gameId: delGameId, podId: podGame.pod_id, callerProfileId,
          participants: delParticipants.length, approvals: delApprovals.length,
          notifications: delGameNotifs.length, praises: delPraises.length,
        });

        // Step 1: Notifications — stop inbox from showing this game
        step = 'delete_notifications';
        await Promise.all(delGameNotifs.map((n) => base44.asServiceRole.entities.Notification.delete(n.id).catch(() => {})));
        console.log('[podAdminDeleteGame] step=delete_notifications count=', delGameNotifs.length);

        // Step 2: GameApproval rows
        step = 'delete_approvals';
        await Promise.all(delApprovals.map((a) => base44.asServiceRole.entities.GameApproval.delete(a.id).catch(() => {})));
        console.log('[podAdminDeleteGame] step=delete_approvals count=', delApprovals.length);

        // Step 3: Praises — permanently removes all praise rows (and derived stat effects)
        step = 'delete_praises';
        await Promise.all(delPraises.map((p) => base44.asServiceRole.entities.Praise.delete(p.id).catch(() => {})));
        console.log('[podAdminDeleteGame] step=delete_praises count=', delPraises.length);

        // Step 4: GameParticipant — drives stats/leaderboard/history; game becomes invisible after this
        step = 'delete_participants';
        await Promise.all(delParticipants.map((p) => base44.asServiceRole.entities.GameParticipant.delete(p.id).catch(() => {})));
        console.log('[podAdminDeleteGame] step=delete_participants count=', delParticipants.length);

        // Step 5: Game record — last step
        step = 'delete_game';
        await base44.asServiceRole.entities.Game.delete(delGameId);
        console.log('[podAdminDeleteGame] SUCCESS gameId=', delGameId, 'by pod admin=', callerProfileId);

        return Response.json({ success: true });
      } catch (err) {
        console.error('[podAdminDeleteGame] FAILED', { step, delGameId, callerAuthUserId, error: err?.message });
        return Response.json({ error: err.message || 'podAdminDeleteGame failed' }, { status: 500 });
      }
    }

    // ── creatorDeleteGame ─────────────────────────────────────────────────────
    // Allows the game creator/logger OR an active POD admin (for POD games) to
    // permanently hard-delete a game they own/manage.
    // Gate: caller must be the game's created_by_user_id OR active admin of the game's POD.
    if (action === 'creatorDeleteGame') {
      const { gameId: delGameId, callerAuthUserId, callerProfileId } = body;
      let step = 'validate_input';
      try {
        if (!delGameId || !callerAuthUserId || !callerProfileId) {
          return Response.json({ error: 'gameId, callerAuthUserId, callerProfileId required' }, { status: 400 });
        }

        step = 'verify_identity';
        const callerRows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
        if (!callerRows.length || callerRows[0].user_id !== callerAuthUserId) {
          return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
        }

        step = 'load_game';
        const gameArr = await base44.asServiceRole.entities.Game.filter({ id: delGameId });
        if (!gameArr.length) return Response.json({ error: 'Game not found' }, { status: 404 });
        const gameToDelete = gameArr[0];

        // Permission check: creator OR active POD admin
        step = 'check_permission';
        const isCreator = gameToDelete.created_by_user_id === callerAuthUserId;
        let isPodAdmin = false;
        if (!isCreator && gameToDelete.context_type === 'pod' && gameToDelete.pod_id) {
          const adminMembership = await base44.asServiceRole.entities.PODMembership.filter({
            pod_id: gameToDelete.pod_id, user_id: callerAuthUserId, role: 'admin', membership_status: 'active',
          });
          isPodAdmin = adminMembership.length > 0;
        }

        if (!isCreator && !isPodAdmin) {
          return Response.json({ error: 'Forbidden: only the game creator or a POD admin may delete this game' }, { status: 403 });
        }

        // Preload all dependent records
        step = 'preload_records';
        const [delParticipants, delApprovals, allDelNotifs, delPraises] = await Promise.all([
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.GameApproval.filter({ game_id: delGameId }).catch(() => []),
          base44.asServiceRole.entities.Notification.filter({ type: 'game_review_request' }, '-created_date', 500).catch(() => []),
          base44.asServiceRole.entities.Praise.filter({ game_id: delGameId }).catch(() => []),
        ]);
        const delGameNotifs = allDelNotifs.filter((n) => n.metadata?.game_id === delGameId);

        console.log('[creatorDeleteGame] scope', {
          gameId: delGameId, isCreator, isPodAdmin, callerProfileId,
          participants: delParticipants.length, notifications: delGameNotifs.length, praises: delPraises.length,
        });

        // Delete in safe order: notifications → approvals → praises → participants → game
        step = 'delete_notifications';
        await Promise.all(delGameNotifs.map((n) => base44.asServiceRole.entities.Notification.delete(n.id).catch(() => {})));

        step = 'delete_approvals';
        await Promise.all(delApprovals.map((a) => base44.asServiceRole.entities.GameApproval.delete(a.id).catch(() => {})));

        step = 'delete_praises';
        await Promise.all(delPraises.map((p) => base44.asServiceRole.entities.Praise.delete(p.id).catch(() => {})));

        step = 'delete_participants';
        await Promise.all(delParticipants.map((p) => base44.asServiceRole.entities.GameParticipant.delete(p.id).catch(() => {})));

        step = 'delete_game';
        await base44.asServiceRole.entities.Game.delete(delGameId);

        console.log('[creatorDeleteGame] SUCCESS gameId=', delGameId, 'by=', callerProfileId, 'isCreator=', isCreator, 'isPodAdmin=', isPodAdmin);
        return Response.json({ success: true });
      } catch (err) {
        console.error('[creatorDeleteGame] FAILED', { step, delGameId, callerAuthUserId, error: err?.message });
        return Response.json({ error: err.message || 'creatorDeleteGame failed' }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});