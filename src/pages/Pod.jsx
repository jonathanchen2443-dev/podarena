import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Layers, Trophy, Clock, Info, Users, PlusCircle } from "lucide-react";
import PodLeaderboardTab from "@/components/pods/PodLeaderboardTab";
import PodActivityTab from "@/components/pods/PodActivityTab";
import PodInfoTab from "@/components/pods/PodInfoTab";
import EditPodModal from "@/components/pods/EditPodModal";
import { getMyMembership, requestJoinPOD } from "@/components/services/podService";
import { ROUTES } from "@/components/utils/routes";
import { toast } from "sonner";

const TABS = [
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "activity", label: "Activity", icon: Clock },
  { key: "info", label: "Info", icon: Info },
];

export default function Pod() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const podId = params.get("podId");
  const inviteFlag = params.get("invite") === "1";

  const [pod, setPod] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [showEditModal, setShowEditModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);

  const load = useCallback(async () => {
    if (!podId) return;
    setLoading(true);
    try {
      const podData = await base44.entities.POD.get(podId).catch(() => null);
      if (!podData) { navigate(createPageUrl("MyPods")); return; }
      setPod(podData);

      const activeMembers = await base44.entities.PODMembership.filter({ pod_id: podId, membership_status: "active" });
      setActiveMemberCount(activeMembers.length);

      if (!isGuest && currentUser && authUserId) {
        const membership = await getMyMembership(podId, authUserId);
        setMyMembership(membership);

        // Handle invite flow
        if (inviteFlag && (!membership || ["rejected", "left", "removed"].includes(membership?.membership_status))) {
          try {
            await base44.entities.PODMembership.create({
              pod_id: podId,
              user_id: authUserId,       // Auth User ID — for RLS
              profile_id: currentUser.id, // Profile ID — for display/joins
              role: "member",
              membership_status: "invited_pending",
              source: "invite",
              invited_at: new Date().toISOString(),
              is_favorite: false,
            });
            const updated = await getMyMembership(podId, authUserId);
            setMyMembership(updated);
            toast.success("Invite received! Waiting for admin approval.");
          } catch (_) {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, [podId, isGuest, currentUser, authUserId, inviteFlag]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleRequestJoin() {
    if (!currentUser || isGuest) { base44.auth.redirectToLogin(); return; }
    setRequesting(true);
    try {
      const authUser = await base44.auth.me();
      await requestJoinPOD(podId, authUser.id, currentUser.id);
      const updated = await getMyMembership(podId, authUser.id);
      setMyMembership(updated);
      toast.success("Join request sent! Waiting for admin approval.");
    } catch (err) {
      toast.error(err.message || "Failed to send request.");
    } finally {
      setRequesting(false);
    }
  }

  function handlePodUpdated() {
    load();
  }

  function handleLeft() {
    navigate(createPageUrl("MyPods"));
  }

  // Open match details if MatchDetailsModal is available
  function handleOpenGame(gameId) {
    setSelectedGameId(gameId);
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!pod) return null;

  const isActiveMember = myMembership?.membership_status === "active";
  const hasPendingOrInvite = myMembership && ["pending_request", "invited_pending"].includes(myMembership.membership_status);
  const canRequestJoin = !isGuest && !isActiveMember && !hasPendingOrInvite;

  return (
    <div className="space-y-0 pb-4">
      {/* POD Identity Card */}
      <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 mb-4">
        <div className="flex gap-4 items-start">
          {pod.image_url ? (
            <img src={pod.image_url} alt={pod.pod_name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
              <Layers className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight">{pod.pod_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md">{pod.pod_code}</span>
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Users className="w-3 h-3" />
                {activeMemberCount}/{pod.max_members}
              </span>
            </div>
            {pod.description && <p className="text-gray-400 text-xs mt-2 line-clamp-2">{pod.description}</p>}
          </div>
        </div>

        {/* Join CTA for non-members */}
        {canRequestJoin && (
          <Button
            onClick={handleRequestJoin}
            disabled={requesting}
            className="w-full ds-btn-primary h-10 rounded-xl text-sm font-semibold mt-3"
          >
            {requesting ? "Sending request…" : "Request to Join"}
          </Button>
        )}
        {!isGuest && !isActiveMember && hasPendingOrInvite && (
          <div className="mt-3 text-center text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl py-2">
            {myMembership.membership_status === "pending_request" ? "Request pending admin approval" : "Invite pending admin approval"}
          </div>
        )}
        {isGuest && (
          <Button onClick={() => base44.auth.redirectToLogin()} className="w-full ds-btn-primary h-10 rounded-xl text-sm font-semibold mt-3">
            Sign in to Join
          </Button>
        )}

      </div>

      {/* Tabs */}
      <div className="flex gap-0 bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden mb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${active ? "text-white border-b-2" : "text-gray-500 hover:text-gray-300"}`}
              style={active ? { borderBottomColor: "rgb(var(--ds-primary-rgb))" } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "leaderboard" && (
        <PodLeaderboardTab pod={pod} myMembership={myMembership} podId={podId} />
      )}
      {activeTab === "activity" && (
        <PodActivityTab podId={podId} onOpenGame={handleOpenGame} />
      )}
      {activeTab === "info" && (
        <PodInfoTab
          pod={pod}
          myMembership={myMembership}
          podId={podId}
          onPodUpdated={handlePodUpdated}
          onLeft={handleLeft}
          onOpenEdit={() => setShowEditModal(true)}
        />
      )}

      {showEditModal && (
        <EditPodModal
          pod={pod}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => { setShowEditModal(false); load(); }}
        />
      )}
    </div>
  );
}