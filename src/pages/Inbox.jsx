import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { listMyPendingApprovals, approveGame, rejectGame } from "@/components/services/gameService";
import { notifyInboxUpdated } from "@/components/services/inboxBus";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, XCircle, Layers, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Inbox() {
  const { currentUser, isGuest, authLoading } = useAuth();
  const [authUserId, setAuthUserId] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [podInvites, setPodInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({});

  const load = useCallback(async () => {
    if (!currentUser || isGuest) { setLoading(false); return; }
    setLoading(true);
    try {
      const authUser = await base44.auth.me().catch(() => null);
      const aUid = authUser?.id || null;
      if (aUid) setAuthUserId(aUid);

      const [approvalsData, notifs] = await Promise.all([
        listMyPendingApprovals({ isGuest: false, currentUser, isAuthenticated: true }),
        aUid
          ? base44.entities.Notification.list("-created_date", 100).then((list) =>
              list.filter(
                (n) =>
                  n.recipient_user_id === aUid &&
                  n.type === "pod_invite" &&
                  !n.read_at
              )
            )
          : Promise.resolve([]),
      ]);
      setApprovals(approvalsData);
      setPodInvites(notifs);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isGuest]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  // ── Game approval actions ──────────────────────────────────────────────────
  async function handleApprove(item) {
    setActing((prev) => ({ ...prev, [item.approvalId]: true }));
    try {
      await approveGame(item.game.id, authUserId, currentUser.id, null);
      toast.success("Game approved!");
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to approve.");
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[item.approvalId]; return n; });
    }
  }

  async function handleReject(item) {
    setActing((prev) => ({ ...prev, [item.approvalId]: true }));
    try {
      await rejectGame(item.game.id, authUserId, currentUser.id, "");
      toast.success("Game rejected.");
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to reject.");
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[item.approvalId]; return n; });
    }
  }

  // ── POD invite actions ─────────────────────────────────────────────────────
  async function handleAcceptInvite(notif) {
    const membershipId = notif.metadata?.membership_id;
    if (!membershipId) { toast.error("Invite data missing — cannot accept."); return; }
    setActing((prev) => ({ ...prev, [notif.id]: true }));
    try {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "active",
        joined_at: new Date().toISOString(),
        decided_at: new Date().toISOString(),
      });
      await base44.entities.Notification.update(notif.id, {
        read_at: new Date().toISOString(),
      });
      toast.success(`Joined ${notif.metadata?.pod_name || "POD"}!`);
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to accept invite.");
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[notif.id]; return n; });
    }
  }

  async function handleDeclineInvite(notif) {
    const membershipId = notif.metadata?.membership_id;
    if (!membershipId) { toast.error("Invite data missing — cannot decline."); return; }
    setActing((prev) => ({ ...prev, [notif.id]: true }));
    try {
      await base44.entities.PODMembership.update(membershipId, {
        membership_status: "rejected",
        decided_at: new Date().toISOString(),
      });
      await base44.entities.Notification.update(notif.id, {
        read_at: new Date().toISOString(),
      });
      toast.success("Invite declined.");
      await load();
      notifyInboxUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to decline invite.");
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[notif.id]; return n; });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

  const total = approvals.length + podInvites.length;

  return (
    <div className="space-y-5 pb-6">
      <div className="pt-3">
        <h1 className="text-white font-bold text-xl">Inbox</h1>
        {total > 0 ? (
          <p className="text-gray-400 text-sm mt-0.5">
            {total} item{total !== 1 ? "s" : ""} need your attention
          </p>
        ) : null}
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="text-center py-16 space-y-3">
          <Bell className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-400 text-sm">You're all caught up!</p>
        </div>
      )}

      {/* ── POD Invites ────────────────────────────────────────────────────── */}
      {podInvites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            POD Invites
          </h2>
          {podInvites.map((notif) => {
            const meta = notif.metadata || {};
            const isActing = !!acting[notif.id];
            const timeAgo = notif.created_date
              ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })
              : "";
            return (
              <div
                key={notif.id}
                className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-tight">
                      {meta.pod_name || "POD Invite"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">
                        {meta.pod_code}
                      </span>
                    </div>
                    {meta.pod_description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                        {meta.pod_description}
                      </p>
                    )}
                  </div>
                  {timeAgo && (
                    <span className="text-xs text-gray-600 flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {timeAgo}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAcceptInvite(notif)}
                    disabled={isActing}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: "rgb(var(--ds-primary-rgb))", color: "#fff" }}
                  >
                    {isActing ? "…" : "Accept"}
                  </Button>
                  <Button
                    onClick={() => handleDeclineInvite(notif)}
                    disabled={isActing}
                    variant="outline"
                    className="flex-1 h-9 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
                  >
                    {isActing ? "…" : "Decline"}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Game Approvals ──────────────────────────────────────────────────── */}
      {approvals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Game Approvals
          </h2>
          {approvals.map((item) => {
            const isActing = !!acting[item.approvalId];
            const dateStr = item.game.played_at
              ? formatDistanceToNow(new Date(item.game.played_at), { addSuffix: true })
              : "";
            return (
              <div
                key={item.approvalId}
                className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-semibold">{item.leagueName}</span>
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {item.contextType}
                      </span>
                    </div>
                    {item.submittedByName && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Submitted by {item.submittedByName}
                      </p>
                    )}
                  </div>
                  {dateStr && (
                    <span className="text-xs text-gray-600 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {dateStr}
                    </span>
                  )}
                </div>

                {/* Participants */}
                <div className="flex flex-wrap gap-2">
                  {item.game.participants.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center gap-1.5 bg-gray-800/70 rounded-xl px-2 py-1"
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Users className="w-2.5 h-2.5 text-gray-500" />
                        </div>
                      )}
                      <span className="text-xs text-white">{p.display_name}</span>
                      {p.placement && (
                        <span className="text-xs text-gray-500">#{p.placement}</span>
                      )}
                    </div>
                  ))}
                </div>

                {item.game.notes ? (
                  <p className="text-xs text-gray-500 italic">"{item.game.notes}"</p>
                ) : null}

                <p className="text-xs text-gray-600">
                  {item.game.approvalSummary.approved}/{item.game.approvalSummary.total} approved
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(item)}
                    disabled={isActing}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: "rgb(var(--ds-primary-rgb))", color: "#fff" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isActing ? "…" : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleReject(item)}
                    disabled={isActing}
                    variant="outline"
                    className="flex-1 h-9 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {isActing ? "…" : "Reject"}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}