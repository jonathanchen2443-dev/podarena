import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { useAuth } from "@/components/auth/AuthContext";
import { getDashboardData } from "@/components/services/dashboardService";
import { base44 } from "@/api/base44Client";
import {
  Bell, Swords, BookOpen, ChevronRight, LogIn,
  Plus, RefreshCw, AlertCircle, Layers, Trophy
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";
import PlayerSearch from "@/components/discovery/PlayerSearch";


// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending:  "bg-amber-500/10  text-amber-400  border-amber-500/20",
  rejected: "bg-red-500/10   text-red-400    border-red-500/20",
};

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || STATUS_STYLES.pending}>
      {status}
    </Badge>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconClass, iconStyle, label, value, to, badge }) {
  const inner = (
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" style={iconStyle} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-semibold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {to && <ChevronRight className="w-4 h-4 text-gray-600" />}
    </CardContent>
  );

  if (to) {
    return (
      <Link to={to}>
        <Card className="bg-gray-900/60 border-gray-800/50 hover:border-gray-700/50 transition-colors cursor-pointer">
          {inner}
        </Card>
      </Link>
    );
  }
  return (
    <Card className="bg-gray-900/60 border-gray-800/50">
      {inner}
    </Card>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 bg-gray-800 rounded-lg" />
        <Skeleton className="h-4 w-64 bg-gray-800 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 bg-gray-800 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 bg-gray-800 rounded-xl" />
    </div>
  );
}

// ── Guest view ────────────────────────────────────────────────────────────────
function GuestView() {
  return (
    <div className="space-y-8">
      <div className="text-center pt-6 pb-2">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ds-accent-bg ds-accent-bd border">
          <Trophy className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <h1 className="text-2xl font-bold text-white">PodArena</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">
          Track games, standings, and approvals across your playgroup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button
          className="ds-btn-primary text-white h-11 rounded-xl"
          onClick={() => base44.auth.redirectToLogin()}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      </div>

      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-4 space-y-3">
          {[
            { icon: Swords, label: "Log game results with your playgroup" },
            { icon: Bell, label: "Approve or reject games logged by others" },
            { icon: Layers, label: "PODS are coming — a better way to organize" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex items-center gap-3 text-gray-400 text-sm">
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
              <span>{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-gray-600 text-xs">
        Game logging and approvals require a free account.
      </p>
    </div>
  );
}

// ── Authenticated view ────────────────────────────────────────────────────────
function AuthDashboard({ data, displayName, auth }) {
  const { pendingApprovalsCount, myDecksCount, recentGames } = data;
  const [casualModal, setCasualModal] = useState(null);

  function handleGameClick(game) {
    if (game.context_type === "casual" || !game.league_id) {
      setCasualModal({ gameId: game.id });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {displayName ? `Hey, ${displayName} 👋` : "Welcome back 👋"}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Track games, approvals, and your decks.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Layers} iconClass="ds-accent-bg ds-accent-bd border" iconStyle={{ color: "var(--ds-primary-text)" }} label="PODS" value="—" to={ROUTES.PODS} />
        <StatCard icon={Bell} iconClass="bg-amber-500/10 text-amber-400" label="Pending Approvals" value={pendingApprovalsCount} to={ROUTES.INBOX} badge={pendingApprovalsCount} />
        <StatCard icon={BookOpen} iconClass="bg-sky-500/10 text-sky-400" label="My Decks" value={myDecksCount} to={ROUTES.PROFILE_DECKS} />
        <StatCard icon={Swords} iconClass="bg-emerald-500/10 text-emerald-400" label="Recent Games" value={recentGames.length} />
      </div>

      {/* Player search */}
      <PlayerSearch placeholder="Find a player…" />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to={ROUTES.LOG_GAME}>
          <Button className="w-full ds-btn-primary h-10 rounded-xl text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Log Game
          </Button>
        </Link>
        <Link to={ROUTES.INBOX}>
          <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 h-10 rounded-xl text-sm relative">
            <Bell className="w-4 h-4 mr-1.5" />
            Inbox
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {pendingApprovalsCount > 9 ? "9+" : pendingApprovalsCount}
              </span>
            )}
          </Button>
        </Link>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Recent Activity</h2>
        </div>

        {recentGames.length === 0 ? (
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-8 text-center">
              <Swords className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No games yet.</p>
              <Link to={ROUTES.LOG_GAME}>
                <Button variant="ghost" size="sm" className="mt-2 hover:opacity-80" style={{ color: "var(--ds-primary-text)" }}>
                  Log your first game
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-0">
              {recentGames.map((game) => {
                const isCasual = game.context_type === "casual" || !game.league_id;
                const inner = (
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          isCasual
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : "bg-gray-800 text-gray-400 border-gray-700"
                        }`}>
                          {isCasual ? "🎲 Casual" : "⚔️ Game"}
                        </span>
                        <StatusBadge status={game.status} />
                      </div>
                      <p className="text-gray-500 text-xs truncate">{game.participantsSummary}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {formatDistanceToNow(new Date(game.played_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  </div>
                );

                // All games now open in modal (league games shown same as casual during migration)
                return (
                  <div key={game.id} onClick={() => handleGameClick(game)}>
                    {inner}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Game modal */}
      {casualModal && (
        <MatchDetailsModal
          gameId={casualModal.gameId}
          leagueId={null}
          onClose={() => setCasualModal(null)}
          auth={auth}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;

  const [data, setData] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (isGuest) { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  async function load() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      if (currentUser) {
        setDisplayName(currentUser.display_name || currentUser.full_name || "");
      }
      const result = await getDashboardData(auth);
      setData(result);
    } catch (e) {
      const isRate = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setError(isRate ? "Too many requests right now. Please wait a few seconds and try again." : (e.message || "Failed to load dashboard."));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  if (authLoading || loading) return <DashboardSkeleton />;

  if (isGuest) return <GuestView />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; load(); }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return <AuthDashboard data={data} displayName={displayName} auth={auth} />;
}