import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/components/auth/AuthContext";
import { createGameWithParticipants } from "@/components/services/gameService";
import { invalidateDashboardCache } from "@/components/services/dashboardService";
import { invalidateProfileStatsCache } from "@/components/services/profileStatsService";
import { invalidateProfileInsightsCache } from "@/components/services/profileInsightsService";
import { validatePODMembership } from "@/components/services/podService";
import { base44 } from "@/api/base44Client";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import PlacementInput from "@/components/loggame/PlacementInput";
import { Button } from "@/components/ui/button";
import { Swords, AlertCircle, CheckCircle2, Layers, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LogGame() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, authLoading } = auth;

  // URL params for POD context
  const urlParams = new URLSearchParams(window.location.search);
  const urlContextType = urlParams.get("contextType") || "casual";
  const urlPodId = urlParams.get("podId") || null;
  const urlPodName = urlParams.get("podName") ? decodeURIComponent(urlParams.get("podName")) : null;

  const isPodGame = urlContextType === "pod" && !!urlPodId;

  const [participants, setParticipants] = useState([]);
  const [placements, setPlacements] = useState({});
  const [deckSelections, setDeckSelections] = useState({});
  const [myDecks, setMyDecks] = useState([]);
  const [podMembers, setPodMembers] = useState([]); // for POD game: valid participants
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setParticipants([{
      profileId: currentUser.id,
      authUserId: currentUser.user_id || null,
      display_name: currentUser.display_name || currentUser.full_name || "You",
      avatar_url: currentUser.avatar_url || null,
    }]);
    base44.entities.Deck.filter({ owner_id: currentUser.id }, "-created_date", 50)
      .then(setMyDecks)
      .catch(() => {});

    // For POD games, load active POD members for participant picker
    if (isPodGame) {
      base44.entities.PODMembership.filter({ pod_id: urlPodId, membership_status: "active" })
        .then(async (memberships) => {
          const profileIds = memberships.map((m) => m.profile_id).filter(Boolean);
          const allProfiles = await base44.entities.Profile.list("-created_date", 200);
          const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
          setPodMembers(memberships.map((m) => ({
            profileId: m.profile_id,
            authUserId: m.user_id || null,
            display_name: profileMap[m.profile_id]?.display_name || "Unknown",
            avatar_url: profileMap[m.profile_id]?.avatar_url || null,
          })));
        })
        .catch(() => {});
    }
  }, [currentUser?.id, isPodGame, urlPodId]);

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

  function validate() {
    if (participants.length < 2) return "Add at least 2 participants.";
    if (participants.length > 4) return "Maximum 4 participants allowed.";
    for (const p of participants) {
      if (!placements[p.profileId]) return `Set a placement for ${p.display_name}.`;
    }
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
          result: Number(placements[p.profileId]) === 1 ? "win" : "loss",
        };
      });

      await createGameWithParticipants({
        leagueId: null,
        podId: isPodGame ? urlPodId : null,
        contextType: isPodGame ? "pod" : "casual",
        creatorProfileId: currentUser.id,
        creatorAuthUserId: currentUser.user_id || null,
        playedAt: new Date().toISOString(),
        notes,
        participants: participantPayload,
      });

      invalidateDashboardCache(currentUser.id);
      invalidateProfileStatsCache(currentUser.id);
      invalidateProfileInsightsCache(currentUser.id);

      toast.success("Game logged! Waiting for participants to confirm.");
      if (isPodGame && urlPodId) {
        navigate(`${createPageUrl("Pod")}?podId=${urlPodId}`);
      } else {
        navigate(ROUTES.DASHBOARD);
      }
    } catch (err) {
      setError(err.message || "Failed to log game.");
    } finally {
      setSubmitting(false);
    }
  }

  const members = participants.map((p) => ({
    userId: p.profileId,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  }));

  // For POD games, participant picker is a subset of POD members only
  const availablePodMembers = isPodGame
    ? podMembers.filter((m) => !selectedProfileIds.includes(m.profileId))
    : null;

  return (
    <div className="max-w-lg mx-auto py-4">
      {/* Back button for POD games */}
      {isPodGame && (
        <button
          onClick={() => navigate(`${createPageUrl("Pod")}?podId=${urlPodId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {urlPodName || "POD"}
        </button>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
          {isPodGame ? <Layers className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} /> : <Swords className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />}
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Log a Game</h1>
          <p className="text-xs text-gray-400">
            {isPodGame ? `POD Game · ${urlPodName || "Competitive"} · 2–4 players` : "Casual · 2–4 players"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Participant picker */}
        {isPodGame ? (
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-2 uppercase tracking-wider">
              Participants <span className="text-gray-600 normal-case">(active POD members only)</span>
            </label>
            {/* Current user is already seeded; add other POD members */}
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.profileId} className="flex items-center gap-3 bg-gray-900/60 border border-gray-800/50 rounded-xl px-4 py-2.5">
                  {p.avatar_url ? <img src={p.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">{(p.display_name || "?")[0]}</div>}
                  <span className="text-white text-sm flex-1">{p.display_name}</span>
                  {p.profileId !== currentUser.id && (
                    <button type="button" onClick={() => handleRemove(p.profileId)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                  )}
                </div>
              ))}
              {participants.length < 4 && availablePodMembers && availablePodMembers.length > 0 && (
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl overflow-hidden">
                  <p className="text-xs text-gray-500 px-4 py-2 border-b border-gray-800">Add POD member:</p>
                  {availablePodMembers.slice(0, 8).map((m) => (
                    <button
                      key={m.profileId}
                      type="button"
                      onClick={() => handleAdd(m.profileId, m)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
                    >
                      {m.avatar_url ? <img src={m.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">{(m.display_name || "?")[0]}</div>}
                      <span className="text-white text-sm">{m.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <CasualParticipantPicker
            selectedIds={selectedProfileIds}
            onAdd={handleAdd}
            onRemove={handleRemove}
            currentUserProfileId={currentUser.id}
          />
        )}

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

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting || participants.length < 2}
          className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold"
        >
          {submitting ? "Submitting…" : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Submit Game</>}
        </Button>
      </form>
    </div>
  );
}