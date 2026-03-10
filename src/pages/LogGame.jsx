import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Swords, Loader2, AlertCircle, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContext";
import { LoadingState } from "@/components/shell/PageStates";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { listMyDecks } from "@/components/services/deckService";
import { createGameWithParticipants } from "@/components/services/gameService";
import { ROUTES } from "@/components/utils/routes";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import PlacementInput from "@/components/loggame/PlacementInput";

export default function LogGame() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;
  const navigate = useNavigate();

  const returnTo = new URLSearchParams(window.location.search).get("returnTo");

  // participantMap: { [profileId]: { profileId, authUserId, display_name, avatar_url } }
  const [participantMap, setParticipantMap] = useState({});
  // participantIds: Profile.id[] (ordered)
  const [participantIds, setParticipantIds] = useState([]);
  const [myDecks, setMyDecks] = useState([]);
  const [placements, setPlacements] = useState({});
  const [deckSelections, setDeckSelections] = useState({});
  const [playedAt, setPlayedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const decksFetchRef = useRef(false);

  function todayISO() { return new Date().toISOString().slice(0, 16); }

  function handleBack() {
    if (returnTo) navigate(-1);
    else navigate(ROUTES.HOME);
  }

  // Load creator's decks
  useEffect(() => {
    if (authLoading || isGuest) return;
    if (decksFetchRef.current) return;
    decksFetchRef.current = true;
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => { decksFetchRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  // Auto-add current user as first participant
  useEffect(() => {
    if (!currentUser?.id || authLoading) return;
    const profileId = currentUser.id;
    setParticipantIds((prev) => prev.includes(profileId) ? prev : [profileId, ...prev]);
    setParticipantMap((prev) => ({
      ...prev,
      [profileId]: {
        profileId,
        authUserId: currentUser.user_id || null,
        display_name: currentUser.display_name || "You",
        avatar_url: currentUser.avatar_url || null,
      },
    }));
  }, [currentUser?.id, authLoading]);

  function addParticipant(profileId, participantData) {
    if (participantIds.includes(profileId)) return;
    if (participantIds.length >= 4) return;
    setParticipantIds((prev) => [...prev, profileId]);
    if (participantData) {
      setParticipantMap((prev) => ({ ...prev, [profileId]: participantData }));
    }
  }

  function removeParticipant(profileId) {
    setParticipantIds((prev) => prev.filter((id) => id !== profileId));
    setPlacements((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
    setDeckSelections((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
    setParticipantMap((prev) => { const n = { ...prev }; delete n[profileId]; return n; });
  }

  function setPlacement(profileId, val) { setPlacements((prev) => ({ ...prev, [profileId]: val })); }
  function setDeck(profileId, deckId) { setDeckSelections((prev) => ({ ...prev, [profileId]: deckId })); }

  function validate() {
    if (participantIds.length < 2) return "Please add at least 2 participants.";
    if (participantIds.length > 4) return "Maximum 4 participants allowed.";
    const usedPlacements = participantIds.map((id) => placements[id]).filter(Boolean);
    if (usedPlacements.length !== participantIds.length) return "All participants must have a placement.";
    const uniquePlacements = new Set(usedPlacements);
    if (uniquePlacements.size !== usedPlacements.length) return "Each placement must be unique.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    const err = validate();
    if (err) { setSubmitError(err); return; }

    setSubmitting(true);
    try {
      // Fetch deck objects for snapshot at game time
      const deckIds = [...new Set(Object.values(deckSelections).filter(Boolean))];
      let deckDataMap = {};
      if (deckIds.length > 0) {
        const deckFetches = await Promise.all(deckIds.map((id) => base44.entities.Deck.filter({ id })));
        deckFetches.forEach((arr) => { if (arr[0]) deckDataMap[arr[0].id] = arr[0]; });
      }

      const creatorProfileId = currentUser.id;
      // Get auth user id from profile.user_id (backfilled at registration)
      const creatorAuthUserId = currentUser.user_id || null;

      const participants = participantIds.map((profileId) => {
        const info = participantMap[profileId] || {};
        const deckId = deckSelections[profileId] || null;
        return {
          profileId,
          authUserId: info.authUserId || null,
          deck_id: deckId,
          deckData: deckId ? deckDataMap[deckId] : null,
          placement: placements[profileId],
          result: placements[profileId] === 1 ? "win" : "loss",
        };
      });

      await createGameWithParticipants({
        leagueId: null,
        contextType: "casual",
        creatorProfileId,
        creatorAuthUserId,
        playedAt: playedAt ? new Date(playedAt).toISOString() : new Date().toISOString(),
        notes,
        participants,
      });

      toast.success("Game logged! Waiting for participant approvals.");
      navigate(ROUTES.INBOX);
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

  if (authLoading) return <LoadingState message="Loading…" />;

  const topNav = (
    <div className="flex items-center justify-between mb-5">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/60 rounded-xl px-3 py-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <Link
        to={ROUTES.PROFILE}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors ds-accent-bg ds-accent-bd border"
      >
        <User className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
      </Link>
    </div>
  );

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        {topNav}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center ds-accent-bg ds-accent-bd border">
          <Lock className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in to Log a Game</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to log a game and submit it for approval.</p>
        </div>
        <Button className="ds-btn-primary text-white rounded-xl h-11 px-6" onClick={() => base44.auth.redirectToLogin()}>
          Sign In
        </Button>
      </div>
    );
  }

  const allPlacementsFilled = participantIds.length >= 2 && participantIds.every((id) => placements[id]);

  const membersForPlacement = participantIds.map((profileId) => ({
    userId: profileId,
    display_name: participantMap[profileId]?.display_name || profileId,
    avatar_url: participantMap[profileId]?.avatar_url || null,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {topNav}

      <div className="rounded-xl p-4 ds-accent-bg ds-accent-bd border">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ds-primary-text)" }}>
          🎲 Log a casual game. All participants will be asked to approve the result.
        </p>
      </div>

      <CasualParticipantPicker
        selectedIds={participantIds}
        onAdd={addParticipant}
        onRemove={removeParticipant}
        currentUserProfileId={currentUser?.id}
      />

      {participantIds.length >= 2 && (
        <PlacementInput
          participants={participantIds}
          members={membersForPlacement}
          placements={placements}
          onPlacementChange={setPlacement}
          myDecks={myDecks}
          deckSelections={deckSelections}
          onDeckChange={setDeck}
          currentUserProfileId={currentUser?.id}
        />
      )}

      {participantIds.length >= 2 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Date Played</label>
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
              placeholder="Any notes about this game…"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] resize-none placeholder-gray-600"
            />
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{submitError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!allPlacementsFilled || submitting}
        className="w-full h-12 rounded-xl ds-btn-primary text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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