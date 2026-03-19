import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Users, Crown, Share2, LogOut, Settings, Check, X, AlertCircle, Copy, Link } from "lucide-react";
import {
  acceptJoinRequest,
  rejectJoinRequest,
  leavePOD,
  removeMember,
} from "@/components/services/podService";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

function MemberRow({ membership, profile, isAdmin, canManage, onRemove }) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${profile?.display_name || "this member"} from the POD?`)) return;
    setRemoving(true);
    try {
      await onRemove(membership.id);
      toast.success("Member removed.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/30 last:border-0">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-400 flex-shrink-0">
          {(profile?.display_name || "?")[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{profile?.display_name || "Unknown"}</p>
        {isAdmin && <span className="text-xs text-amber-400 font-medium">Admin</span>}
      </div>
      {canManage && !isAdmin && (
        <button onClick={handleRemove} disabled={removing} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function PendingRequestRow({ membership, profile, onAccept, onReject }) {
  const [acting, setActing] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/30 last:border-0">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-400 flex-shrink-0">
          {(profile?.display_name || "?")[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{profile?.display_name || "Unknown"}</p>
        <p className="text-gray-500 text-xs">Requesting to join</p>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={async () => { setActing(true); await onAccept(membership.id); setActing(false); }}
          disabled={acting}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={async () => { setActing(true); await onReject(membership.id); setActing(false); }}
          disabled={acting}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function PodInfoTab({ pod, myMembership, podId, onPodUpdated, onLeft, onOpenEdit }) {
  const { currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isAdmin = myMembership?.role === "admin" && myMembership?.membership_status === "active";
  const isActiveMember = myMembership?.membership_status === "active";

  useEffect(() => {
    if (!currentUser?.id || myMembership?.membership_status !== "active") { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'podMembers',
          podId,
          callerProfileId: currentUser.id,
        });
        setMembers(res.data?.members || []);
        setPendingRequests(res.data?.pendingRequests || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [podId, currentUser?.id, myMembership?.membership_status]);

  async function handleAccept(membershipId) {
    await acceptJoinRequest(membershipId);
    setPendingRequests((prev) => prev.filter((m) => m.id !== membershipId));
    const updated = await base44.entities.PODMembership.filter({ id: membershipId });
    if (updated[0]) setMembers((prev) => [...prev, updated[0]]);
    toast.success("Member approved!");
    onPodUpdated?.();
  }

  async function handleReject(membershipId) {
    await rejectJoinRequest(membershipId);
    setPendingRequests((prev) => prev.filter((m) => m.id !== membershipId));
    toast.success("Request rejected.");
  }

  async function handleRemoveMember(membershipId) {
    await removeMember(membershipId);
    setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    onPodUpdated?.();
  }

  async function handleLeave() {
    if (!myMembership) return;
    setLeaving(true);
    try {
      await leavePOD(myMembership.id);
      toast.success("You have left the POD.");
      onLeft?.();
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  async function handleInvite() {
    const url = `${window.location.origin}${createPageUrl("Pod")}?podId=${podId}&invite=1`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${pod.pod_name} on PodArena`, text: `Join my POD "${pod.pod_name}" (${pod.pod_code}) on PodArena!`, url });
        return;
      } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard!");
    } catch (_) {
      toast.error("Copy failed — link: " + url);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      {pod.description && (
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
          <p className="text-gray-300 text-sm leading-relaxed">{pod.description}</p>
        </div>
      )}

      {/* Active members */}
      <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-white text-sm font-medium">Members</span>
          </div>
          <span className="text-gray-500 text-xs">{members.length}/{pod.max_members}</span>
        </div>
        {members.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">No active members yet.</div>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.id}
              membership={m}
              profile={{ display_name: m.display_name, avatar_url: m.avatar_url }}
              isAdmin={m.role === "admin"}
              canManage={isAdmin && m.user_id !== myMembership?.user_id}
              onRemove={handleRemoveMember}
            />
          ))
        )}
      </div>

      {/* Pending requests (admin only) */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-gray-900/60 border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-amber-400 text-sm font-medium">Pending Requests ({pendingRequests.length})</span>
          </div>
          {pendingRequests.map((m) => (
            <PendingRequestRow
              key={m.id}
              membership={m}
              profile={profiles[m.profile_id]}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {isActiveMember && (
          <Button onClick={handleInvite} variant="outline" className="w-full h-10 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Invite to POD
          </Button>
        )}
        {isAdmin && (
          <Button onClick={onOpenEdit} variant="outline" className="w-full h-10 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Edit POD
          </Button>
        )}
        {isActiveMember && !isAdmin && (
          <>
            {showLeaveConfirm ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
                <p className="text-red-400 text-sm text-center">Leave this POD? Your game history will be preserved.</p>
                <div className="flex gap-2">
                  <Button onClick={() => setShowLeaveConfirm(false)} variant="outline" size="sm" className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
                  <Button onClick={handleLeave} disabled={leaving} size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    {leaving ? "Leaving…" : "Confirm Leave"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowLeaveConfirm(true)} variant="outline" className="w-full h-10 rounded-xl text-sm border-red-800/40 text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Leave POD
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}