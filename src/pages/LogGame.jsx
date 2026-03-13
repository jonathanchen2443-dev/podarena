import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createGameWithParticipants } from "@/components/services/gameService";
import { ROUTES } from "@/components/utils/routes";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Layers } from "lucide-react";
import { toast } from "sonner";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import ParticipantPicker from "@/components/loggame/ParticipantPicker";
import PlacementInput from "@/components/loggame/PlacementInput";
import PodSearchPicker from "@/components/loggame/PodSearchPicker";

function defaultPlayedAt() {
  const now = new Date();
  now.setSeconds(0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function LogGame() {
  // authUserId = Auth User ID (profile.user_id) — for RLS fields, GameParticipant.participant_user_id
  // currentUser.id = Profile ID (Profile entity UUID) — for display joins, deck lookups
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const podIdFromUrl = urlParams.get("podId");
  const lockedPodMode = !!podIdFromUrl;

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState(lockedPodMode ? "pod" : "casual");

  // ── POD ───────────────────────────────────────────────────────────────────
  const [pod, setPod] = useState(null);
  const [podLoading, setPodLoading] = useState(lockedPodMode);
  const [podMembers, setPodMembers] = useState([]);
  const [podMembersLoading, setPodMembersLoading] = useState(false);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [memberData, setMemberData] = useState({});
  const [placements, setPlacements] = useState({});
  const [deckSelections, setDeckSelections] = useState({});
  const [playedAt, setPlayedAt] = useState(defaultPlayedAt);
  const [notes, setNotes] = useState("");
  const [myDecks, setMyDecks] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Load auth + decks ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !currentUser) return;
    // Sync authUserId from context; only call me() if context didn't resolve it yet
    if (contextAuthUserId) {
      setAuthUserId(contextAuthUserId);
    } else {
      base44.auth.me().then((u) => setAuthUserId(u?.id || null)).catch(() => {});
    }
    base44.entities.Deck.filter({ owner_id: currentUser.id }).then(setMyDecks).catch(() => {});
  }, [authLoading, currentUser, contextAuthUserId]);

  // ── Auto-add self (casual mode) ────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !currentUser || mode !== "casual") return;
    const selfData = {
      profileId: currentUser.id,                          // Profile ID (entity UUID)
      authUserId: contextAuthUserId || authUserId || null, // Auth User ID (for RLS / approvals)
      display_name: currentUser.display_name,
      avatar_url: currentUser.avatar_url || null,
    };
    setParticipants([currentUser.id]);
    setMemberData({ [currentUser.id]: selfData });
    setPlacements({});
    setDeckSelections({});
  }, [authLoading, currentUser?.id, mode]);

  // Patch self authUserId once it loads
  useEffect(() => {
    if (!authUserId || !currentUser) return;
    setMemberData((prev) =>
      prev[currentUser.id]
        ? { ...prev, [currentUser.id]: { ...prev[currentUser.id], authUserId } }
        : prev
    );
  }, [authUserId]);

  // ── Load locked POD ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!podIdFromUrl || authLoading) return;
    setPodLoading(true);
    base44.entities.POD.get(podIdFromUrl)
      .then((p) => { if (p) { setPod(p); loadPodMembers(p.id); } })
      .catch(() => {})
      .finally(() => setPodLoading(false));
  }, [podIdFromUrl, authLoading]);

  async function loadPodMembers(pId) {
    setPodMembersLoading(true);
    try {
      const memberships = await base44.entities.PODMembership.filter({
        pod_id: pId,
        membership_status: "active",
      }).catch(() => []);
      const profiles = await base44.entities.Profile.list("-created_date", 200).catch(() => []);
      const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      const members = memberships.map((m) => ({
        userId: m.profile_id,
        authUserId: m.user_id,
        display_name: profileMap[m.profile_id]?.display_name || "Unknown",
        avatar_url: profileMap[m.profile_id]?.avatar_url || null,
      }));
      setPodMembers(members);

      // Auto-add self if member
      if (currentUser) {
        const selfMember = members.find((m) => m.userId === currentUser.id);
        if (selfMember) {
          setParticipants([currentUser.id]);
          setMemberData({
            [currentUser.id]: {
              profileId: currentUser.id,
              authUserId: selfMember.authUserId,
              display_name: selfMember.display_name,
              avatar_url: selfMember.avatar_url,
            },
          });
          setPlacements({});
          setDeckSelections({});
        }
      }
    } finally {
      setPodMembersLoading(false);
    }
  }

  // ── Mode switch ────────────────────────────────────────────────────────────
  function handleModeSwitch(newMode) {
    if (lockedPodMode) return;
    setMode(newMode);
    setPod(null);
    setPodMembers([]);
    setParticipants([]);
    setMemberData({});
    setPlacements({});
    setDeckSelections({});
  }

  // ── POD selected (free mode) ───────────────────────────────────────────────
  function handlePodSelected(selectedPod) {
    setPod(selectedPod);
    setParticipants([]);
    setMemberData({});
    setPlacements({});
    setDeckSelections({});
    loadPodMembers(selectedPod.id);
  }

  // ── Participant helpers ────────────────────────────────────────────────────
  function handleAddPodParticipant(profileId) {
    if (participants.includes(profileId)) return;
    const member = podMembers.find((m) => m.userId === profileId);
    setParticipants((prev) => [...prev, profileId]);
    if (member) {
      setMemberData((prev) => ({
        ...prev,
        [profileId]: { profileId, authUserId: member.authUserId, display_name: member.display_name, avatar_url: member.avatar_url },
      }));
    }
  }

  function handleRemovePodParticipant(profileId) {
    if (profileId === currentUser?.id) return;
    removeParticipant(profileId);
  }

  function handleAddCasualParticipant(profileId, data) {
    if (participants.includes(profileId)) return;
    setParticipants((prev) => [...prev, profileId]);
    setMemberData((prev) => ({ ...prev, [profileId]: data }));
  }

  function handleRemoveCasualParticipant(profileId) {
    if (profileId === currentUser?.id) return;
    removeParticipant(profileId);
  }

  function removeParticipant(profileId) {
    setParticipants((prev) => prev.filter((id) => id !== profileId));
    setMemberData((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
    setPlacements((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
    setDeckSelections((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (isGuest || !currentUser) { base44.auth.redirectToLogin(); return; }
    if (participants.length < 2) { toast.error("Add at least 2 participants."); return; }
    if (participants.some((id) => !placements[id])) { toast.error("Set a placement for all participants."); return; }
    if (mode === "pod" && !pod) { toast.error("Select a POD first."); return; }

    setSubmitting(true);
    try {
      const aUid = authUserId || (await base44.auth.me().then((u) => u?.id));
      const participantList = participants.map((profileId) => {
        const data = memberData[profileId] || {};
        const deckId = deckSelections[profileId] || null;
        const deckObj = deckId ? myDecks.find((d) => d.id === deckId) : null;
        return {
          profileId,
          authUserId: data.authUserId || null,
          deck_id: deckId,
          deckData: deckObj || null,
          placement: placements[profileId] || null,
          result: placements[profileId] === 1 ? "win" : "loss",
        };
      });

      await createGameWithParticipants({
        leagueId: null,
        podId: mode === "pod" ? (pod?.id || null) : null,
        contextType: mode,
        creatorProfileId: currentUser.id,
        creatorAuthUserId: aUid,
        playedAt: new Date(playedAt).toISOString(),
        notes,
        participants: participantList,
      });

      toast.success("Game logged!");
      if (lockedPodMode && podIdFromUrl) {
        navigate(`${createPageUrl("Pod")}?podId=${podIdFromUrl}`);
      } else {
        navigate(ROUTES.DASHBOARD);
      }
    } catch (err) {
      toast.error(err.message || "Failed to log game.");
      setSubmitting(false);
    }
  }

  // ── Loading / guest guards ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-gray-400">Sign in to log games.</p>
        <Button onClick={() => base44.auth.redirectToLogin()} className="ds-btn-primary">
          Sign In
        </Button>
      </div>
    );
  }

  const membersForPlacement = participants.map((id) => ({
    userId: id,
    display_name: memberData[id]?.display_name || id,
    avatar_url: memberData[id]?.avatar_url || null,
  }));

  function goBack() {
    if (lockedPodMode && podIdFromUrl) {
      navigate(`${createPageUrl("Pod")}?podId=${podIdFromUrl}`);
    } else {
      navigate(-1);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 py-3">
        <button
          onClick={goBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-white font-bold text-lg">Log Game</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Mode toggle — hidden in locked POD mode */}
        {!lockedPodMode && (
          <div className="flex bg-gray-900/60 border border-gray-800/50 rounded-2xl p-1 gap-1">
            {["casual", "pod"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeSwitch(m)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize"
                style={
                  mode === m
                    ? { backgroundColor: "rgb(var(--ds-primary-rgb))", color: "#fff" }
                    : { color: "#9CA3AF" }
                }
              >
                {m === "casual" ? "Casual" : "POD"}
              </button>
            ))}
          </div>
        )}

        {/* POD selector / locked badge */}
        {mode === "pod" && (
          <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
            {lockedPodMode ? (
              podLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                  Loading POD…
                </div>
              ) : pod ? (
                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
                    POD <span className="text-xs text-gray-600 normal-case">(locked)</span>
                  </label>
                  <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
                    <Layers className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
                    <div>
                      <p className="text-white text-sm font-medium">{pod.pod_name}</p>
                      <p className="text-xs font-mono text-gray-500">{pod.pod_code}</p>
                    </div>
                    <span className="ml-auto text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Locked
                    </span>
                  </div>
                </div>
              ) : null
            ) : pod ? (
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">POD</label>
                <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
                  <Layers className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
                  <div>
                    <p className="text-white text-sm font-medium">{pod.pod_name}</p>
                    <p className="text-xs font-mono text-gray-500">{pod.pod_code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPod(null); setPodMembers([]); setParticipants([]); setMemberData({}); }}
                    className="ml-auto text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <PodSearchPicker authUserId={authUserId} onSelect={handlePodSelected} />
            )}
          </div>
        )}

        {/* Participants */}
        {(mode === "casual" || (mode === "pod" && pod)) && (
          <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
            {mode === "casual" ? (
              <CasualParticipantPicker
                selectedIds={participants}
                onAdd={handleAddCasualParticipant}
                onRemove={handleRemoveCasualParticipant}
                currentUserProfileId={currentUser?.id}
              />
            ) : (
              <ParticipantPicker
                members={podMembers}
                selectedIds={participants}
                onAdd={handleAddPodParticipant}
                onRemove={handleRemovePodParticipant}
                currentUserId={currentUser?.id}
                membersLoading={podMembersLoading}
              />
            )}
          </div>
        )}

        {/* Placements + deck */}
        {participants.length >= 2 && (
          <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
            <PlacementInput
              participants={participants}
              members={membersForPlacement}
              placements={placements}
              onPlacementChange={(id, val) => setPlacements((prev) => ({ ...prev, [id]: val }))}
              myDecks={myDecks}
              deckSelections={deckSelections}
              onDeckChange={(id, val) => setDeckSelections((prev) => ({ ...prev, [id]: val }))}
              currentUserProfileId={currentUser?.id}
            />
          </div>
        )}

        {/* Date + Notes */}
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
              Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
              Notes <span className="text-gray-600 normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about the game…"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting || participants.length < 2}
          className="w-full h-12 rounded-2xl text-base font-semibold"
          style={{
            backgroundColor:
              submitting || participants.length < 2
                ? undefined
                : "rgb(var(--ds-primary-rgb))",
            color: "#fff",
          }}
        >
          {submitting ? "Logging…" : "Log Game"}
        </Button>
      </form>
    </div>
  );
}