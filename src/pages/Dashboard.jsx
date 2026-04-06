import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { useAuth } from "@/components/auth/AuthContext";
import { base44 } from "@/api/base44Client";
import { getDashboardData, invalidateDashboardCache } from "@/components/services/dashboardService";
import { invalidateProfileStatsCache } from "@/components/services/profileStatsService";
import { invalidateProfileInsightsCache } from "@/components/services/profileInsightsService";
import {
  Bell, Swords, BookOpen, ChevronRight,
  Plus, RefreshCw, AlertCircle, Layers
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
    <CardContent className="px-3 py-0 h-[72px] flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" style={iconStyle} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 font-medium leading-tight truncate">{label}</p>
        {value !== undefined && value !== " " && (
          <p className="text-lg font-bold text-white leading-tight">{value}</p>
        )}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-semibold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
          {badge}
        </span>
      )}
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

// ── Authenticated view ────────────────────────────────────────────────────────
function AuthDashboard({ data, displayName, auth, onRefreshActivity }) {
  const { pendingApprovalsCount, myPodsCount, myDecksCount, recentGames } = data;
  const [casualModal, setCasualModal] = useState(null);

  function handleGameClick(game) {
    // Always open via participant path — works for both casual and pod pending games.
    // Passing podId only when the game is NOT pending for current user (view-only pod context).
    // For pending games, participant path is correct and avoids "not a participant" error.
    const myAuthUserId = auth.authUserId || auth.currentUser?.user_id;
    const isPendingReview = game.status === "pending";
    setCasualModal({
      gameId: game.id,
      // For pending reviews, skip podId so the modal uses the participant path (not podGameDetails)
      podId: isPendingReview ? null : (game.pod_id || null),
      pod_name: game.pod_name || null,
    });
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
        <StatCard icon={Layers} iconClass="ds-accent-bg ds-accent-bd border" iconStyle={{ color: "var(--ds-primary-text)" }} label="PODS" value={myPodsCount} to={ROUTES.PODS} />
        <StatCard icon={Bell} iconClass="bg-amber-500/10 text-amber-400" label="Pending Approvals" value={pendingApprovalsCount} to={ROUTES.INBOX} badge={pendingApprovalsCount} />
        <StatCard icon={BookOpen} iconClass="bg-sky-500/10 text-sky-400" label="My Decks" value={myDecksCount} to={ROUTES.PROFILE_DECKS} />
        <StatCard
          icon={() => <img src="https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/ea67a07bb_dice_8732022.png" alt="dice" className="w-5 h-5 object-contain" />}
          iconClass="bg-gray-800/60 border border-gray-700/40"
          label="Random Deck Picker"
          value=" "
          to={ROUTES.RANDOM_DECK_PICKER}
        />
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
          <button
            onClick={onRefreshActivity}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Refresh activity"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
                const isCasual = !game.context_type || game.context_type === "casual";
                const inner = (
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          isCasual
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}>
                          {isCasual ? "🎲 Casual" : `⚔️ POD${game.pod_name ? ` - ${game.pod_name}` : ""}`}
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
          podId={casualModal.podId}
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
  const { authLoading, currentUser } = auth;

  const [data, setData] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Real-time: when any Game record changes status (e.g. approved after all votes),
  // bust caches and reload so creator sees finalized state immediately.
  useEffect(() => {
    if (authLoading || !currentUser) return;
    const unsubscribe = base44.entities.Game.subscribe((event) => {
      if (event.type === "update" && event.data?.status === "approved") {
        // currentUser.id = Profile ID — dashboard/stats caches are keyed on Profile ID
        invalidateDashboardCache(currentUser.id);
        invalidateProfileStatsCache(currentUser.id);
        invalidateProfileInsightsCache(currentUser.id);
        fetchingRef.current = false;
        load();
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser]);

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
      // getDashboardData returns EMPTY (not null/undefined) on partial failures —
      // always set data so the UI renders, never surface a blocking error for a
      // background dashboard refresh (game creation already succeeded at this point).
      setData(result ?? { myPodsCount: 0, pendingApprovalsCount: 0, myDecksCount: 0, recentGames: [] });
    } catch (e) {
      // Log silently — do not surface a blocking error UI for a dashboard background refresh.
      // The user's game was already logged successfully; a dashboard load failure is recoverable.
      console.warn("[Dashboard] load failed gracefully:", e?.message);
      setData({ myPodsCount: 0, pendingApprovalsCount: 0, myDecksCount: 0, recentGames: [] });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  if (authLoading || loading) return <DashboardSkeleton />;

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

  async function refreshActivity() {
    // Invalidate cache and reload only recent games without spinner-blocking the whole page
    invalidateDashboardCache(currentUser?.id);
    try {
      const result = await getDashboardData({ ...auth, _bustCache: true });
      if (result) setData(result);
    } catch (_) {}
  }

  return <AuthDashboard data={data} displayName={displayName} auth={auth} onRefreshActivity={refreshActivity} />;
}