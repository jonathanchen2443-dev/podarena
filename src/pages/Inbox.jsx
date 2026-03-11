import React, { useState, useEffect, useRef } from "react";
import { Bell, Lock, AlertCircle, RefreshCw, ChevronRight, Users, Trash2, Layers } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { base44 } from "@/api/base44Client";
import { listMyPendingApprovals } from "@/components/services/gameService";
import { invalidateLeagueCache } from "@/components/services/leagueService";
import { invalidateDashboardCache } from "@/components/services/dashboardService";
import { invalidateProfileStatsCache } from "@/components/services/profileStatsService";
import { invalidateProfileInsightsCache } from "@/components/services/profileInsightsService";
import { getPublicProfile } from "@/components/services/profileService.jsx";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";
import { formatDistanceToNow } from "date-fns";
import { notifyInboxUpdated } from "@/components/services/inboxBus";
import { toast } from "sonner";

// ── Game Approval row ─────────────────────────────────────────────────────────
function ApprovalRow({ row, isRead, onClick, onDelete }) {
  const { game, leagueName, submittedByName } = row;
  const names = game.participants.map((p) => p.display_name);
  const preview =
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;

  return (
    <div className="relative flex items-center border-b border-gray-800/50 last:border-0 group">
      {!isRead && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      )}
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-3 py-3.5 hover:bg-gray-800/40 transition-colors text-left ${!isRead ? "pl-5 pr-4" : "px-4"}`}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-sm font-medium truncate ${isRead ? "text-gray-300" : "text-white"}`}>{leagueName}</span>
            <span className="text-gray-500 text-xs shrink-0">
              {formatDistanceToNow(new Date(game.played_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-gray-400 text-xs truncate">{preview}</p>
          {submittedByName && (
            <p className="text-gray-600 text-xs mt-0.5">Logged by {submittedByName}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
      </button>
      <button
        onClick={onDelete}
        className="pr-3 pl-1 py-3.5 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── League/System Notification row ────────────────────────────────────────────
function NotificationRow({ notif, isRead, onMarkRead, onDelete }) {
  const isSystemMsg = notif.type === "system_message";

  return (
    <div className="relative flex items-center border-b border-gray-800/50 last:border-0 group">
      {!isRead && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 flex-shrink-0 rounded-full"
          style={{ width: "6px", height: "6px", background: "rgb(var(--ds-primary-rgb))" }}
        />
      )}
      <button
        onClick={onMarkRead}
        className={`flex-1 flex items-center gap-3 py-3.5 hover:bg-gray-800/40 transition-colors text-left ${!isRead ? "pl-5 pr-4" : "px-4"}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isSystemMsg ? "bg-sky-500/10 border border-sky-500/20" : "ds-accent-bg ds-accent-bd border"
        }`}>
          {isSystemMsg
            ? <Bell className="w-4 h-4 text-sky-400" />
            : <Users className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-sm font-medium truncate ${isRead ? "text-gray-300" : "text-white"}`}>
              {isSystemMsg ? "System Message" : notif.leagueName}
            </span>
            <span className="text-gray-500 text-xs shrink-0">
              {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
            </span>
          </div>
          <p className="text-gray-400 text-xs">
            {isSystemMsg
              ? notif.message
              : <><span style={{ color: "var(--ds-primary-text)" }}>{notif.actorName}</span> joined the playgroup</>}
          </p>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="pr-3 pl-1 py-3.5 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── POD Invite row ────────────────────────────────────────────────────────────
function PodInviteRow({ item, onAccept, onReject, onDelete }) {
  const [acting, setActing] = useState(false);
  const { notif } = item;
  const meta = notif.metadata || {};

  async function handleAccept() {
    setActing(true);
    await onAccept(item);
  }

  async function handleReject() {
    setActing(true);
    await onReject(item);
  }

  return (
    <div className="relative flex flex-col border-b border-gray-800/50 last:border-0 group">
      {!item.isRead && (
        <div className="absolute left-2 top-5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      )}
      <div className={`flex items-start gap-3 pt-3.5 pb-2 ${!item.isRead ? "pl-5 pr-4" : "px-4"}`}>
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Layers className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-sm font-semibold ${item.isRead ? "text-gray-300" : "text-white"}`}>POD Invite</span>
            <span className="text-gray-500 text-xs shrink-0">
              {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
            </span>
          </div>
          <p className="text-white text-sm font-medium">{meta.pod_name || "Unknown POD"}</p>
          {meta.pod_code && <p className="text-gray-500 text-xs font-mono">{meta.pod_code}</p>}
          {meta.pod_description && (
            <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{meta.pod_description}</p>
          )}
          {notif.actorName && (
            <p className="text-gray-500 text-xs mt-0.5">Invited by <span style={{ color: "var(--ds-primary-text)" }}>{notif.actorName}</span></p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="pl-1 py-0.5 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {!item.isRead && (
        <div className={`flex gap-2 pb-3.5 ${!item.isRead ? "pl-16 pr-4" : "px-4"}`}>
          <Button
            size="sm"
            disabled={acting}
            className="flex-1 ds-btn-primary h-8 rounded-xl text-xs font-semibold"
            onClick={handleAccept}
          >
            {acting ? "…" : "Accept"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={acting}
            className="flex-1 h-8 rounded-xl text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={handleReject}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ statusFilter, setStatusFilter, typeFilter, setTypeFilter }) {
  const statusOpts = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "read", label: "Read" },
  ];
  const typeOpts = [
    { value: "all", label: "All types" },
    { value: "game_logging", label: "Game approvals" },
    { value: "pod_invite", label: "POD invites" },
    { value: "league_activity", label: "Notifications" },
  ];

  function Chip({ value, current, onClick, children }) {
    const active = value === current;
    return (
      <button
        onClick={() => onClick(value)}
        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
          active
            ? "border text-white"
            : "border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"
        }`}
        style={active ? {
          backgroundColor: "rgb(var(--ds-primary-muted-bg))",
          borderColor: "rgb(var(--ds-primary-muted-bd))",
          color: "var(--ds-primary-text)"
        } : {}}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {statusOpts.map((o) => (
          <Chip key={o.value} value={o.value} current={statusFilter} onClick={setStatusFilter}>
            {o.label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {typeOpts.map((o) => (
          <Chip key={o.value} value={o.value} current={typeFilter} onClick={setTypeFilter}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Inbox() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
      const authUser = await base44.auth.me().catch(() => null);
      const [approvalRows, rawNotifs] = await Promise.all([
        listMyPendingApprovals(auth),
        authUser?.id
          ? base44.entities.Notification.list("-created_date", 100).then(
              (list) => list.filter((n) => n.recipient_user_id === authUser.id)
            )
          : Promise.resolve([]),
      ]);

      const approvalItems = approvalRows.map((row) => ({
        id: `approval-${row.game.id}`,
        type: "game_logging",
        isRead: false,
        createdAt: row.game.played_at,
        approvalRow: row,
      }));

      let notifItems = [];
      if (rawNotifs.length > 0) {
        const uniqueActorIds = [...new Set(rawNotifs.map((n) => n.actor_user_id).filter(Boolean))];
        const [allLeagues, actorResults] = await Promise.all([
          base44.entities.League.list("-created_date", 200),
          Promise.allSettled(uniqueActorIds.map((id) => getPublicProfile(id))),
        ]);
        const leagueMap = Object.fromEntries(allLeagues.map((l) => [l.id, l]));
        const actorMap = {};
        uniqueActorIds.forEach((id, i) => {
          actorMap[id] = actorResults[i].status === "fulfilled"
            ? actorResults[i].value?.display_name || null
            : null;
        });

        notifItems = rawNotifs.map((n) => {
          if (n.type === "pod_invite") {
            return {
              id: n.id,
              type: "pod_invite",
              isRead: !!n.read_at,
              createdAt: n.created_date,
              notif: {
                ...n,
                actorName: actorMap[n.actor_user_id] || null,
                metadata: n.metadata || {},
              },
            };
          }
          // league_join, system_message
          return {
            id: n.id,
            type: "league_activity",
            isRead: !!n.read_at,
            createdAt: n.created_date,
            notif: {
              ...n,
              actorName: actorMap[n.actor_user_id] || "Someone",
              leagueName: leagueMap[n.league_id]?.name || "Unknown League",
            },
          };
        });
      }

      setItems(
        [...approvalItems, ...notifItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
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

  async function markRead(itemId) {
    const item = items.find((it) => it.id === itemId);
    if (!item || item.isRead) return;
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, isRead: true } : it));
    notifyInboxUpdated();
    if (item.type === "league_activity" || item.type === "pod_invite") {
      await base44.entities.Notification.update(item.id, { read_at: new Date().toISOString() });
    }
  }

  async function deleteItem(itemId) {
    const item = items.find((it) => it.id === itemId);
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    notifyInboxUpdated();
    if (item?.type === "league_activity" || item?.type === "pod_invite") {
      await base44.entities.Notification.delete(item.id);
    }
  }

  async function handlePodInviteAccept(item) {
    const membershipId = item.notif.metadata?.membership_id;
    const podName = item.notif.metadata?.pod_name || "POD";
    if (membershipId) {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "active",
        joined_at: new Date().toISOString(),
        decided_at: new Date().toISOString(),
      });
    }
    await base44.entities.Notification.update(item.id, { read_at: new Date().toISOString() });
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    notifyInboxUpdated();
    toast.success(`You joined ${podName}!`);
  }

  async function handlePodInviteReject(item) {
    const membershipId = item.notif.metadata?.membership_id;
    if (membershipId) {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "rejected",
        decided_at: new Date().toISOString(),
      });
    }
    await base44.entities.Notification.update(item.id, { read_at: new Date().toISOString() });
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    notifyInboxUpdated();
  }

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
    if (currentUser?.id) {
      invalidateDashboardCache(currentUser.id);
      invalidateProfileStatsCache(currentUser.id);
      invalidateProfileInsightsCache(currentUser.id);
    }
    closeModal();
    fetchingRef.current = false;
    await loadAll();
  }

  if (authLoading) return <LoadingState message="Loading inbox…" />;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in to view your inbox</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to approve game results and respond to POD invites.
          </p>
        </div>
        <Button className="ds-btn-primary text-white rounded-xl h-11 px-6" onClick={() => base44.auth.redirectToLogin()}>
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
        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; loadAll(); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  const unreadCount = items.filter((it) => !it.isRead).length;

  const filtered = items.filter((it) => {
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "unread" && !it.isRead) ||
      (statusFilter === "read" && it.isRead);
    const typeMatch = typeFilter === "all" || it.type === typeFilter;
    return statusMatch && typeMatch;
  });

  const modalItem = selectedRow
    ? items.find((it) => it.type === "game_logging" && it.approvalRow?.game.id === selectedRow)
    : null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-base">Inbox</h2>
          {unreadCount > 0 && (
            <span className="text-xs bg-amber-500 text-black font-bold rounded-full px-1.5 py-0.5 leading-none">
              {unreadCount}
            </span>
          )}
        </div>

        <FilterBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
        />

        {filtered.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description={
              statusFilter !== "all" || typeFilter !== "all"
                ? "No messages match your current filters."
                : "You're all caught up. Game approvals, POD invites, and notifications will appear here."
            }
          />
        ) : (
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-0">
              {filtered.map((item) => {
                if (item.type === "game_logging") {
                  return (
                    <ApprovalRow
                      key={item.id}
                      row={item.approvalRow}
                      isRead={item.isRead}
                      onClick={() => {
                        markRead(item.id);
                        openModal(item.approvalRow.game.id);
                      }}
                      onDelete={() => deleteItem(item.id)}
                    />
                  );
                }
                if (item.type === "pod_invite") {
                  return (
                    <PodInviteRow
                      key={item.id}
                      item={item}
                      onAccept={handlePodInviteAccept}
                      onReject={handlePodInviteReject}
                      onDelete={() => deleteItem(item.id)}
                    />
                  );
                }
                return (
                  <NotificationRow
                    key={item.id}
                    notif={item.notif}
                    isRead={item.isRead}
                    onMarkRead={() => markRead(item.id)}
                    onDelete={() => deleteItem(item.id)}
                  />
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {modalItem && (
        <MatchDetailsModal
          game={modalItem.approvalRow.game}
          auth={auth}
          leagueId={modalItem.approvalRow.leagueId}
          onClose={closeModal}
          onActionComplete={() => handleActionComplete(modalItem.approvalRow.leagueId)}
        />
      )}
    </>
  );
}