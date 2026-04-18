import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { Trophy, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { ROUTES } from "@/components/utils/routes";
import { getPODLeaderboard } from "@/components/services/podService";
import { base44 } from "@/api/base44Client";

// ── Name formatter ────────────────────────────────────────────────────────────
// "Jonathan Collins" → "Jonathan C."
// "Omer" → "Omer"
// Cap first name at 10 chars
function formatLeaderboardName(displayName) {
  if (!displayName || displayName === "Unknown") return displayName || "Unknown";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  const first = parts[0].slice(0, 10);
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

// ── Rank sort (same order as backend) ────────────────────────────────────────
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const wrA = parseFloat(a.winRate || 0);
    const wrB = parseFloat(b.winRate || 0);
    if (wrB !== wrA) return wrB - wrA;
    return b.games - a.games;
  });
}

// ── Movement computation ──────────────────────────────────────────────────────
// Returns a map of profileId → "up" | "down" | "same" | null
// Uses prevLeaderboard from backend if available, otherwise null (no arrows).
function computeMovement(leaderboard, prevLeaderboard) {
  if (!prevLeaderboard || prevLeaderboard.length === 0) return {};
  const prevRankMap = {};
  prevLeaderboard.forEach((entry, idx) => { prevRankMap[entry.profileId] = idx + 1; });
  const result = {};
  leaderboard.forEach((entry, idx) => {
    const currRank = idx + 1;
    const prevRank = prevRankMap[entry.profileId];
    if (prevRank == null) { result[entry.profileId] = null; return; }
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
  if (!direction || direction === "same") return <div className="h-3" />;
  if (direction === "up") return <ArrowUp className="w-3 h-3 text-green-400" />;
  if (direction === "down") return <ArrowDown className="w-3 h-3 text-red-400" />;
  return <div className="h-3" />;
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left relative overflow-hidden hover:bg-white/5 ${
        isTop3
          ? "bg-gray-900/80 border-gray-700/60"
          : "bg-gray-900/40 border-gray-800/40"
      } ${isMe ? "ring-1 ring-inset ring-blue-500/30" : ""}`}
    >
      {/* Top-3 side accent bar */}
      {isTop3 && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${accent.bar}`} />
      )}

      {/* LEFT: Rank + movement */}
      <div className="flex flex-col items-center w-7 flex-shrink-0 pl-1">
        <span className={`text-base font-black leading-none ${isTop3 ? accent.num : "text-gray-500"}`}>
          {rank}
        </span>
        <div className="mt-0.5">
          <MovementArrow direction={movement} />
        </div>
      </div>

      {/* CENTER: Avatar + name + secondary stats */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-700"
            alt=""
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-300 flex-shrink-0 ring-1 ring-gray-600">
            {(profile?.display_name || "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-semibold leading-tight truncate ${isMe ? "text-blue-300" : "text-white"}`}>
            {formattedName}
            {isMe && <span className="ml-1 text-xs text-blue-400/70 font-normal">(you)</span>}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-none">
            {entry.games}G &bull; {entry.wins}W &bull; {winRate}%
          </p>
        </div>
      </div>

      {/* RIGHT: Points pill */}
      <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-bold tracking-wide ${
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
        const { leaderboard: lb, prevLeaderboard: prev, profiles: profileMap } = await getPODLeaderboard(podId, currentUser.id);
        if (cancelled) return;
        setProfiles(profileMap);
        setLeaderboard(lb);
        setPrevLeaderboard(prev || null);
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

  return (
    <div className="space-y-4">
      {pendingBanner}

      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Rankings</p>
        {prevLeaderboard && (
          <p className="text-[10px] text-gray-600">Arrows show change since last game</p>
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

      {/* Legend */}
      {leaderboard.length > 0 && (
        <p className="text-center text-[10px] text-gray-700 pt-1">
          Ranked by Points · Wins · Win% · Games
        </p>
      )}
    </div>
  );
}