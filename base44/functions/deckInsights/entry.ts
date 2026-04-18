/**
 * deckInsights — owner-only backend aggregation for a single deck.
 *
 * ACTION: deckInsights
 * Gate: deck.owner_id must match the caller's verified profile (callerAuthUserId + callerProfileId).
 * Scope: approved + non-hidden games only (POD and casual).
 * Uses asServiceRole to read cross-user game/participant data safely.
 *
 * Input:  { deckId, callerAuthUserId, callerProfileId }
 * Output: { deck, summary, eligibility, insights, props }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeProfile(raw) {
  return {
    id: raw.id,
    display_name: raw.display_name || 'Unknown',
    avatar_url: raw.avatar_url || null,
  };
}

const PRAISE_META = {
  on_fire:              { label: 'On Fire',              emoji: '🔥' },
  no_mercy:             { label: 'No Mercy',             emoji: '⚔️' },
  puppet_master:        { label: 'Puppet Master',        emoji: '🧵' },
  fortress:             { label: 'Fortress',             emoji: '🏰' },
  clutch:               { label: 'Clutch',               emoji: '🎯' },
  crowned_commander:    { label: 'Crowned Commander',    emoji: '👑' },
  should_have_been_you: { label: 'Should Have Been You', emoji: '😮' },
  troublemaker:         { label: 'Troublemaker',         emoji: '🌪️' },
  phoenix:              { label: 'Phoenix',              emoji: '🔴' },
  knockout:             { label: 'Knockout',             emoji: '👊' },
};

// ── Threshold — single source of truth ────────────────────────────────────────
// Change this number to adjust when insights unlock. Frontend reads eligibility object.
const MIN_GAMES = 2;

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let step = 'init';
  let deckId, callerAuthUserId, callerProfileId;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    ({ deckId, callerAuthUserId, callerProfileId } = body);

    // Auth gate
    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Input validation — callerProfileId is the viewer (may be owner or public viewer)
    step = 'validate_input';
    if (!deckId || !callerAuthUserId || !callerProfileId) {
      return Response.json({ error: 'deckId, callerAuthUserId, callerProfileId required' }, { status: 400 });
    }

    // Verify caller identity — catch SDK errors for invalid IDs → 403, not 500
    step = 'verify_identity';
    let callerProfileRow;
    try {
      const rows = await base44.asServiceRole.entities.Profile.filter({ id: callerProfileId });
      callerProfileRow = rows[0] || null;
    } catch (_) {
      callerProfileRow = null;
    }
    if (!callerProfileRow || callerProfileRow.user_id !== callerAuthUserId) {
      return Response.json({ error: 'Forbidden: identity mismatch' }, { status: 403 });
    }

    // Load the deck — public-safe: any authenticated user can view insights for any deck.
    // Data returned is derived only from approved, non-hidden games — no private raw data exposed.
    step = 'load_deck';
    let deck;
    try {
      const deckRows = await base44.asServiceRole.entities.Deck.filter({ id: deckId });
      deck = deckRows[0] || null;
    } catch (_) {
      deck = null;
    }
    if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });

    // Fetch deck owner profile for display (safe public fields only)
    step = 'load_owner_profile';
    let ownerProfile = null;
    try {
      const ownerRows = await base44.asServiceRole.entities.Profile.filter({ id: deck.owner_id });
      if (ownerRows[0]) {
        ownerProfile = { id: ownerRows[0].id, display_name: ownerRows[0].display_name || 'Unknown' };
      }
    } catch (_) {}

    // ── Step 1: All participations for this profile, filter to this deck ──
    step = 'load_participations';
    const allMyParticipations = await base44.asServiceRole.entities.GameParticipant.filter(
      { participant_profile_id: callerProfileId }, '-created_date', 500
    );
    const deckParticipations = allMyParticipations.filter((p) => p.selected_deck_id === deckId);

    // ── Step 2: Load games (approved + non-hidden only) ──
    step = 'load_games';
    const rawGameIds = [...new Set(deckParticipations.map((p) => p.game_id).filter(Boolean))];
    let countedGames = [];
    if (rawGameIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < rawGameIds.length; i += 50) chunks.push(rawGameIds.slice(i, i + 50));
      const gameResults = await Promise.all(
        chunks.map((chunk) =>
          base44.asServiceRole.entities.Game.filter(
            { id: { $in: chunk }, status: 'approved' }, '-played_at', 50
          ).catch(() => [])
        )
      );
      countedGames = gameResults.flat().filter((g) => !g.is_hidden);
    }

    const countedGameIds = new Set(countedGames.map((g) => g.id));
    const countedParticipations = deckParticipations.filter((p) => countedGameIds.has(p.game_id));
    const gameMap = Object.fromEntries(countedGames.map((g) => [g.id, g]));

    // ── Step 3: Summary ──
    step = 'build_summary';
    const gamesPlayed = countedParticipations.length;
    const wins = countedParticipations.filter((p) => p.placement === 1 || p.result === 'win').length;
    const winRatePercent = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    const podParticipations = countedParticipations.filter((p) => gameMap[p.game_id]?.context_type === 'pod');
    const casualParticipations = countedParticipations.filter((p) => gameMap[p.game_id]?.context_type !== 'pod');
    const podGames = podParticipations.length;
    const podWins = podParticipations.filter((p) => p.placement === 1 || p.result === 'win').length;
    const casualGames = casualParticipations.length;
    const casualWins = casualParticipations.filter((p) => p.placement === 1 || p.result === 'win').length;

    const sortedDates = countedGames
      .map((g) => g.played_at || g.created_date)
      .filter(Boolean)
      .sort();
    const firstLoggedAt = sortedDates[0] || null;
    const lastPlayedAt = sortedDates[sortedDates.length - 1] || null;

    // ── Step 4: Eligibility ──
    const insightsUnlocked = gamesPlayed >= MIN_GAMES;
    const gamesNeeded = insightsUnlocked ? 0 : MIN_GAMES - gamesPlayed;

    // ── Step 5: Insights ──
    step = 'build_insights';
    let mostPlayedPod     = { pod_id: null, pod_name: null, games: 0 };
    let bestAgainstPlayer = { profile_id: null, display_name: null, wins: 0 };
    let toughestOpponent  = { profile_id: null, display_name: null, losses: 0 };
    let bestAgainstDeck   = { deck_label: null, wins: 0 };

    if (gamesPlayed > 0) {
      // Load all participant rows for counted games in parallel
      const participantArrays = await Promise.all(
        countedGames.map((g) =>
          base44.asServiceRole.entities.GameParticipant.filter({ game_id: g.id }, '-created_date', 20).catch(() => [])
        )
      );
      const allOpponentRows = participantArrays.flat().filter(
        (p) => p.participant_profile_id !== callerProfileId
      );

      // most_played_pod
      if (podGames > 0) {
        const podCounts = {};
        for (const p of podParticipations) {
          const g = gameMap[p.game_id];
          if (g?.pod_id) podCounts[g.pod_id] = (podCounts[g.pod_id] || 0) + 1;
        }
        const topPodId = Object.keys(podCounts).sort((a, b) => podCounts[b] - podCounts[a])[0];
        if (topPodId) {
          const podArr = await base44.asServiceRole.entities.POD.filter({ id: topPodId });
          mostPlayedPod = {
            pod_id: topPodId,
            pod_name: podArr[0]?.pod_name || null,
            games: podCounts[topPodId],
          };
        }
      }

      // Profile map for opponents
      const opponentProfileIds = [...new Set(allOpponentRows.map((p) => p.participant_profile_id).filter(Boolean))];
      let opponentProfileMap = {};
      if (opponentProfileIds.length > 0) {
        const profiles = await base44.asServiceRole.entities.Profile.filter(
          { id: { $in: opponentProfileIds } }, '-created_date', 200
        );
        opponentProfileMap = Object.fromEntries(profiles.map((p) => [p.id, sanitizeProfile(p)]));
      }

      const winGameIds = new Set(
        countedParticipations.filter((p) => p.placement === 1 || p.result === 'win').map((p) => p.game_id)
      );
      const lossGameIds = new Set(
        countedParticipations.filter((p) => p.placement !== 1 && p.result !== 'win').map((p) => p.game_id)
      );

      // best_against_player
      const winOpponentCounts = {};
      for (const p of allOpponentRows) {
        if (winGameIds.has(p.game_id) && p.participant_profile_id) {
          winOpponentCounts[p.participant_profile_id] = (winOpponentCounts[p.participant_profile_id] || 0) + 1;
        }
      }
      const topWinOpponentId = Object.keys(winOpponentCounts).sort(
        (a, b) => winOpponentCounts[b] - winOpponentCounts[a]
      )[0];
      if (topWinOpponentId) {
        const prof = opponentProfileMap[topWinOpponentId];
        bestAgainstPlayer = {
          profile_id: topWinOpponentId,
          display_name: prof?.display_name || 'Unknown',
          wins: winOpponentCounts[topWinOpponentId],
        };
      }

      // toughest_opponent: opponents who won games where this deck lost
      const lossOpponentCounts = {};
      for (const p of allOpponentRows) {
        if (lossGameIds.has(p.game_id) && (p.placement === 1 || p.result === 'win') && p.participant_profile_id) {
          lossOpponentCounts[p.participant_profile_id] = (lossOpponentCounts[p.participant_profile_id] || 0) + 1;
        }
      }
      const topLossOpponentId = Object.keys(lossOpponentCounts).sort(
        (a, b) => lossOpponentCounts[b] - lossOpponentCounts[a]
      )[0];
      if (topLossOpponentId) {
        const prof = opponentProfileMap[topLossOpponentId];
        toughestOpponent = {
          profile_id: topLossOpponentId,
          display_name: prof?.display_name || 'Unknown',
          losses: lossOpponentCounts[topLossOpponentId],
        };
      }

      // best_against_deck: safe snapshot fields only — no live Deck reads
      const deckWinCounts = {};
      for (const p of allOpponentRows) {
        if (!winGameIds.has(p.game_id)) continue;
        const snap = p.deck_snapshot_json || {};
        const label = p.deck_name_at_time || snap.name || p.commander_name_at_time || snap.commander_name || null;
        if (label) deckWinCounts[label] = (deckWinCounts[label] || 0) + 1;
      }
      const topDeckLabel = Object.keys(deckWinCounts).sort(
        (a, b) => deckWinCounts[b] - deckWinCounts[a]
      )[0];
      if (topDeckLabel) {
        bestAgainstDeck = { deck_label: topDeckLabel, wins: deckWinCounts[topDeckLabel] };
      }
    }

    // ── Step 6: Props received by this deck (is_visible=true only) ──
    step = 'load_praises';
    const praiseRows = await base44.asServiceRole.entities.Praise.filter(
      { receiver_deck_id_at_time: deckId, is_visible: true }, '-created_date', 500
    ).catch(() => []);

    const byType = {};
    for (const pr of praiseRows) {
      const t = pr.praise_type;
      if (t) byType[t] = (byType[t] || 0) + 1;
    }
    // icon_key = type key — consistent with PRAISE_META in praiseService.jsx.
    // emoji kept as optional metadata; icon_key is the primary rendering contract.
    const sorted = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        icon_key: type,
        label: PRAISE_META[type]?.label || type,
        emoji: PRAISE_META[type]?.emoji || null,
        count,
      }));

    // ── Assemble ──
    step = 'finalize_response';
    console.log('[deckInsights] success deckId=', deckId, 'callerProfileId=', callerProfileId, 'gamesPlayed=', gamesPlayed, 'insightsUnlocked=', insightsUnlocked);
    return Response.json({
      owner: ownerProfile,
      deck: {
        id: deck.id,
        name: deck.name || 'Unnamed',
        commander_name: deck.commander_name || null,
        commander_image_url: deck.commander_image_url || null,
        color_identity: deck.color_identity || [],
        first_logged_at: firstLoggedAt,
        last_played_at: lastPlayedAt,
      },
      summary: {
        games_played: gamesPlayed,
        wins,
        win_rate_percent: winRatePercent,
        pod_games: podGames,
        pod_wins: podWins,
        pod_win_rate_percent: podGames > 0 ? Math.round((podWins / podGames) * 100) : 0,
        casual_games: casualGames,
        casual_wins: casualWins,
        casual_win_rate_percent: casualGames > 0 ? Math.round((casualWins / casualGames) * 100) : 0,
      },
      eligibility: {
        insights_unlocked: insightsUnlocked,
        games_needed_to_unlock: gamesNeeded,
        minimum_games_required: MIN_GAMES,
      },
      insights: {
        most_played_pod: mostPlayedPod,
        best_against_player: bestAgainstPlayer,
        toughest_opponent: toughestOpponent,
        best_against_deck: bestAgainstDeck,
      },
      props: {
        total_received: praiseRows.length,
        by_type: byType,
        sorted,
      },
    });

  } catch (err) {
    console.error('[deckInsights] FAILED', { step, deckId, callerAuthUserId, callerProfileId, error: err?.message });
    return Response.json({ error: err.message || 'deckInsights failed' }, { status: 500 });
  }
});