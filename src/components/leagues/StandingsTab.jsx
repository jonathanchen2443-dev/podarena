import React, { useState, useEffect, useRef } from "react";
import { Trophy, AlertCircle, RefreshCw, Swords, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RecentDecksIcon from "@/components/leagues/RecentDecksIcon";
import { getLeagueStandings } from "@/components/services/leagueService";
import { ROUTES } from "@/components/utils/routes";
import { base44 } from "@/api/base44Client";

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
      {recentDecks.slice(0, 3).map((d, i) => {
        const title =
          d.variant === "didNotPlay"
            ? "Did not play"
            : d.variant === "colorless"
            ? "Colorless"
            : d.colorIdentity?.join("/") || "Unknown";
        return (
          <RecentDecksIcon key={i} colors={d.colorIdentity} variant={d.variant} size={16} title={title} />
        );
      })}
    </div>
  );
}

function PlayerCell({ row }) {
  const navigate = useNavigate();
  const initials = row.display_name?.slice(0, 2).toUpperCase() || "?";
  return (
    <button
      className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity"
      onClick={() => navigate(ROUTES.USER_PROFILE(row.userId))}
    >
      {row.avatar_url ? (
        <img
          src={row.avatar_url}
          alt={row.display_name}
          className="w-7 h-7 rounded-full object-cover border border-gray-700 flex-shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold" style={{ color: "var(--ds-primary-text)" }}>{initials}</span>
        </div>
      )}
      <span className="text-xs text-white truncate">{row.display_name}</span>
    </button>
  );
}

export default function StandingsTab({ auth, leagueId, inviteToken = null, isMember = false }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  async function loadStandings() {
    if (!leagueId || auth.authLoading) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await getLeagueStandings(auth, leagueId, inviteToken);
      setRows(data);
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setError(isRateLimit
        ? "Too many requests right now. Please wait a few seconds and try again."
        : e.message
      );
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  useEffect(() => {
    if (auth.authLoading) return;
    loadStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, auth.authLoading]);

  if (loading) {
    return (
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-0"><LoadingRows /></CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={loadStandings}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <Card className="bg-gray-900/60 border-gray-800/50"><EmptyStandings /></Card>
      ) : (
        <Card className="bg-gray-900/60 border-gray-800/50 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[20px_1fr_36px_36px_44px_56px] items-center gap-2 px-3 py-2 border-b border-gray-800/60 bg-gray-900/80">
            <span className="text-[10px] text-gray-600 font-semibold">#</span>
            <span className="text-[10px] text-gray-600 font-semibold">Player</span>
            <span className="text-[10px] text-gray-600 font-semibold text-center">GP</span>
            <span className="text-[10px] text-gray-600 font-semibold text-center">Pts</span>
            <span className="text-[10px] text-gray-600 font-semibold text-center">Win%</span>
            <span className="text-[10px] text-gray-600 font-semibold">Recent</span>
          </div>

          <div className="divide-y divide-gray-800/40">
            {rows.map((row, idx) => (
              <div
                key={row.userId}
                className="grid grid-cols-[20px_1fr_36px_36px_44px_56px] items-center gap-2 px-3 py-2.5"
              >
                <span className={`text-xs font-bold ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-700" : "text-gray-600"}`}>
                  {idx + 1}
                </span>
                <PlayerCell row={row} />
                <span className="text-xs text-gray-400 text-center tabular-nums">{row.gamesPlayed}</span>
                <span className="text-xs font-bold text-center tabular-nums" style={{ color: "var(--ds-primary-text)" }}>{row.totalPoints}</span>
                <span className="text-xs text-gray-400 text-center tabular-nums">{row.winRate}%</span>
                <RecentDecksCell recentDecks={row.recentDecks} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Log Game CTA */}
      {auth.isGuest ? (
        <button
          onClick={() => base44.auth.redirectToLogin(window.location.href)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-700 bg-gray-900/40 text-gray-400 hover:text-white hover:border-gray-600 hover:bg-gray-800/60 transition-all text-sm font-medium"
        >
          <LogIn className="w-4 h-4" />
          Sign in to log games
        </button>
      ) : isMember ? (
        <button
          onClick={() => navigate(`${ROUTES.LOG_GAME}?leagueId=${leagueId}&returnTo=league&returnLeagueId=${leagueId}`)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors text-sm font-medium"
        >
          <Swords className="w-4 h-4" />
          Log Game
        </button>
      ) : null}
    </div>
  );
}