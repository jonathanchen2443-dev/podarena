/**
 * LogGame — 4-step wizard.
 *
 * Step 1: Game Setup   (mode, POD, format, participant count, date, notes)
 * Step 2: Players & Results (deck, participants, placements)
 * Step 3: Props        (optional praise)
 * Step 4: Review & Submit
 *
 * All existing game creation, participant, snapshot, and praise logic is REUSED unchanged.
 * Only the UI orchestration is new.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createGameWithParticipants } from "@/components/services/gameService";
import { ROUTES } from "@/components/utils/routes";
import { createPageUrl } from "@/utils";
import { X, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

import WizardStep1Setup from "@/components/loggame/wizard/WizardStep1Setup";
import WizardStep2Players from "@/components/loggame/wizard/WizardStep2Players";
import WizardStep3Props from "@/components/loggame/wizard/WizardStep3Props";
import WizardStep4Review from "@/components/loggame/wizard/WizardStep4Review";
import WizardIntroModal from "@/components/loggame/wizard/WizardIntroModal";
import WizardExitConfirm from "@/components/loggame/wizard/WizardExitConfirm";

// ── helpers ────────────────────────────────────────────────────────────────────

function defaultPlayedAt() {
  const now = new Date();
  now.setSeconds(0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

const STEP_TITLES = ["Game Setup", "Players & Results", "Props", "Review & Submit"];
const TOTAL_STEPS = 4;

// ── main component ─────────────────────────────────────────────────────────────

export default function LogGame() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const podIdFromUrl = urlParams.get("podId");
  const lockedPodMode = !!podIdFromUrl;

  // ── wizard nav state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [showIntro, setShowIntro] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedGameId, setSubmittedGameId] = useState(null); // success state

  // ── step 1 state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState(lockedPodMode ? "pod" : "casual");
  const [pod, setPod] = useState(null);
  const [podLoading, setPodLoading] = useState(lockedPodMode);
  const [podMembers, setPodMembers] = useState([]);
  const [podMembersLoading, setPodMembersLoading] = useState(false);
  const [participantCount, setParticipantCount] = useState(4);
  const [playedAt, setPlayedAt] = useState(defaultPlayedAt);
  const [notes, setNotes] = useState("");

  // ── step 2 state ─────────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [memberData, setMemberData] = useState({});
  const [placements, setPlacements] = useState({});
  const [myDeckId, setMyDeckId] = useState(null);
  const [myDecks, setMyDecks] = useState([]);

  // ── step 3 state ─────────────────────────────────────────────────────────────
  const [praiseReceiver, setPraiseReceiver] = useState(null);
  const [praiseType, setPraiseType] = useState(null);

  // ── intro check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !currentUser) return;
    if (!currentUser.hide_log_game_intro) {
      setShowIntro(true);
    }
  }, [authLoading, currentUser?.id]);

  // ── load my decks ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !currentUser) return;
    base44.entities.Deck.filter({ owner_id: currentUser.id, is_active: true })
      .then(setMyDecks)
      .catch(() => {});
  }, [authLoading, currentUser?.id]);

  // ── seed self as first participant (casual mode) ─────────────────────────────
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
  }, [authLoading, currentUser?.id, mode]);

  // ── load locked POD context ──────────────────────────────────────────────────
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

  // ── helpers ──────────────────────────────────────────────────────────────────

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
      } else {
        setParticipants([]);
        setMemberData({});
        setPlacements({});
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
  }

  function handlePodSelected(selectedPod) {
    setPod(selectedPod);
    setParticipants([]);
    setMemberData({});
    setPlacements({});
    loadPodMembers(selectedPod.id);
  }

  // Participant management (reused from original LogGame)
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
    // Clear praise if receiver is removed
    if (praiseReceiver === profileId) {
      setPraiseReceiver(null);
      setPraiseType(null);
    }
  }

  // ── step validation ──────────────────────────────────────────────────────────

  function step1Valid() {
    if (mode === "pod" && !pod) return false;
    if (!playedAt) return false;
    if (participantCount < 2 || participantCount > 10) return false;
    return true;
  }

  function step2Valid() {
    if (!myDeckId && myDecks.length > 0) return false; // deck required if they have decks
    if (participants.length < 2) return false;
    if (!participants.includes(currentUser?.id)) return false;
    if (participants.some((id) => !placements[id])) return false;
    return true;
  }

  // ── submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (isGuest || !currentUser) { base44.auth.redirectToLogin(); return; }
    setSubmitting(true);
    try {
      const participantList = participants.map((profileId) => {
        const data = memberData[profileId] || {};
        const isCreator = profileId === currentUser.id;
        const deckId = isCreator ? (myDeckId || null) : null;
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

      const praise = (praiseReceiver && praiseType)
        ? { receiverProfileId: praiseReceiver, praiseType }
        : null;

      const game = await createGameWithParticipants({
        podId: mode === "pod" ? (pod?.id || null) : null,
        contextType: mode,
        creatorProfileId: currentUser.id,
        creatorAuthUserId: authUserId,
        playedAt: new Date(playedAt).toISOString(),
        notes,
        participants: participantList,
        praise,
      });

      setSubmittedGameId(game?.id || null);
    } catch (err) {
      // Show error inline instead of toast — user is on step 4
      alert(err.message || "Failed to log game.");
      setSubmitting(false);
    }
  }

  // ── exit destination ─────────────────────────────────────────────────────────

  function goToSource() {
    if (lockedPodMode && podIdFromUrl) {
      navigate(`${createPageUrl("Pod")}?podId=${podIdFromUrl}`);
    } else {
      navigate(-1);
    }
  }

  // ── dismiss intro ─────────────────────────────────────────────────────────────

  async function handleDismissIntro(dontShowAgain) {
    setShowIntro(false);
    if (dontShowAgain && currentUser?.id) {
      try {
        await base44.entities.Profile.update(currentUser.id, { hide_log_game_intro: true });
      } catch (_) {}
    }
  }

  // ── loading / guest guards ───────────────────────────────────────────────────

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
        <button onClick={() => base44.auth.redirectToLogin()} className="ds-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white">
          Sign In
        </button>
      </div>
    );
  }

  // ── success state ────────────────────────────────────────────────────────────

  if (submittedGameId !== null) {
    return (
      <SuccessScreen
        gameId={submittedGameId}
        onBack={goToSource}
        podIdFromUrl={podIdFromUrl}
      />
    );
  }

  // ── wizard shell ─────────────────────────────────────────────────────────────

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">

      {/* ── Intro modal ──────────────────────────────────────────────────────── */}
      {showIntro && (
        <WizardIntroModal onDismiss={handleDismissIntro} />
      )}

      {/* ── Exit confirm ─────────────────────────────────────────────────────── */}
      {showExitConfirm && (
        <WizardExitConfirm
          onConfirm={goToSource}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {/* ── Wizard header ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 pt-1 pb-3">
        <div className="flex items-center justify-between mb-3">
          {/* Back or empty */}
          <div className="w-8">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Step title */}
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
              Step {step} of {TOTAL_STEPS}
            </p>
            <p className="text-white font-bold text-base leading-snug mt-0.5">
              {STEP_TITLES[step - 1]}
            </p>
          </div>

          {/* X close */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: "rgb(var(--ds-primary-rgb))",
            }}
          />
        </div>
      </div>

      {/* ── Step content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-28">
        {step === 1 && (
          <WizardStep1Setup
            mode={mode}
            lockedPodMode={lockedPodMode}
            pod={pod}
            podLoading={podLoading}
            authUserId={authUserId}
            profileId={currentUser?.id}
            participantCount={participantCount}
            playedAt={playedAt}
            notes={notes}
            onModeSwitch={handleModeSwitch}
            onPodSelected={handlePodSelected}
            onClearPod={() => { setPod(null); setPodMembers([]); setParticipants([]); setMemberData({}); }}
            onParticipantCountChange={setParticipantCount}
            onPlayedAtChange={setPlayedAt}
            onNotesChange={setNotes}
          />
        )}

        {step === 2 && (
          <WizardStep2Players
            mode={mode}
            pod={pod}
            podMembers={podMembers}
            podMembersLoading={podMembersLoading}
            participants={participants}
            memberData={memberData}
            placements={placements}
            participantCount={participantCount}
            currentUser={currentUser}
            myDecks={myDecks}
            myDeckId={myDeckId}
            onMyDeckChange={setMyDeckId}
            onAddPodParticipant={handleAddPodParticipant}
            onRemovePodParticipant={handleRemovePodParticipant}
            onAddCasualParticipant={handleAddCasualParticipant}
            onRemoveCasualParticipant={handleRemoveCasualParticipant}
            onPlacementChange={(uid, val) => setPlacements((prev) => ({ ...prev, [uid]: val }))}
          />
        )}

        {step === 3 && (
          <WizardStep3Props
            participants={participants.map((id) => ({
              profileId: id,
              display_name: memberData[id]?.display_name || id,
              avatar_url: memberData[id]?.avatar_url || null,
            }))}
            currentProfileId={currentUser?.id}
            praiseReceiver={praiseReceiver}
            praiseType={praiseType}
            onReceiverChange={(val) => { setPraiseReceiver(val); if (!val) setPraiseType(null); }}
            onPraiseChange={setPraiseType}
          />
        )}

        {step === 4 && (
          <WizardStep4Review
            mode={mode}
            pod={pod}
            participants={participants}
            memberData={memberData}
            placements={placements}
            myDeckId={myDeckId}
            myDecks={myDecks}
            playedAt={playedAt}
            notes={notes}
            praiseReceiver={praiseReceiver}
            praiseType={praiseType}
            currentUser={currentUser}
            onEditStep={setStep}
          />
        )}
      </div>

      {/* ── Bottom nav bar ───────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-4"
        style={{ background: "linear-gradient(to top, #0F1115 65%, transparent)" }}
      >
        <div className="max-w-lg mx-auto">
          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && !step1Valid()) return;
                if (step === 2 && !step2Valid()) return;
                setStep((s) => s + 1);
              }}
              disabled={
                (step === 1 && !step1Valid()) ||
                (step === 2 && !step2Valid())
              }
              className="w-full rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
              style={{
                height: "50px",
                backgroundColor:
                  (step === 1 && step1Valid()) || (step === 2 && step2Valid()) || step === 3
                    ? "rgb(var(--ds-primary-rgb))"
                    : "#1c2333",
                border:
                  (step === 1 && step1Valid()) || (step === 2 && step2Valid()) || step === 3
                    ? "1px solid rgba(var(--ds-primary-rgb),0.5)"
                    : "1px solid rgba(255,255,255,0.07)",
                boxShadow:
                  (step === 1 && step1Valid()) || (step === 2 && step2Valid()) || step === 3
                    ? "0 0 20px rgba(var(--ds-primary-rgb),0.3), 0 4px 12px rgba(0,0,0,0.5)"
                    : "none",
                cursor:
                  (step === 1 && !step1Valid()) || (step === 2 && !step2Valid())
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {step === 3 ? "Review" : "Continue"}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
              style={{
                height: "50px",
                backgroundColor: submitting ? "#1c2333" : "rgb(var(--ds-primary-rgb))",
                border: submitting ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(var(--ds-primary-rgb),0.5)",
                boxShadow: submitting ? "none" : "0 0 20px rgba(var(--ds-primary-rgb),0.3), 0 4px 12px rgba(0,0,0,0.5)",
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : "Submit Game"}
            </button>
          )}

          {/* Step-level hint */}
          {step === 1 && mode === "pod" && !pod && (
            <p className="text-center text-xs text-gray-600 mt-2">Select a POD to continue</p>
          )}
          {step === 2 && participants.length < 2 && (
            <p className="text-center text-xs text-gray-600 mt-2">Add at least 2 participants</p>
          )}
          {step === 2 && participants.length >= 2 && participants.some((id) => !placements[id]) && (
            <p className="text-center text-xs text-gray-600 mt-2">Assign all placements to continue</p>
          )}
          {step === 3 && (
            <button
              onClick={() => { setPraiseReceiver(null); setPraiseType(null); setStep(4); }}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
            >
              Skip Props →
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ gameId, onBack, podIdFromUrl }) {
  const navigate = useNavigate();

  function handleView() {
    navigate(ROUTES.INBOX);
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6 min-h-[60vh]">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "rgba(var(--ds-primary-rgb),0.15)", border: "1px solid rgba(var(--ds-primary-rgb),0.30)" }}
      >
        <CheckCircle2 className="w-10 h-10" style={{ color: "rgb(var(--ds-primary-rgb))" }} />
      </div>
      <div className="space-y-2">
        <p className="text-white font-extrabold text-xl">Game submitted!</p>
        <p className="text-gray-400 text-sm leading-relaxed max-w-[260px]">
          The other players will receive a review request. The game will count once everyone approves.
        </p>
      </div>
      <div className="flex gap-3 w-full max-w-[260px]">
        <button
          onClick={onBack}
          className="flex-1 rounded-2xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold py-3 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Back
        </button>
        <button
          onClick={handleView}
          className="flex-1 rounded-2xl text-white text-sm font-semibold py-3 transition-all ds-btn-primary"
        >
          View
        </button>
      </div>
    </div>
  );
}