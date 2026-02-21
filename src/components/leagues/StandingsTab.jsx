import React, { useState, useEffect } from "react";
import { Trophy, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RecentDecksIcon from "@/components/leagues/RecentDecksIcon";
import { getLeagueStandings } from "@/components/services/leagueService";
import { ROUTES } from "@/components/utils/routes";

function LoadingRows() {
  return (
    <div className="space-y-2 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-lg bg-gray-800/40 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyStandings() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
      <Trophy className="w-10 h-10 text-gray-700" />
      <p className="text-gray-300 font-medium text-sm">No standings yet</p>
      <p className="text-gray-600 text-xs">Standings will appear after approved games are logged.</p>
    </div>
  );
}

function RecentDecksCell({ recentDecks }) {
  if (!recentDecks || recentDecks.length === 0) {
    return <span className="text-gray-700 text-xs">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {recentDecks.map((d, i) => {
        const title =
          d.variant === "didNotPlay"
            ? "Did not play"
            : d.variant === "colorless"
            ? "Colorless"
            : d.colorIdentity?.join("/") || "Unknown";
        return (
          <RecentDecksIcon
            key={i}
            colors={d.colorIdentity}
            variant={d.variant}
            size={16}
            title={title}
          />
        );
      })}
    </div>
  );
}

export default function StandingsTab({ auth, leagueId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!leagueId || auth.authLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeagueStandings(auth, leagueId)
      .then((data) => { if (!cancelled) { setRows(data); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [leagueId, auth.authLoading]);

  if (loading) return <Card className="bg-gray-900/60 border-gray-800/50"><CardContent className="p-0"><LoadingRows /></CardContent></Card>;
  if (error) return (
    <Card className="bg-gray-900/60 border-gray-800/50">
      <CardContent className="p-6 text-center text-red-400 text-sm">{error}</CardContent>
    </Card>
  );
  if (rows.length === 0) return <Card className="bg-gray-900/60 border-gray-800/50"><EmptyStandings /></Card>;

  return (
    <Card className="bg-gray-900/60 border-gray-800/50 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[28px_1fr_32px_60px_36px_56px_88px] items-center gap-1 px-3 py-2 border-b border-gray-800/60 bg-gray-900/80">
        <span className="text-[10px] text-gray-600 font-semibold">#</span>
        <span className="text-[10px] text-gray-600 font-semibold">Player</span>
        <span className="text-[10px] text-gray-600 font-semibold text-center">GP</span>
        <span className="text-[10px] text-gray-600 font-semibold text-center">W-L-D</span>
        <span className="text-[10px] text-gray-600 font-semibold text-center">Pts</span>
        <span className="text-[10px] text-gray-600 font-semibold text-center">Win%</span>
        <span className="text-[10px] text-gray-600 font-semibold">Recent</span>
      </div>

      <div className="divide-y divide-gray-800/40">
        {rows.map((row, idx) => (
          <div
            key={row.userId}
            className="grid grid-cols-[28px_1fr_32px_60px_36px_56px_88px] items-center gap-1 px-3 py-2.5"
          >
            {/* Rank */}
            <span className={`text-xs font-bold ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-700" : "text-gray-600"}`}>
              {idx + 1}
            </span>

            {/* Player */}
            <div className="flex items-center gap-1.5 min-w-0">
              {row.avatar_url ? (
                <img src={row.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-700 flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-violet-400" />
                </div>
              )}
              <span className="text-xs text-white truncate">{row.display_name}</span>
            </div>

            {/* GP */}
            <span className="text-xs text-gray-400 text-center">{row.gamesPlayed}</span>

            {/* W-L-D */}
            <span className="text-xs text-gray-400 text-center tabular-nums">
              <span className="text-emerald-400">{row.wins}</span>
              <span className="text-gray-600">-</span>
              <span className="text-red-400">{row.losses}</span>
              <span className="text-gray-600">-</span>
              <span className="text-blue-400">{row.draws}</span>
            </span>

            {/* Pts */}
            <span className="text-xs font-bold text-violet-300 text-center tabular-nums">{row.totalPoints}</span>

            {/* Win% */}
            <span className="text-xs text-gray-400 text-center tabular-nums">{row.winRate}%</span>

            {/* Recent Decks */}
            <RecentDecksCell recentDecks={row.recentDecks} />
          </div>
        ))}
      </div>
    </Card>
  );
}