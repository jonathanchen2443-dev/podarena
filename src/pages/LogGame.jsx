import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Swords, User, AlertCircle } from "lucide-react";
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
              placement === p
                ? "text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
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

  const urlParams = new URLSearchParams(window.location.search);
  const contextType = urlParams.get("contextType") || "casual";
  const podId = urlParams.get("podId") || null;
  const podNameRaw = urlParams.get("podName");
  const podName = podNameRaw ? decodeURIComponent(podNameRaw) : null;
  const isPodMode = contextType === "pod" && !!podId;

  const [selectedIds, setSelectedIds] = useState([]);
  const [participantData, setParticipantData] = useState({});
  const [placements, setPlacements] = useState({});
  const [podMembers, setPodMembers] = useState([]);
  const [podMembersLoading, setPodMembersLoading] = useState(isPodMode);
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-add current user (casual mode)
  useEffect(() => {
    if (isPodMode || !currentUser) return;
    const data = {
      profileId: currentUser.id,
      authUserId: currentUser.user_id || null,
      display_name: currentUser.display_name || "You",
      avatar_url: currentUser.avatar_url || null,
    };
    setSelectedIds([currentUser.id]);
    setParticipantData({ [currentUser.id]: data });
  }, [isPodMode, currentUser?.id]);

  // Load POD members (POD mode)
  useEffect(() => {
    if (!isPodMode || !currentUser || !podId) return;
    async function loadMembers() {
      setPodMembersLoading(true);
      try {
        const memberships = await base44.entities.PODMembership.filter({ pod_id: podId, membership_status: "active" });
        const profileIds = memberships.map((m) => m.profile_id).filter(Boolean);
        const profiles = await base44.entities.Profile.list("-created_date", 200);
        const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        const members = profileIds.map((pid) => {
          const p = profileMap[pid];
          if (!p) return null;
          return { profileId: pid, authUserId: p.user_id || null, display_name: p.display_name || "Unknown", avatar_url: p.avatar_url || null };
        }).filter(Boolean);
        setPodMembers(members);
        // Auto-select current user
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
  }, [isPodMode, podId, currentUser?.id]);

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
        podId: isPodMode ? podId : null,
        contextType,
        creatorProfileId: currentUser.id,
        creatorAuthUserId: authUser.id,
        playedAt: new Date(playedAt).toISOString(),
        notes,
        participants,
      });
      toast.success("Game logged! Awaiting participant approval.");
      navigate(isPodMode && podId ? `${createPageUrl("Pod")}?podId=${podId}` : createPageUrl("Dashboard"));
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

  const backTo = isPodMode && podId ? `${createPageUrl("Pod")}?podId=${podId}` : createPageUrl("Dashboard");

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backTo)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5" />
            Log Game
          </h1>
          {isPodMode && podName && (
            <p className="text-xs text-gray-500">POD: <span style={{ color: "var(--ds-primary-text)" }}>{podName}</span></p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Participants */}
        <div>
          {isPodMode ? (
            <>
              <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
                Who Played? <span className="text-red-400">*</span>
                <span className="text-gray-600 normal-case ml-1">(min 2)</span>
              </label>
              {podMembersLoading ? (
                <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>
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
          disabled={submitting || selectedIds.length < 2}
          className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold"
        >
          {submitting ? "Logging…" : "Log Game"}
        </Button>
      </form>
    </div>
  );
}