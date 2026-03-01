import React, { useState, useEffect, useRef } from "react";
import { Bell, Lock, AlertCircle, RefreshCw, ChevronRight, Users } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { base44 } from "@/api/base44Client";
import { listMyPendingApprovals } from "@/components/services/gameService";
import { invalidateLeagueCache } from "@/components/services/leagueService";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";
import { formatDistanceToNow } from "date-fns";

// ── Approval row (clickable, opens modal) ─────────────────────────────────────
function ApprovalRow({ row, onClick }) {
  const { game, leagueName, submittedByName } = row;
  const names = game.participants.map((p) => p.display_name);
  const preview =
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/40 transition-colors text-left border-b border-gray-800/50 last:border-0"
    >
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-sm font-medium truncate">{leagueName}</span>
          <span className="text-gray-500 text-xs shrink-0">
            {formatDistanceToNow(new Date(game.played_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-gray-400 text-xs truncate">{preview}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {submittedByName && (
            <p className="text-gray-600 text-xs">Logged by {submittedByName}</p>
          )}
          {game.approvalSummary && game.approvalSummary.total > 0 && (
            <span className="text-xs text-amber-500/80">
              · {game.approvalSummary.approved}/{game.approvalSummary.total} approved
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </button>
  );
}

// ── Notification row (info-only, no actions) ──────────────────────────────────
function NotificationRow({ notif }) {
  const isSystemMsg = notif.type === "system_message";
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isSystemMsg ? "bg-sky-500/10 border border-sky-500/20" : "ds-accent-bg ds-accent-bd border"
      }`}>
        {isSystemMsg ? <Bell className="w-4 h-4 text-sky-400" /> : <Users className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-sm font-medium truncate">
            {isSystemMsg ? "System Message" : notif.leagueName}
          </span>
          <span className="text-gray-500 text-xs shrink-0">
            {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
          </span>
        </div>
        <p className="text-gray-400 text-xs">
          {isSystemMsg ? notif.message : <><span style={{ color: "var(--ds-primary-text)" }}>{notif.actorName}</span> joined the league</>}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Inbox() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;

  const [approvals, setApprovals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  // Modal state
  const [selectedRow, setSelectedRow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("gameId") || null;
  });

  async function loadAll() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Fetch approvals and notifications in parallel
      const [rows, rawNotifs] = await Promise.all([
        listMyPendingApprovals(auth),
        currentUser
          ? base44.entities.Notification.filter(
              { recipient_user_id: currentUser.id },
              "-created_date",
              50
            )
          : Promise.resolve([]),
      ]);
      setApprovals(rows);

      // Enrich notifications (batch fetch leagues + profiles to avoid N+1)
      if (rawNotifs.length > 0) {
        const actorIds = [...new Set(rawNotifs.map((n) => n.actor_user_id))];
        const leagueIds = [...new Set(rawNotifs.map((n) => n.league_id))];

        const [allProfiles, allLeagues] = await Promise.all([
          base44.entities.Profile.list("-created_date", 200),
          base44.entities.League.list("-created_date", 200),
        ]);

        const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
        const leagueMap = Object.fromEntries(allLeagues.map((l) => [l.id, l]));

        setNotifications(
          rawNotifs.map((n) => ({
            ...n,
            actorName: profileMap[n.actor_user_id]?.display_name || "Someone",
            leagueName: leagueMap[n.league_id]?.name || "Unknown League",
          }))
        );
      } else {
        setNotifications([]);
      }
    } catch (e) {
      const isRateLimit =
        e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setError(
        isRateLimit
          ? "Too many requests right now. Please wait a few seconds and try again."
          : e.message || "Failed to load inbox."
      );
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  useEffect(() => {
    if (authLoading || isGuest) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  function openModal(gameId) {
    setSelectedRow(gameId);
    const url = new URL(window.location.href);
    url.searchParams.set("gameId", gameId);
    window.history.replaceState(null, "", url.toString());
  }

  function closeModal() {
    setSelectedRow(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("gameId");
    window.history.replaceState(null, "", url.toString());
  }

  async function handleActionComplete(leagueId) {
    if (leagueId) invalidateLeagueCache(leagueId);
    closeModal();
    fetchingRef.current = false;
    await loadAll();
  }

  // ── Guest gate ──────────────────────────────────────────────────────────────
  if (authLoading) return <LoadingState message="Loading inbox…" />;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in to view approvals</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to approve or reject game results logged by your playgroup.
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 px-6"
          onClick={() => base44.auth.redirectToLogin()}
        >
          Sign In
        </Button>
      </div>
    );
  }

  if (loading) return <LoadingState message="Loading inbox…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; loadAll(); }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  const hasApprovals = approvals.length > 0;
  const hasNotifications = notifications.length > 0;

  if (!hasApprovals && !hasNotifications) {
    return (
      <EmptyState
        title="No pending approvals"
        description="You're all caught up. Game approvals and league join notifications will appear here."
      />
    );
  }

  const modalRow = selectedRow ? approvals.find((r) => r.game.id === selectedRow) : null;

  return (
    <>
      <div className="space-y-4">
        {/* Pending approvals */}
        {hasApprovals && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 px-1">
              {approvals.length} pending {approvals.length === 1 ? "approval" : "approvals"}
            </p>
            <Card className="bg-gray-900/60 border-gray-800/50">
              <CardContent className="p-0">
                {approvals.map((row) => (
                  <ApprovalRow key={row.game.id} row={row} onClick={() => openModal(row.game.id)} />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* League join notifications */}
        {hasNotifications && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 px-1">League activity</p>
            <Card className="bg-gray-900/60 border-gray-800/50">
              <CardContent className="p-0">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notif={n} />
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {modalRow && (
        <MatchDetailsModal
          game={modalRow.game}
          auth={auth}
          leagueId={modalRow.leagueId}
          onClose={closeModal}
          onActionComplete={() => handleActionComplete(modalRow.leagueId)}
        />
      )}
    </>
  );
}