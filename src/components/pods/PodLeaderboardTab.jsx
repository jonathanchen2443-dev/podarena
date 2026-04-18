import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { Trophy, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { ROUTES } from "@/components/utils/routes";
import { getPODLeaderboard } from "@/components/services/podService";
import { base44 } from "@/api/base44Client";

// ── Name formatter ────────────────────────────────────────────────────────────
function formatLeaderboardName(displayName) {
  if (!displayName || displayName === "Unknown") return displayName || "Unknown";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  const first = parts[0].slice(0, 10);
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

// ── Ranking sort — single source of truth, used for both current and prev ─────
// Points desc → Wins desc → Win Rate desc → Games desc
function rankEntries(statsArray) {
  return [...statsArray].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const wrA = parseFloat(a.winRate ?? (a.games > 0 ? (a.wins / a.games) * 100 : 0));
    const wrB = parseFloat(b.winRate ?? (b.games > 0 ? (b.wins / b.games) * 100 : 0));
    if (wrB !== wrA) return wrB - wrA;
    return b.games - a.games;
  });
}

// ── Client-side prev-leaderboard derivation ───────────────────────────────────
// Given the current leaderboard (from backend) and the full approved POD game
// history (from podHistory), reconstructs what the leaderboard looked like BEFORE
// the most recently approved game.
//
// CONTRACT: this function is the ONLY place that computes prevLeaderboard client-side.
// When the backend starts returning prevLeaderboard directly, replace the call to
// this function with the backend value — computeMovement() itself does not change.
//
// @param leaderboard  Array<{ profileId, games, wins, points, winRate }>
// @param podGames     Array<{ id, status, played_at }> — all pod games
// @param participantMap  { [gameId]: Array<{ participant_profile_id, placement, result }> }
// @returns Array<{ profileId, games, wins, points, winRate }> | null
function derivePrevLeaderboard(leaderboard, podGames, participantMap) {
  // Only use approved games, sorted newest-first
  const approvedGames = [...podGames]
    .filter((g) => g.status === "approved")
    .sort((a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0));

  // Need at least 2 approved games to show meaningful movement
  if (approvedGames.length < 2) return null;

  const latestGameId = approvedGames[0].id;
  const latestParticipants = participantMap[latestGameId] || [];

  // Subtract the latest game's contributions from current stats
  // Build a map of profileId → stats contribution from the latest game
  const latestContrib = {};
  for (const p of latestParticipants) {
    const pid = p.participant_profile_id || p.userId;
    if (!pid) continue;
    const isWin = p.placement === 1 || p.result === "win";
    latestContrib[pid] = { games: 1, wins: isWin ? 1 : 0, points: isWin ? 1 : 0 };
  }

  // Reconstruct prev stats for every player in the current leaderboard
  const prevStats = leaderboard.map((entry) => {
    const contrib = latestContrib[entry.profileId] || { games: 0, wins: 0, points: 0 };
    const prevGames = entry.games - contrib.games;
    const prevWins = entry.wins - contrib.wins;
    const prevPoints = entry.points - contrib.points;
    return {
      profileId: entry.profileId,
      games: Math.max(0, prevGames),
      wins: Math.max(0, prevWins),
      points: Math.max(0, prevPoints),
      winRate: prevGames > 0 ? ((Math.max(0, prevWins) / Math.max(1, prevGames)) * 100).toFixed(1) : "0.0",
    };
  });

  return rankEntries(prevStats);
}

// ── Movement computation ──────────────────────────────────────────────────────
// Pure function: compares current ranked list against previous ranked list.
// Works identically whether prevLeaderboard came from the backend or was
// derived client-side — this is the stable UI contract.
//
// @returns { [profileId]: "up" | "down" | "same" | null }
function computeMovement(leaderboard, prevLeaderboard) {
  if (!prevLeaderboard || prevLeaderboard.length === 0) return {};

  const prevRankMap = {};
  prevLeaderboard.forEach((entry, idx) => {
    prevRankMap[entry.profileId] = idx + 1;
  });

  const result = {};
  leaderboard.forEach((entry, idx) => {
    const currRank = idx + 1;
    const prevRank = prevRankMap[entry.profileId];
    if (prevRank == null) {
      // Player newly appeared — no meaningful comparison
      result[entry.profileId] = null;
      return;
    }
    if (currRank < prevRank) result[entry.profileId] = "up";
    else if (currRank > prevRank) result[entry.profileId] = "down";
    else result[entry.profileId] = "same";
  });
  return result;
}

// ── Top-3 accent config ───────────────────────────────────────────────────────
const RANK_ACCENT = {
  1: {
    bar: "bg-amber-400",
    num: "text-amber-400",
    pts: "text-amber-300 bg-amber-400/10 border-amber-400/25",
  },
  2: {
    bar: "bg-slate-400",
    num: "text-slate-300",
    pts: "text-slate-300 bg-slate-400/10 border-slate-400/25",
  },
  3: {
    bar: "bg-amber-700",
    num: "text-amber-700",
    pts: "text-amber-700 bg-amber-700/10 border-amber-700/25",
  },
};

// ── Movement Arrow ────────────────────────────────────────────────────────────
function MovementArrow({ direction }) {
  if (!direction || direction === "same") return null;
  if (direction === "up") return <ArrowUp className="w-2.5 h-2.5 text-green-400" />;
  if (direction === "down") return <ArrowDown className="w-2.5 h-2.5 text-red-400" />;
  return null;
}

// ── Leaderboard Card ──────────────────────────────────────────────────────────
function LeaderboardCard({ entry, rank, profile, movement, isMe }) {
  const navigate = useNavigate();
  const accent = RANK_ACCENT[rank];
  const isTop3 = rank <= 3;

  const winRate = entry.winRate || "0.0";
  const formattedName = formatLeaderboardName(profile?.display_name || "Unknown");

  return (
    <button
      type="button"
      onClick={() => entry.profileId && navigate(ROUTES.USER_PROFILE(entry.profileId))}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left relative overflow-hidden hover:bg-white/5 ${
        isTop3
          ? "bg-gray-900/80 border-gray-700/60"
          : "bg-gray-900/40 border-gray-800/40"
      } ${isMe ? "ring-1 ring-inset ring-blue-500/30" : ""}`}
    >
      {/* Top-3 side accent bars — left and right */}
      {isTop3 && (
        <>
          <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${accent.bar}`} />
          <div className={`absolute right-0 top-0 bottom-0 w-0.5 rounded-r-xl ${accent.bar}`} />
        </>
      )}

      {/* LEFT: Rank + movement arrow */}
      <div className="flex flex-col items-center justify-center w-9 flex-shrink-0 pl-1 gap-0.5">
        <span className={`text-lg font-black leading-none ${isTop3 ? accent.num : "text-gray-500"}`}>
          {rank}
        </span>
        <MovementArrow direction={movement} />
      </div>

      {/* CENTER: Avatar + name + secondary stats */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-700"
            alt=""
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-300 flex-shrink-0 ring-1 ring-gray-600">
            {(profile?.display_name || "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-semibold leading-tight truncate ${isMe ? "text-blue-300" : "text-white"}`}>
            {formattedName}
            {isMe && <span className="ml-1.5 text-xs text-blue-400/60 font-normal">(you)</span>}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 leading-none">
            G {entry.games} &bull; W {entry.wins} &bull; WR {winRate}%
          </p>
        </div>
      </div>

      {/* RIGHT: Points pill */}
      <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide ${
        isTop3 ? accent.pts : "text-gray-300 bg-gray-800/60 border-gray-700/50"
      }`}>
        {entry.points} PTS
      </div>
    </button>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PodLeaderboardTab({ pod, myMembership, podId }) {
  const { currentUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [prevLeaderboard, setPrevLeaderboard] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const isActiveMember = myMembership?.membership_status === "active";
  const hasPendingOrInvite = myMembership && ["pending_request", "invited_pending"].includes(myMembership.membership_status);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (!isActiveMember) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Fetch leaderboard + pod game history in parallel.
        // podHistory gives us approved games + participants needed to compute prevLeaderboard.
        const [lbResult, historyResult] = await Promise.all([
          getPODLeaderboard(podId, currentUser.id),
          base44.functions.invoke("publicProfiles", {
            action: "podHistory",
            podId,
            callerProfileId: currentUser.id,
          }),
        ]);

        if (cancelled) return;

        const lb = lbResult.leaderboard || [];
        const profileMap = lbResult.profiles || {};

        setLeaderboard(lb);
        setProfiles(profileMap);

        // Movement computation:
        // Priority 1: use backend-provided prevLeaderboard if available (future-ready path).
        // Priority 2: derive client-side from pod game history (current practical path).
        const backendPrev = lbResult.prevLeaderboard || null;
        if (backendPrev) {
          setPrevLeaderboard(backendPrev);
        } else if (historyResult?.data) {
          const { games: podGames = [], participants: participantMap = {} } = historyResult.data;
          const clientPrev = derivePrevLeaderboard(lb, podGames, participantMap);
          setPrevLeaderboard(clientPrev);
        } else {
          setPrevLeaderboard(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [podId, currentUser?.id, isActiveMember]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Pending/invite status banner
  const pendingBanner = !isActiveMember && hasPendingOrInvite ? (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
      <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
      <p className="text-amber-400 text-sm font-medium">
        {myMembership.membership_status === "pending_request"
          ? "Request sent — waiting for admin approval"
          : "Invite received — waiting for admin to activate"}
      </p>
    </div>
  ) : null;

  if (leaderboard.length === 0) {
    return (
      <div className="space-y-4">
        {pendingBanner}
        <div className="py-10 text-center">
          <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No activity yet</p>
          <p className="text-gray-600 text-xs mt-1">The leaderboard will appear after the first approved game.</p>
        </div>
      </div>
    );
  }

  const movementMap = computeMovement(leaderboard, prevLeaderboard);
  const hasMovement = Object.values(movementMap).some((v) => v === "up" || v === "down");

  return (
    <div className="space-y-3">
      {pendingBanner}

      {/* Legend — above cards */}
      <div className="flex flex-col items-center gap-1 px-1">
        <p className="text-xs text-gray-500 text-center">G = Games &bull; W = Wins &bull; WR = Win Rate</p>
        {hasMovement && (
          <p className="text-[10px] text-gray-600">↑↓ since last game</p>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {leaderboard.map((entry, idx) => (
          <LeaderboardCard
            key={entry.profileId}
            entry={entry}
            rank={idx + 1}
            profile={profiles[entry.profileId]}
            movement={movementMap[entry.profileId] ?? null}
            isMe={entry.profileId === currentUser?.id}
          />
        ))}
      </div>
    </div>
  );
}