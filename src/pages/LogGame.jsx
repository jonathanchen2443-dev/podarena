import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createGameWithParticipants } from "@/components/services/gameService";
import { ROUTES } from "@/components/utils/routes";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Layers, Swords, Hash } from "lucide-react";
import { toast } from "sonner";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import ParticipantPicker from "@/components/loggame/ParticipantPicker";
import ParticipantSetupCard from "@/components/loggame/ParticipantSetupCard";
import PodSearchPicker from "@/components/loggame/PodSearchPicker";
import PraiseSelector from "@/components/praise/PraiseSelector";

function defaultPlayedAt() {
  const now = new Date();
  now.setSeconds(0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function LogGame() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const podIdFromUrl = urlParams.get("podId");
  const lockedPodMode = !!podIdFromUrl;

  const [mode, setMode] = useState(lockedPodMode ? "pod" : "casual");
  const [pod, setPod] = useState(null);
  const [podLoading, setPodLoading] = useState(lockedPodMode);
  const [podMembers, setPodMembers] = useState([]);
  const [podMembersLoading, setPodMembersLoading] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [memberData, setMemberData] = useState({});
  const [placements, setPlacements] = useState({});
  const [deckSelections, setDeckSelections] = useState({});
  const [playedAt, setPlayedAt] = useState(defaultPlayedAt);
  const [notes, setNotes] = useState("");
  const [myDecks, setMyDecks] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Praise state
  const [praiseReceiver, setPraiseReceiver] = useState(null);
  const [praiseType, setPraiseType] = useState(null);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    base44.entities.Deck.filter({ owner_id: currentUser.id }).then(setMyDecks).catch(() => {});
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (authLoading || !currentUser || mode !== "casual") return;
    const selfData = {
      profileId: currentUser.id,
      authUserId: authUserId || null,
      display_name: currentUser.display_name,
      avatar_url: currentUser.avatar_url || null,
    };
    setParticipants([currentUser.id]);
    setMemberData({ [currentUser.id]: selfData });
    setPlacements({});
    setDeckSelections({});
  }, [authLoading, currentUser?.id, mode]);

  useEffect(() => {
    if (!podIdFromUrl || authLoading || !currentUser || !authUserId) return;
    setPodLoading(true);
    base44.functions.invoke('publicProfiles', {
      action: 'logGamePodContext',
      podId: podIdFromUrl,
      callerAuthUserId: authUserId,
      callerProfileId: currentUser.id,
    }).then((res) => {
      const data = res.data || {};
      if (data.error || !data.pod) return;
      setPod(data.pod);
      applyPodMembers(data.members || []);
    }).catch(() => {}).finally(() => setPodLoading(false));
  }, [podIdFromUrl, authLoading, currentUser?.id, authUserId]);

  function applyPodMembers(rawMembers) {
    const members = rawMembers.map((m) => ({
      userId: m.profileId,
      authUserId: m.user_id,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
    }));
    setPodMembers(members);
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
      } else {
        setParticipants([]);
        setMemberData({});
        setPlacements({});
        setDeckSelections({});
      }
    }
  }

  async function loadPodMembers(pId) {
    setPodMembersLoading(true);
    try {
      const res = await base44.functions.invoke('publicProfiles', {
        action: 'logGamePodContext',
        podId: pId,
        callerAuthUserId: authUserId,
        callerProfileId: currentUser?.id,
      });
      const data = res.data || {};
      applyPodMembers(data.members || []);
    } finally {
      setPodMembersLoading(false);
    }
  }

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

  function handlePodSelected(selectedPod) {
    setPod(selectedPod);
    setParticipants([]);
    setMemberData({});
    setPlacements({});
    setDeckSelections({});
    loadPodMembers(selectedPod.id);
  }

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

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isGuest || !currentUser) { base44.auth.redirectToLogin(); return; }
    if (participants.length < 2) { toast.error("Add at least 2 participants."); return; }
    if (participants.some((id) => !placements[id])) { toast.error("Set a placement for all participants."); return; }
    if (mode === "pod" && !pod) { toast.error("Select a POD first."); return; }

    setSubmitting(true);
    try {
      const participantList = participants.map((profileId) => {
        const data = memberData[profileId] || {};
        const isCreator = profileId === currentUser.id;
        const deckId = isCreator ? (deckSelections[profileId] || null) : null;
        const deckObj = isCreator && deckId ? myDecks.find((d) => d.id === deckId) : null;
        return {
          profileId,
          authUserId: data.authUserId || null,
          deck_id: deckId,
          deckData: deckObj || null,
          placement: placements[profileId] || null,
          result: placements[profileId] === 1 ? "win" : "loss",
        };
      });

      // Build optional praise payload (only if both receiver and type are chosen)
      const praise = (praiseReceiver && praiseType)
        ? { receiverProfileId: praiseReceiver, praiseType }
        : null;

      await createGameWithParticipants({
        podId: mode === "pod" ? (pod?.id || null) : null,
        contextType: mode,
        creatorProfileId: currentUser.id,
        creatorAuthUserId: authUserId,
        playedAt: new Date(playedAt).toISOString(),
        notes,
        participants: participantList,
        praise,
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

  const usedPlacements = new Set(Object.values(placements).filter(Boolean).map(Number));
  const canSubmit = participants.length >= 2 && participants.every((id) => placements[id]);

  function goBack() {
    if (lockedPodMode && podIdFromUrl) {
      navigate(`${createPageUrl("Pod")}?podId=${podIdFromUrl}`);
    } else {
      navigate(-1);
    }
  }

  return (
    // Extra bottom padding: sticky submit bar (~72px) + bottom nav (~64px) + some breathing room
    <div className="space-y-5 pb-40">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 pb-1">
        <button
          onClick={goBack}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">Log Game</h1>
          <p className="text-gray-500 text-xs mt-0.5">Record a match result</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Section A: Game Context ──────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionLabel icon={<Swords className="w-3.5 h-3.5" />} label="Game Type" />

          {/* Mode segmented control — hidden in locked POD mode */}
          {!lockedPodMode && (
            <div className="grid grid-cols-2 gap-2">
              <ModeCard
                active={mode === "casual"}
                onClick={() => handleModeSwitch("casual")}
                label="Casual"
                description="Open game, any players"
              />
              <ModeCard
                active={mode === "pod"}
                onClick={() => handleModeSwitch("pod")}
                label="POD"
                description="Competitive, tracked game"
                isPod
              />
            </div>
          )}

          {/* POD identity area */}
          {mode === "pod" && (
            <div>
              {lockedPodMode ? (
                podLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm bg-gray-900/60 border border-gray-800/50 rounded-2xl px-4 py-3">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                    Loading POD…
                  </div>
                ) : pod ? (
                  <LockedPodChip pod={pod} />
                ) : null
              ) : pod ? (
                <SelectedPodChip
                  pod={pod}
                  onClear={() => { setPod(null); setPodMembers([]); setParticipants([]); setMemberData({}); }}
                />
              ) : (
                <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                  <PodSearchPicker authUserId={authUserId} profileId={currentUser?.id} onSelect={handlePodSelected} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section B: Participants ──────────────────────────────────────── */}
        {(mode === "casual" || (mode === "pod" && pod)) && (
          <section className="space-y-3">
            <SectionLabel icon={<Hash className="w-3.5 h-3.5" />} label="Participants" />
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
              {mode === "casual" ? (
                <CasualParticipantPicker
                  selectedIds={participants}
                  onAdd={handleAddCasualParticipant}
                  onRemove={handleRemoveCasualParticipant}
                  currentUserProfileId={currentUser?.id}
                  currentUserProfile={currentUser ? { display_name: currentUser.display_name, avatar_url: currentUser.avatar_url || null } : null}
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
          </section>
        )}

        {/* ── Section C: Match Setup — per-participant cards ───────────────── */}
        {participants.length >= 2 && (
          <section className="space-y-3">
            <SectionLabel icon={<Layers className="w-3.5 h-3.5" />} label="Match Setup" />
            <div className="space-y-2">
              {participants.map((uid) => {
                const member = membersForPlacement.find((m) => m.userId === uid);
                const isCurrentUser = uid === currentUser?.id;
                return (
                  <ParticipantSetupCard
                    key={uid}
                    uid={uid}
                    member={member}
                    isCurrentUser={isCurrentUser}
                    placement={placements[uid] || ""}
                    participantCount={participants.length}
                    usedPlacements={usedPlacements}
                    onPlacementChange={(val) => setPlacements((prev) => ({ ...prev, [uid]: val }))}
                    myDecks={isCurrentUser ? myDecks : []}
                    selectedDeckId={isCurrentUser ? (deckSelections[uid] || "") : ""}
                    onDeckChange={isCurrentUser ? (val) => setDeckSelections((prev) => ({ ...prev, [uid]: val })) : null}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Section D: Props (Praise) — optional, only when 2+ participants ── */}
        {participants.length >= 2 && (
          <PraiseSelector
            participants={participants.map((id) => ({
              profileId: id,
              display_name: memberData[id]?.display_name || id,
              avatar_url: memberData[id]?.avatar_url || null,
            }))}
            currentProfileId={currentUser?.id}
            selectedReceiver={praiseReceiver}
            selectedPraise={praiseType}
            onReceiverChange={(val) => { setPraiseReceiver(val); if (!val) setPraiseType(null); }}
            onPraiseChange={setPraiseType}
          />
        )}

        {/* ── Date & Notes ─────────────────────────────────────────────────── */}
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
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
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
              Notes <span className="text-gray-700 normal-case font-normal">(optional)</span>
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

      </form>

      {/* ── Sticky Submit Bar ─────────────────────────────────────────────── */}
      {/* Positioned above bottom nav (z-40 < nav z-50). Bottom offset accounts for BottomNav h-16 */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 pt-4" style={{ background: "linear-gradient(to top, #030712 60%, transparent)" }}>
        <div className="max-w-lg mx-auto space-y-1.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full rounded-2xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{
              height: "50px",
              backgroundColor: canSubmit && !submitting
                ? "rgb(var(--ds-primary-rgb))"
                : "#1c2333",
              border: canSubmit && !submitting
                ? "1px solid rgba(var(--ds-primary-rgb),0.5)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: canSubmit && !submitting
                ? "0 0 20px rgba(var(--ds-primary-rgb),0.35), 0 4px 12px rgba(0,0,0,0.5)"
                : "none",
              opacity: submitting ? 0.7 : 1,
              cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Logging…</span>
              </>
            ) : (
              "Submit Game"
            )}
          </button>
          {!canSubmit && participants.length >= 2 && (
            <p className="text-center text-xs text-gray-600">Set a placement for every participant</p>
          )}
          {participants.length < 2 && (
            <p className="text-center text-xs text-gray-600">Add at least 2 participants to continue</p>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-gray-500">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ModeCard({ active, onClick, label, description, isPod }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-2xl px-4 py-3.5 border text-left transition-all"
      style={
        active
          ? {
              backgroundColor: isPod ? "rgba(124,58,237,0.12)" : "rgba(var(--ds-primary-rgb),0.12)",
              borderColor: isPod ? "rgba(124,58,237,0.40)" : "rgb(var(--ds-primary-rgb))",
            }
          : { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }
      }
    >
      <span
        className="text-sm font-bold"
        style={
          active
            ? { color: isPod ? "#a78bfa" : "var(--ds-primary-text)" }
            : { color: "#6b7280" }
        }
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: active ? "#9ca3af" : "#4b5563" }}>
        {description}
      </span>
    </button>
  );
}

function PodChipBase({ pod, right }) {
  return (
    <div className="flex items-center gap-3 bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.25)] rounded-2xl px-4 py-3">
      <div className="w-8 h-8 rounded-xl bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.25)] flex items-center justify-center flex-shrink-0">
        <Layers className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{pod.pod_name}</p>
        <p className="text-xs font-mono text-violet-400/60">{pod.pod_code}</p>
      </div>
      {right}
    </div>
  );
}

function LockedPodChip({ pod }) {
  return (
    <PodChipBase
      pod={pod}
      right={
        <span className="text-[10px] text-gray-600 bg-gray-800/80 px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">
          Locked
        </span>
      }
    />
  );
}

function SelectedPodChip({ pod, onClear }) {
  return (
    <PodChipBase
      pod={pod}
      right={
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 px-1"
        >
          Change
        </button>
      }
    />
  );
}