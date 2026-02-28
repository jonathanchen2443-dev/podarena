import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Swords, Loader2, AlertCircle, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContext";
import { LoadingState } from "@/components/shell/PageStates";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { listLeaguesForGameLogging, listLeagueMembers } from "@/components/services/leagueService";
import { listMyDecks } from "@/components/services/deckService";
import { createGameWithParticipants } from "@/components/services/gameService";
import { ROUTES } from "@/components/utils/routes";
import LeaguePicker from "@/components/loggame/LeaguePicker";
import ParticipantPicker from "@/components/loggame/ParticipantPicker";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import PlacementInput from "@/components/loggame/PlacementInput";

// Context toggle pill
function ContextToggle({ value, onChange }) {
  return (
    <div className="flex bg-gray-900 border border-gray-700 rounded-xl p-1 gap-1">
      {["league", "casual"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
            value === opt
              ? "bg-violet-600 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {opt === "league" ? "⚔️ League Game" : "🎲 Casual Game"}
        </button>
      ))}
    </div>
  );
}

export default function LogGame() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;
  const navigate = useNavigate();

  const qp = new URLSearchParams(window.location.search);
  const preselectedLeagueId = qp.get("leagueId");
  const returnTo = qp.get("returnTo");
  const returnLeagueId = qp.get("returnLeagueId");

  // ── Context mode ──────────────────────────────────────────────────────────
  const [contextType, setContextType] = useState(preselectedLeagueId ? "league" : "league");

  // ── League mode data ──────────────────────────────────────────────────────
  const [leagues, setLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [myDecks, setMyDecks] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(preselectedLeagueId || null);
  const [participantIds, setParticipantIds] = useState([]);
  const [placements, setPlacements] = useState({});
  const [deckSelections, setDeckSelections] = useState({});
  const [playedAt, setPlayedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const leaguesFetchRef = useRef(false);
  const membersFetchRef = useRef(false);
  const lastMembersLeagueRef = useRef(null);

  function todayISO() {
    return new Date().toISOString().slice(0, 16);
  }

  function handleBack() {
    if (returnTo === "league" && returnLeagueId) {
      navigate(ROUTES.LEAGUE_DETAILS(returnLeagueId) + "&tab=standings");
    } else {
      navigate(-1);
    }
  }

  // ── Load leagues + decks ──────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || isGuest) return;
    if (leaguesFetchRef.current) return;
    leaguesFetchRef.current = true;
    setLeaguesLoading(true);

    Promise.all([listLeaguesForGameLogging(auth), listMyDecks(auth)])
      .then(([ls, decks]) => {
        setLeagues(ls);
        setMyDecks(decks.filter((d) => d.is_active !== false));
      })
      .catch(() => setLeagues([]))
      .finally(() => setLeaguesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  // ── Load league members when league changes ───────────────────────────────
  useEffect(() => {
    if (!selectedLeagueId || contextType !== "league") { setMembers([]); return; }
    if (membersFetchRef.current && lastMembersLeagueRef.current === selectedLeagueId) return;
    membersFetchRef.current = true;
    lastMembersLeagueRef.current = selectedLeagueId;
    setMembersLoading(true);
    listLeagueMembers(auth, selectedLeagueId)
      .then((ms) => setMembers(ms))
      .catch(() => setMembers([]))
      .finally(() => {
        setMembersLoading(false);
        membersFetchRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId, contextType]);

  // ── Reset participants when context changes ───────────────────────────────
  function handleContextChange(type) {
    setContextType(type);
    setParticipantIds([]);
    setPlacements({});
    setDeckSelections({});
    setSubmitError(null);
    if (type === "casual") {
      setSelectedLeagueId(null);
    }
  }

  function handleLeagueChange(id) {
    setSelectedLeagueId(id);
    setParticipantIds([]);
    setPlacements({});
    setDeckSelections({});
    setSubmitError(null);
    membersFetchRef.current = false;
    lastMembersLeagueRef.current = null;
  }

  function addParticipant(uid) {
    if (participantIds.includes(uid)) return;
    setParticipantIds((prev) => [...prev, uid]);
  }

  function removeParticipant(uid) {
    setParticipantIds((prev) => prev.filter((id) => id !== uid));
    setPlacements((prev) => { const n = { ...prev }; delete n[uid]; return n; });
    setDeckSelections((prev) => { const n = { ...prev }; delete n[uid]; return n; });
  }

  function setPlacement(uid, val) { setPlacements((prev) => ({ ...prev, [uid]: val })); }
  function setDeck(uid, deckId) { setDeckSelections((prev) => ({ ...prev, [uid]: deckId })); }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    if (contextType === "league" && !selectedLeagueId) return "Please select a league.";
    if (participantIds.length < 2) return "Please add at least 2 participants.";
    const dupCheck = new Set(participantIds);
    if (dupCheck.size !== participantIds.length) return "Duplicate participants detected.";
    const usedPlacements = participantIds.map((uid) => placements[uid]).filter(Boolean);
    if (usedPlacements.length !== participantIds.length) return "All participants must have a placement.";
    const uniquePlacements = new Set(usedPlacements);
    if (uniquePlacements.size !== usedPlacements.length) return "Each placement must be unique.";
    return null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    const err = validate();
    if (err) { setSubmitError(err); return; }

    setSubmitting(true);
    try {
      const participantsPayload = participantIds.map((uid) => ({
        user_id: uid,
        deck_id: deckSelections[uid] || null,
        placement: placements[uid],
        result: placements[uid] === 1 ? "win" : "loss",
      }));

      const game = await createGameWithParticipants({
        leagueId: contextType === "league" ? selectedLeagueId : null,
        contextType,
        creatorProfileId: currentUser.id,
        playedAt: playedAt ? new Date(playedAt).toISOString() : new Date().toISOString(),
        notes,
        participants: participantsPayload,
      });

      toast.success("Game logged! Waiting for participant approvals.");

      if (contextType === "league") {
        navigate(`${ROUTES.LEAGUE_DETAILS(selectedLeagueId)}&tab=games&gameId=${game.id}`);
      } else {
        // Casual game — go to Inbox so they can see approvals
        navigate(`${ROUTES.INBOX}?gameId=${game.id}`);
      }
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setSubmitError(isRateLimit
        ? "Too many requests. Please wait a moment and try again."
        : e.message || "Failed to submit game. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (authLoading) return <LoadingState message="Loading…" />;

  const topNav = (
    <div className="flex items-center justify-between mb-5">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <Link
        to={ROUTES.PROFILE}
        className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center hover:bg-violet-500/20 transition-colors"
      >
        <User className="w-4 h-4 text-violet-400" />
      </Link>
    </div>
  );

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        {topNav}
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in to Log a Game</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to log a game and submit it for approval.</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 px-6" onClick={() => base44.auth.redirectToLogin()}>
          Sign In
        </Button>
      </div>
    );
  }

  if (leaguesLoading) return <LoadingState message="Loading…" />;

  const allPlacementsFilled = participantIds.length >= 2 && participantIds.every((uid) => placements[uid]);

  // For casual PlacementInput we pass an empty members array but use allProfiles via CasualParticipantPicker
  // PlacementInput only needs the list to look up display_name; for casual we build a synthetic list
  const casualMembersForPlacement = participantIds.map((uid) => ({ userId: uid, display_name: uid }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {topNav}

      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
        <p className="text-sm text-violet-300 leading-relaxed">
          Log a completed game. All participants will be asked to approve the result.
        </p>
      </div>

      {/* Context toggle */}
      <ContextToggle value={contextType} onChange={handleContextChange} />

      {/* League mode */}
      {contextType === "league" && (
        <>
          <LeaguePicker leagues={leagues} value={selectedLeagueId} onChange={handleLeagueChange} />
          {selectedLeagueId && (
            <ParticipantPicker
              members={members}
              selectedIds={participantIds}
              onAdd={addParticipant}
              onRemove={removeParticipant}
              currentUserId={currentUser?.id}
              membersLoading={membersLoading}
            />
          )}
        </>
      )}

      {/* Casual mode */}
      {contextType === "casual" && (
        <div className="space-y-3">
          {/* 1v1 quick preset */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Quick preset:</span>
            <button
              type="button"
              onClick={() => {
                // Auto-add self if not added; keeps existing selections
                if (!participantIds.includes(currentUser?.id) && currentUser?.id) {
                  setParticipantIds([currentUser.id]);
                  setPlacements({});
                  setDeckSelections({});
                }
              }}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              ⚔️ 1v1
            </button>
          </div>

          <CasualParticipantPicker
            selectedIds={participantIds}
            onAdd={addParticipant}
            onRemove={removeParticipant}
            currentUserId={currentUser?.id}
          />
        </div>
      )}

      {/* Placements + decks */}
      {participantIds.length >= 2 && (
        <PlacementInput
          participants={participantIds}
          members={contextType === "league" ? members : casualMembersForPlacement}
          placements={placements}
          onPlacementChange={setPlacement}
          myDecks={myDecks}
          deckSelections={deckSelections}
          onDeckChange={setDeck}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Metadata */}
      {participantIds.length >= 2 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Date Played</label>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              placeholder="Any notes about this game…"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none placeholder-gray-600"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{submitError}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={!allPlacementsFilled || submitting}
        className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span className="flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting…
          </span>
        ) : (
          "Submit Game"
        )}
      </Button>
    </form>
  );
}