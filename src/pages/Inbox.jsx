import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { listMyPendingApprovals } from "@/components/services/gameService";
import { notifyInboxUpdated } from "@/components/services/inboxBus";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import GameApprovalCard from "@/components/inbox/GameApprovalCard";
import PodInviteCard from "@/components/inbox/PodInviteCard";
import SystemNotifCard from "@/components/inbox/SystemNotifCard";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";

const FILTERS = ["All", "Unread", "Game Approvals", "POD Invites", "System"];

export default function Inbox() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();

  // data
  const [approvals, setApprovals] = useState([]);
  const [notifications, setNotifications] = useState([]); // pod_invite + system_message

  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({});
  const [reviewModal, setReviewModal] = useState(null); // { gameId }

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentUser || isGuest || !authUserId) { setLoading(false); return; }
    setLoading(true);
    try {
      // authUserId comes from context (profile.user_id = Auth User ID) — no extra me() call needed
      const [approvalsData, allNotifs] = await Promise.all([
        listMyPendingApprovals({ isGuest: false, currentUser, authUserId, isAuthenticated: true }),
        base44.entities.Notification.list("-created_date", 200).then((list) =>
          list.filter((n) => n.recipient_user_id === authUserId)
        ),
      ]);
      setApprovals(approvalsData);
      setNotifications(allNotifs);
    } finally {
      setLoading(false);
    }
  }, [currentUser, authUserId, isGuest]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setItemActing(id, val) {
    setActing((prev) => {
      if (val) return { ...prev, [id]: true };
      const n = { ...prev }; delete n[id]; return n;
    });
  }

  // ── Game Review actions ───────────────────────────────────────────────────
  // "Review & Approve" opens the full modal where the user must pick their deck first.
  // "Reject" is a quick action directly from the card (no deck needed).
  function handleApprove(item) {
    // Open the review modal so user can select their deck before approving
    setReviewModal({ gameId: item.game.id });
  }

  async function handleReject(item) {
    const { rejectGame } = await import("@/components/services/gameService");
    setItemActing(item.approvalId || item.gameParticipantId, true);
    try {
      await rejectGame(item.game.id, authUserId, currentUser.id, "");
      toast.success("Game rejected.");
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to reject.");
    } finally {
      setItemActing(item.approvalId || item.gameParticipantId, false);
    }
  }

  // ── POD Invite actions ────────────────────────────────────────────────────
  async function handleAcceptInvite(notif) {
    const membershipId = notif.metadata?.membership_id;
    if (!membershipId) { toast.error("Invite data missing — cannot accept."); return; }
    setItemActing(notif.id, true);
    try {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "active",
        joined_at: new Date().toISOString(),
        decided_at: new Date().toISOString(),
      });
      await base44.entities.Notification.update(notif.id, { read_at: new Date().toISOString() });
      toast.success(`Joined ${notif.metadata?.pod_name || "POD"}!`);
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to accept invite.");
    } finally {
      setItemActing(notif.id, false);
    }
  }

  async function handleDeclineInvite(notif) {
    const membershipId = notif.metadata?.membership_id;
    if (!membershipId) { toast.error("Invite data missing — cannot decline."); return; }
    setItemActing(notif.id, true);
    try {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "rejected",
        decided_at: new Date().toISOString(),
      });
      await base44.entities.Notification.update(notif.id, { read_at: new Date().toISOString() });
      toast.success("Invite declined.");
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to decline invite.");
    } finally {
      setItemActing(notif.id, false);
    }
  }

  // ── General notification actions ──────────────────────────────────────────
  async function handleMarkRead(notif) {
    setItemActing(notif.id, true);
    try {
      await base44.entities.Notification.update(notif.id, { read_at: new Date().toISOString() });
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
      notifyInboxUpdated();
    } catch (err) {
      toast.error("Failed to mark read.");
    } finally {
      setItemActing(notif.id, false);
    }
  }

  async function handleMarkUnread(notif) {
    setItemActing(notif.id, true);
    try {
      await base44.entities.Notification.update(notif.id, { read_at: null });
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read_at: null } : n));
      notifyInboxUpdated();
    } catch (err) {
      toast.error("Failed to mark unread.");
    } finally {
      setItemActing(notif.id, false);
    }
  }

  async function handleDelete(notif) {
    setItemActing(notif.id, true);
    try {
      await base44.entities.Notification.delete(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      notifyInboxUpdated();
    } catch (err) {
      toast.error("Failed to delete.");
    } finally {
      setItemActing(notif.id, false);
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const podInvites = notifications.filter((n) => n.type === "pod_invite");
  const systemNotifs = notifications.filter((n) => n.type === "system_message" || n.type === "league_join" || !n.type);

  // Unread counts — approvals are always "unread" until handled; invites/system by read_at
  const unreadApprovals = approvals.length;
  const unreadInvites = podInvites.filter((n) => !n.read_at).length;
  const unreadSystem = systemNotifs.filter((n) => !n.read_at).length;
  const totalUnread = unreadApprovals + unreadInvites + unreadSystem;

  // Filtered views
  const showApprovals = filter === "All" || filter === "Unread" || filter === "Game Approvals";
  const showInvites = filter === "All" || filter === "Unread" || filter === "POD Invites";
  const showSystem = filter === "All" || filter === "System";

  const visibleApprovals = showApprovals ? approvals : [];
  const visibleInvites = showInvites
    ? (filter === "Unread" ? podInvites.filter((n) => !n.read_at) : podInvites)
    : [];
  const visibleSystem = showSystem
    ? (filter === "Unread" ? systemNotifs.filter((n) => !n.read_at) : systemNotifs)
    : [];

  const totalVisible = visibleApprovals.length + visibleInvites.length + visibleSystem.length;

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="space-y-4 pt-3">
        <h1 className="text-white font-bold text-xl">Inbox</h1>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="text-center py-20 space-y-3">
        <Bell className="w-10 h-10 text-gray-700 mx-auto" />
        <p className="text-gray-400">Sign in to see your inbox.</p>
        <Button onClick={() => base44.auth.redirectToLogin()} className="ds-btn-primary">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Title */}
      <div className="pt-3">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-bold text-xl">Inbox</h1>
          {totalUnread > 0 && (
            <span className="min-w-[22px] h-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center px-1">
              {totalUnread}
            </span>
          )}
        </div>
        {totalUnread > 0 && (
          <p className="text-gray-400 text-sm mt-0.5">{totalUnread} unread</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f;
          const badge = f === "All" ? totalUnread
            : f === "Unread" ? totalUnread
            : f === "Game Approvals" ? unreadApprovals
            : f === "POD Invites" ? unreadInvites
            : f === "System" ? unreadSystem
            : 0;
          // Shorten long labels for mobile
          const label = f === "Game Approvals" ? "Approvals" : f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive ? "text-white" : "bg-gray-800/60 text-gray-400 hover:bg-gray-800"
              }`}
              style={isActive ? { backgroundColor: "rgb(var(--ds-primary-rgb))" } : {}}
            >
              {label}
              {badge > 0 && (
                <span
                  className={`min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-0.5 ${
                    isActive ? "bg-white/20 text-white" : "bg-amber-500 text-black"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {totalVisible === 0 && (
        <div className="text-center py-16 space-y-3">
          <Bell className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-400 text-sm">
            {filter === "Unread" ? "Nothing unread — you're all caught up!" : "Nothing here yet."}
          </p>
        </div>
      )}

      {/* ── Game Approvals ────────────────────────────────────────────────────── */}
      {visibleApprovals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Game Approvals
          </h2>
          {visibleApprovals.map((item) => (
            <GameApprovalCard
              key={item.approvalId}
              item={item}
              acting={acting}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </section>
      )}

      {/* ── POD Invites ───────────────────────────────────────────────────────── */}
      {visibleInvites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            POD Invites
          </h2>
          {visibleInvites.map((notif) => (
            <PodInviteCard
              key={notif.id}
              notif={notif}
              acting={acting}
              onAccept={handleAcceptInvite}
              onDecline={handleDeclineInvite}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
            />
          ))}
        </section>
      )}

      {/* ── System Notifications ─────────────────────────────────────────────── */}
      {visibleSystem.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Notifications
          </h2>
          {visibleSystem.map((notif) => (
            <SystemNotifCard
              key={notif.id}
              notif={notif}
              acting={acting}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      {/* Game review modal — opened when user clicks "Review & Approve" */}
      {reviewModal && (
        <MatchDetailsModal
          gameId={reviewModal.gameId}
          auth={{ currentUser, authUserId, isGuest }}
          onClose={() => setReviewModal(null)}
          onActionComplete={async () => {
            setReviewModal(null);
            await load();
            notifyInboxUpdated();
          }}
        />
      )}
    </div>
  );
}