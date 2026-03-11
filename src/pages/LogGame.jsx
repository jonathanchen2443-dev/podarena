import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Swords, User, AlertCircle, Layers, Search, X } from "lucide-react";
import { createGameWithParticipants } from "@/components/services/gameService";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import { toast } from "sonner";

function PlacementRow({ participant, placement, totalParticipants, onSetPlacement }) {
  return (
    <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2">
      {participant.avatar_url ? (
        <img src={participant.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-gray-400" />
        </div>
      )}
      <span className="flex-1 text-sm text-white truncate">{participant.display_name}</span>
      <div className="flex gap-1">
        {Array.from({ length: totalParticipants }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSetPlacement(p)}
            className={`w-8 h-7 rounded-lg text-xs font-semibold transition-colors ${
              placement === p ? "text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
            style={placement === p ? { backgroundColor: "rgb(var(--ds-primary-rgb))" } : {}}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LogGame() {
  const { currentUser, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();

  // URL-locked POD mode (entered from a specific POD page)
  const urlParams = new URLSearchParams(window.location.search);
  const urlContextType = urlParams.get("contextType") || "casual";
  const urlPodId = urlParams.get("podId") || null;
  const urlPodNameRaw = urlParams.get("podName");
  const urlPodName = urlPodNameRaw ? decodeURIComponent(urlPodNameRaw) : null;
  const urlPodCodeRaw = urlParams.get("podCode");
  const urlPodCode = urlPodCodeRaw ? decodeURIComponent(urlPodCodeRaw) : null;
  const isLockedPodMode = urlContextType === "pod" && !!urlPodId;

  // Local mode state (only used when NOT locked to a specific POD from URL)
  const [localMode, setLocalMode] = useState("casual"); // "casual" | "pod"
  const [myActivePods, setMyActivePods] = useState([]);
  const [myPodsLoading, setMyPodsLoading] = useState(false);
  const [podQuery, setPodQuery] = useState("");
  const [selectedPodLocal, setSelectedPodLocal] = useState(null);

  // Participant state
  const [selectedIds, setSelectedIds] = useState([]);
  const [participantData, setParticipantData] = useState({});
  const [placements, setPlacements] = useState({});
  const [podMembers, setPodMembers] = useState([]);
  const [podMembersLoading, setPodMembersLoading] = useState(isLockedPodMode);
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Effective pod context
  const isInPodMode = isLockedPodMode || (localMode === "pod" && !!selectedPodLocal);
  const effectivePodId = urlPodId || (selectedPodLocal?.id || null);
  const effectivePodName = urlPodName || (selectedPodLocal?.pod_name || null);
  const effectivePodCode = urlPodCode || (selectedPodLocal?.pod_code || null);

  // Auto-add current user in casual mode
  useEffect(() => {
    if (isInPodMode || !currentUser) return;
    const data = {
      profileId: currentUser.id,
      authUserId: currentUser.user_id || null,
      display_name: currentUser.display_name || "You",
      avatar_url: currentUser.avatar_url || null,
    };
    setSelectedIds([currentUser.id]);
    setParticipantData({ [currentUser.id]: data });
  }, [isInPodMode, currentUser?.id]);

  // Load POD members when in any POD mode
  useEffect(() => {
    if (!isInPodMode || !currentUser || !effectivePodId) {
      if (!isLockedPodMode) setPodMembersLoading(false);
      return;
    }
    async function loadMembers() {
      setPodMembersLoading(true);
      try {
        const allMemberships = await base44.entities.PODMembership.list("-created_date", 200);
        const active = allMemberships.filter(
          (m) => m.pod_id === effectivePodId && m.membership_status === "active"
        );
        const profileIds = active.map((m) => m.profile_id).filter(Boolean);
        const profiles = await base44.entities.Profile.list("-created_date", 200);
        const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        const members = profileIds
          .map((pid) => {
            const p = profileMap[pid];
            if (!p) return null;
            return {
              profileId: pid,
              authUserId: p.user_id || null,
              display_name: p.display_name || "Unknown",
              avatar_url: p.avatar_url || null,
            };
          })
          .filter(Boolean);
        setPodMembers(members);
        const selfMember = members.find((m) => m.profileId === currentUser.id);
        if (selfMember) {
          setSelectedIds([currentUser.id]);
          setParticipantData({ [currentUser.id]: selfMember });
        }
      } finally {
        setPodMembersLoading(false);
      }
    }
    loadMembers();
  }, [isLockedPodMode, effectivePodId, currentUser?.id, localMode, selectedPodLocal?.id]);

  // Load user's active PODs for local POD mode search
  useEffect(() => {
    if (isLockedPodMode || localMode !== "pod" || !currentUser || myActivePods.length > 0) return;
    async function loadMyPods() {
      setMyPodsLoading(true);
      try {
        const authUser = await base44.auth.me().catch(() => null);
        if (!authUser?.id) return;
        const allMemberships = await base44.entities.PODMembership.list("-created_date", 100);
        const myActive = allMemberships.filter(
          (m) => m.user_id === authUser.id && m.membership_status === "active"
        );
        const podIds = [...new Set(myActive.map((m) => m.pod_id))];
        const podResults = await Promise.all(
          podIds.map((id) => base44.entities.POD.get(id).catch(() => null))
        );
        setMyActivePods(podResults.filter(Boolean).filter((p) => p.status === "active"));
      } finally {
        setMyPodsLoading(false);
      }
    }
    loadMyPods();
  }, [isLockedPodMode, localMode, currentUser?.id]);

  const filteredMyPods = myActivePods.filter((p) => {
    if (!podQuery.trim()) return false; // only show results when searching
    const q = podQuery.toLowerCase();
    return p.pod_name.toLowerCase().includes(q) || p.pod_code.toLowerCase().includes(q);
  });

  function switchToCasual() {
    setLocalMode("casual");
    setSelectedPodLocal(null);
    setPodMembers([]);
    setPodQuery("");
    setPlacements({});
    if (currentUser) {
      const data = {
        profileId: currentUser.id,
        authUserId: currentUser.user_id || null,
        display_name: currentUser.display_name || "You",
        avatar_url: currentUser.avatar_url || null,
      };
      setSelectedIds([currentUser.id]);
      setParticipantData({ [currentUser.id]: data });
    }
  }

  function switchToPod() {
    setLocalMode("pod");
    setSelectedIds([]);
    setParticipantData({});
    setPlacements({});
  }

  function handleAddParticipant(profileId, data) {
    if (selectedIds.includes(profileId)) return;
    setSelectedIds((prev) => [...prev, profileId]);
    setParticipantData((prev) => ({ ...prev, [profileId]: data }));
  }

  function handleRemoveParticipant(profileId) {
    setSelectedIds((prev) => prev.filter((id) => id !== profileId));
    setParticipantData((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
    setPlacements((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
  }

  function togglePodMember(member) {
    if (member.profileId === currentUser?.id) return;
    if (selectedIds.includes(member.profileId)) {
      handleRemoveParticipant(member.profileId);
    } else {
      handleAddParticipant(member.profileId, member);
    }
  }

  function setPlacement(profileId, p) {
    setPlacements((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === p) delete next[k]; });
      next[profileId] = p;
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (selectedIds.length < 2) { setError("At least 2 participants are required."); return; }
    if (selectedIds.length > 4) { setError("Maximum 4 participants allowed."); return; }
    const assigned = Object.values(placements);
    const unique = new Set(assigned);
    if (unique.size !== selectedIds.length) { setError("Each player must have a unique placement (no ties)."); return; }
    for (let i = 1; i <= selectedIds.length; i++) {
      if (!unique.has(i)) { setError(`Assign placements 1 through ${selectedIds.length} — missing position ${i}.`); return; }
    }
    setSubmitting(true);
    try {
      const authUser = await base44.auth.me();
      const participants = selectedIds.map((pid) => ({
        profileId: pid,
        authUserId: participantData[pid]?.authUserId || null,
        placement: placements[pid],
        result: placements[pid] === 1 ? "win" : "loss",
      }));
      await createGameWithParticipants({
        podId: isInPodMode ? effectivePodId : null,
        contextType: isInPodMode ? "pod" : "casual",
        creatorProfileId: currentUser.id,
        creatorAuthUserId: authUser.id,
        playedAt: new Date(playedAt).toISOString(),
        notes,
        participants,
      });
      toast.success("Game logged! Awaiting participant approval.");
      navigate(
        isInPodMode && effectivePodId
          ? `${createPageUrl("Pod")}?podId=${effectivePodId}`
          : createPageUrl("Dashboard")
      );
    } catch (err) {
      setError(err.message || "Failed to log game.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (isGuest || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-gray-400 text-sm">Sign in to log a game.</p>
        <Button className="ds-btn-primary rounded-xl" onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  const backTo = isInPodMode && effectivePodId
    ? `${createPageUrl("Pod")}?podId=${effectivePodId}`
    : createPageUrl("Dashboard");

  return (
    <div className="space-y-5 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backTo)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5" />
            Log Game
          </h1>
          {isLockedPodMode && effectivePodName && (
            <p className="text-xs text-gray-500">
              POD: <span style={{ color: "var(--ds-primary-text)" }}>{effectivePodName}</span>
              {effectivePodCode && <span className="text-gray-600 font-mono ml-1">· {effectivePodCode}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Mode Switch — only shown when NOT locked from a POD URL */}
      {!isLockedPodMode && (
        <div className="flex gap-1 p-1 bg-gray-900/80 border border-gray-800/60 rounded-xl">
          <button
            type="button"
            onClick={switchToCasual}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
              localMode === "casual"
                ? "text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
            style={localMode === "casual" ? { backgroundColor: "rgb(var(--ds-primary-rgb))" } : {}}
          >
            Casual
          </button>
          <button
            type="button"
            onClick={switchToPod}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
              localMode === "pod"
                ? "text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
            style={localMode === "pod" ? { backgroundColor: "rgb(var(--ds-primary-rgb))" } : {}}
          >
            POD Game
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* POD Selector — only in local POD mode, before a pod is selected */}
        {!isLockedPodMode && localMode === "pod" && !selectedPodLocal && (
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
              Select POD <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">Only your active PODs are shown.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                value={podQuery}
                onChange={(e) => setPodQuery(e.target.value)}
                placeholder="Search by POD name or PODID…"
                className="w-full pl-9 pr-4 h-10 bg-gray-900 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
              />
            </div>
            {podQuery.trim() && (
              <div className="mt-1.5 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                {myPodsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredMyPods.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No matching PODs found.</p>
                ) : (
                  filteredMyPods.map((pod) => (
                    <button
                      key={pod.id}
                      type="button"
                      onClick={() => { setSelectedPodLocal(pod); setPodQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/60 text-left border-b border-gray-800/50 last:border-0 transition-colors"
                    >
                      <Layers className="w-5 h-5 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
                      <div>
                        <p className="text-white text-sm font-medium">{pod.pod_name}</p>
                        <p className="text-gray-500 text-xs font-mono">{pod.pod_code}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected POD display (local mode, pod chosen) */}
        {!isLockedPodMode && localMode === "pod" && selectedPodLocal && (
          <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <Layers className="w-5 h-5 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{selectedPodLocal.pod_name}</p>
              <p className="text-gray-500 text-xs font-mono">{selectedPodLocal.pod_code}</p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPodLocal(null); setPodQuery(""); setPodMembers([]); setSelectedIds([]); setParticipantData({}); setPlacements({}); }}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300 rounded-full hover:bg-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Participants */}
        {(localMode === "casual" || (localMode === "pod" && selectedPodLocal) || isLockedPodMode) && (
          <div>
            {isInPodMode ? (
              <>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
                  Who Played? <span className="text-red-400">*</span>
                  <span className="text-gray-600 normal-case ml-1">(min 2)</span>
                </label>
                <p className="text-xs text-gray-600 mb-2">Only active members of this POD can be added.</p>
                {podMembersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : podMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center">No active POD members found.</p>
                ) : (
                  <div className="space-y-1.5">
                    {podMembers.map((member) => {
                      const isSelected = selectedIds.includes(member.profileId);
                      const isSelf = member.profileId === currentUser?.id;
                      return (
                        <button
                          key={member.profileId}
                          type="button"
                          onClick={() => togglePodMember(member)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                            isSelected
                              ? "border-[rgba(92,124,250,0.4)]"
                              : "bg-gray-900/60 border-gray-800/50 text-gray-400 hover:bg-gray-800/60"
                          }`}
                          style={isSelected ? { backgroundColor: "rgba(var(--ds-primary-rgb),0.1)" } : {}}
                        >
                          {member.avatar_url ? (
                            <img src={member.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                          )}
                          <span className={`flex-1 text-sm ${isSelected ? "text-white" : ""}`}>
                            {member.display_name}{isSelf ? " (you)" : ""}
                          </span>
                          {isSelected && <span className="text-xs font-medium" style={{ color: "var(--ds-primary-text)" }}>✓ Playing</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <CasualParticipantPicker
                selectedIds={selectedIds}
                onAdd={handleAddParticipant}
                onRemove={handleRemoveParticipant}
                currentUserProfileId={currentUser?.id}
              />
            )}
          </div>
        )}

        {/* Placements */}
        {selectedIds.length >= 2 && (
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
              Placements <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {selectedIds.map((pid) => {
                const data = participantData[pid];
                if (!data) return null;
                return (
                  <PlacementRow
                    key={pid}
                    participant={data}
                    placement={placements[pid] || null}
                    totalParticipants={selectedIds.length}
                    onSetPlacement={(p) => setPlacement(pid, p)}
                  />
                );
              })}
            </div>
            <p className="text-gray-600 text-xs mt-1.5">Tap a number to assign each player's finishing position.</p>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Date Played</label>
          <input
            type="datetime-local"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
            Notes <span className="text-gray-600 normal-case">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Any notes about this game…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting || selectedIds.length < 2 || (!isLockedPodMode && localMode === "pod" && !selectedPodLocal)}
          className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold"
        >
          {submitting ? "Logging…" : "Log Game"}
        </Button>
      </form>
    </div>
  );
}