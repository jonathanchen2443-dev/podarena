import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { useAuth } from "@/components/auth/AuthContext";
import { createGameWithParticipants } from "@/components/services/gameService";
import { invalidateDashboardCache } from "@/components/services/dashboardService";
import { invalidateProfileStatsCache } from "@/components/services/profileStatsService";
import { invalidateProfileInsightsCache } from "@/components/services/profileInsightsService";
import { base44 } from "@/api/base44Client";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import PlacementInput from "@/components/loggame/PlacementInput";
import { Button } from "@/components/ui/button";
import { Swords, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function LogGame() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, authLoading } = auth;

  // Participants: list of { profileId, authUserId, display_name, avatar_url }
  const [participants, setParticipants] = useState([]);
  // placements keyed by profileId
  const [placements, setPlacements] = useState({});
  // deck selections keyed by profileId
  const [deckSelections, setDeckSelections] = useState({});
  const [myDecks, setMyDecks] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Seed the current user as the first participant
  useEffect(() => {
    if (!currentUser) return;
    setParticipants([{
      profileId: currentUser.id,
      authUserId: currentUser.user_id || null,
      display_name: currentUser.display_name || currentUser.full_name || "You",
      avatar_url: currentUser.avatar_url || null,
    }]);
    // Load decks for current user
    base44.entities.Deck.filter({ owner_id: currentUser.id }, "-created_date", 50)
      .then(setMyDecks)
      .catch(() => {});
  }, [currentUser?.id]);

  if (authLoading) return null;

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-gray-400 text-sm">You must be signed in to log a game.</p>
      </div>
    );
  }

  const selectedProfileIds = participants.map((p) => p.profileId);

  function handleAdd(profileId, participantData) {
    if (participants.length >= 4) return;
    setParticipants((prev) => [...prev, participantData]);
  }

  function handleRemove(profileId) {
    setParticipants((prev) => prev.filter((p) => p.profileId !== profileId));
    setPlacements((prev) => { const next = { ...prev }; delete next[profileId]; return next; });
    setDeckSelections((prev) => { const next = { ...prev }; delete next[profileId]; return next; });
  }

  function handlePlacementChange(profileId, value) {
    setPlacements((prev) => ({ ...prev, [profileId]: value }));
  }

  function handleDeckChange(profileId, deckId) {
    setDeckSelections((prev) => ({ ...prev, [profileId]: deckId }));
  }

  // Validate form
  function validate() {
    if (participants.length < 2) return "Add at least 2 participants.";
    if (participants.length > 4) return "Maximum 4 participants allowed.";
    for (const p of participants) {
      if (!placements[p.profileId]) return `Set a placement for ${p.display_name}.`;
    }
    // Ensure no duplicate placements
    const usedPlacements = Object.values(placements).filter(Boolean).map(Number);
    if (new Set(usedPlacements).size !== usedPlacements.length) return "Each participant must have a unique placement.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSubmitting(true);
    try {
      // Build the participant list with deck data
      const allDecks = await base44.entities.Deck.filter({ owner_id: currentUser.id }, "-created_date", 50);
      const deckMap = Object.fromEntries(allDecks.map((d) => [d.id, d]));

      const participantPayload = participants.map((p) => {
        const deckId = deckSelections[p.profileId] || null;
        const deckData = deckId ? deckMap[deckId] : null;
        return {
          profileId: p.profileId,
          authUserId: p.authUserId || null,
          deck_id: deckId,
          deckData,
          placement: placements[p.profileId] || null,
          result: placements[p.profileId] === 1 ? "win" : "loss",
        };
      });

      await createGameWithParticipants({
        leagueId: null,
        contextType: "casual",
        creatorProfileId: currentUser.id,
        creatorAuthUserId: currentUser.user_id || null,
        playedAt: new Date().toISOString(),
        notes,
        participants: participantPayload,
      });

      // Bust caches so creator immediately sees pending game on Dashboard/Profile
      invalidateDashboardCache(currentUser.id);
      invalidateProfileStatsCache(currentUser.id);
      invalidateProfileInsightsCache(currentUser.id);

      toast.success("Game logged! Waiting for participants to confirm.");
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setError(err.message || "Failed to log game.");
    } finally {
      setSubmitting(false);
    }
  }

  // Members array expected by PlacementInput
  const members = participants.map((p) => ({
    userId: p.profileId,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  }));

  return (
    <div className="max-w-lg mx-auto py-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
          <Swords className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Log a Game</h1>
          <p className="text-xs text-gray-400">Casual · 2–4 players</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Participant picker */}
        <CasualParticipantPicker
          selectedIds={selectedProfileIds}
          onAdd={handleAdd}
          onRemove={handleRemove}
          currentUserProfileId={currentUser.id}
        />

        {/* Placements + deck */}
        {participants.length >= 2 && (
          <PlacementInput
            participants={selectedProfileIds}
            members={members}
            placements={placements}
            onPlacementChange={handlePlacementChange}
            myDecks={myDecks}
            deckSelections={deckSelections}
            onDeckChange={handleDeckChange}
            currentUserProfileId={currentUser.id}
          />
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
            Notes <span className="text-gray-600 normal-case">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes about the game…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting || participants.length < 2}
          className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold"
        >
          {submitting ? (
            "Submitting…"
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Submit Game
            </>
          )}
        </Button>
      </form>
    </div>
  );
}