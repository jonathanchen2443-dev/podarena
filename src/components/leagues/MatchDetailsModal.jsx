import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, CheckCircle, XCircle, Clock, ChevronDown, Loader2, Layers } from "lucide-react";
import { format } from "date-fns";
import { approveGame, rejectGame } from "@/components/services/gameService";
import { listMyDecks } from "@/components/services/deckService";
import { getPodGameDetails, getGameDetailsForParticipant } from "@/components/services/profileService.jsx";
import { ROUTES } from "@/components/utils/routes";
import MatchResultsDisplay from "@/components/leagues/MatchResultsDisplay";
import { toast } from "sonner";

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Rejected</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>;
}

/**
 * MatchDetailsModal — game details + participant review flow.
 *
 * Source of truth: GameParticipant.approval_status (not GameApproval).
 * Historical deck display: uses snapshot fields on GameParticipant.
 * Deck selection for approval: loads only the current user's own active Deck records.
 *
 * Can be used in three ways:
 * 1. With a pre-loaded `game` object (from Inbox/GamesTab)
 * 2. With `gameId` — self-fetch via RLS (works for direct participants)
 * 3. With `gameId` + `podId` — uses podGameDetails backend for pod-member access
 *    (works even when the caller was NOT a direct participant in the game)
 */
export default function MatchDetailsModal({ game: gameProp, gameId, podId, auth, onClose, onActionComplete }) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [myDecks, setMyDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  // Self-fetch mode
  const [fetchedGame, setFetchedGame] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(!gameProp && !!gameId);

  useEffect(() => {
    if (gameProp || !gameId) return;
    const callerProfileId = auth?.currentUser?.id;
    setFetchLoading(true);
    (async () => {
      try {
        // Pod-scoped path: use podGameDetails backend — works for any active pod member.
        if (podId && callerProfileId) {
          const assembled = await getPodGameDetails(gameId, podId, callerProfileId);
          if (!assembled) { onClose(); return; }
          setFetchedGame(assembled);
          return;
        }

        // Participant path: use backend so asServiceRole reads all participant rows safely.
        // authUserId is the Auth User ID (profile.user_id) — use auth.authUserId from context, not currentUser.user_id.
        const callerAuthUserId = auth?.authUserId || auth?.currentUser?.user_id || null;
        const assembled = await getGameDetailsForParticipant(gameId, callerAuthUserId);
        if (!assembled) { onClose(); return; }
        setFetchedGame(assembled);
      } catch (e) {
        toast.error("Could not load game details.");
        onClose();
      } finally {
        setFetchLoading(false);
      }
    })();
  }, [gameId, podId]);

  const game = gameProp || fetchedGame;

  const currentProfileId = auth.currentUser?.id;
  // auth.authUserId is the canonical Auth User ID from context — always prefer over currentUser.user_id
  const currentAuthUserId = auth.authUserId || auth.currentUser?.user_id || null;

  // canAct: I have a pending review row — derived from GameParticipant, not GameApproval
  const myParticipant = game?.participants?.find((p) => p.authUserId === currentAuthUserId);
  const canAct = !auth.isGuest && myParticipant?.approval_status === "pending" && !myParticipant?.is_creator && game?.status === "pending";

  useEffect(() => {
    if (!canAct || auth.isGuest) return;
    setDecksLoading(true);
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => setDecksLoading(false));
  }, [canAct]);

  if (fetchLoading || !game) {
    const loadingModal = (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--ds-primary-text)" }} />
        </div>
      </div>
    );
    const root = document.getElementById("modal-root");
    return root ? ReactDOM.createPortal(loadingModal, root) : loadingModal;
  }

  async function handleApprove() {
    if (actionLoading) return;
    if (!selectedDeckId) {
      setActionError("Please select the deck you played before approving.");
      return;
    }
    setActionLoading("approve");
    setActionError(null);
    try {
      await approveGame(game.id, currentAuthUserId, currentProfileId, selectedDeckId);
      toast.success("Game approved!");
      if (onActionComplete) await onActionComplete();
      onClose();
    } catch (e) {
      const msg = e.message?.toLowerCase().includes("rate") || e.message?.includes("429")
        ? "Too many requests. Wait a moment and try again."
        : (e.message || "Failed to approve.");
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (actionLoading) return;
    setActionLoading("reject");
    setActionError(null);
    try {
      await rejectGame(game.id, currentAuthUserId, currentProfileId, "");
      toast.success("Game rejected.");
      if (onActionComplete) await onActionComplete();
      onClose();
    } catch (e) {
      const msg = e.message?.toLowerCase().includes("rate") || e.message?.includes("429")
        ? "Too many requests. Wait a moment and try again."
        : (e.message || "Failed to reject.");
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  const { approved, rejected, pending, total } = game.approvalSummary;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-md bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
            <span className="text-white font-semibold text-sm">Match Details</span>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(game.status)}
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors ml-1">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* POD pill — compact, purple-styled, clickable */}
          {game.context_type === "pod" && (game.pod_name || game.pod_id) && (
            <div className="flex justify-center">
              <button
                onClick={() => { if (game.pod_id) { onClose(); navigate(ROUTES.POD(game.pod_id)); } }}
                disabled={!game.pod_id}
                className="inline-flex items-center gap-2 bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.30)] rounded-full px-3.5 py-1.5 transition-colors hover:bg-[rgba(124,58,237,0.20)] disabled:cursor-default"
              >
                <Layers className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
                <span className="text-sm text-violet-300 font-semibold">
                  {game.pod_name || "POD Game"}
                </span>
              </button>
            </div>
          )}

          {/* Participants — visual results display (no heading) */}
          <MatchResultsDisplay participants={game.participants} />

          {/* Date — centered, below results */}
          <p className="text-xs text-gray-500 text-center">
            {format(new Date(game.played_at), "PPP · p")}
          </p>

          {/* Approval confirmation — heading removed, content only */}
          {total > 0 && (
            <div className="space-y-1.5">
              {game.participants.filter((p) => !p.is_creator && p.approval_status === "approved").length > 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-emerald-400 font-medium">Approved: </span>
                  <span className="text-xs text-gray-300">
                    {game.participants.filter((p) => !p.is_creator && p.approval_status === "approved").map((p) => p.display_name).join(", ")}
                  </span>
                </div>
              )}
              {game.participants.filter((p) => !p.is_creator && p.approval_status === "pending").length > 0 && (
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-amber-400 font-medium">Pending: </span>
                  <span className="text-xs text-gray-300">
                    {game.participants.filter((p) => !p.is_creator && p.approval_status === "pending").map((p) => p.display_name).join(", ")}
                  </span>
                </div>
              )}
              {game.participants.filter((p) => !p.is_creator && p.approval_status === "rejected").length > 0 && (
                <div className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-red-400 font-medium">Rejected: </span>
                  <span className="text-xs text-gray-300">
                    {game.participants.filter((p) => !p.is_creator && p.approval_status === "rejected").map((p) => p.display_name).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {game.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-300">{game.notes}</p>
            </div>
          )}

          {actionError && <p className="text-red-400 text-xs">{actionError}</p>}
        </div>

        {/* Review action footer — only shown when current user has a pending review */}
        {canAct && (
          <div className="px-5 py-4 border-t border-gray-800/60 space-y-3">
            {/* Deck selector — current user's own active decks only */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Your deck <span className="text-red-400">(required to approve)</span>
              </label>
              {decksLoading ? (
                <div className="h-10 rounded-lg bg-gray-800/50 animate-pulse" />
              ) : myDecks.length === 0 ? (
                <p className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2.5">
                  No active decks found. Create one in your profile first.
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedDeckId || ""}
                    onChange={(e) => setSelectedDeckId(e.target.value || null)}
                    disabled={actionLoading !== null}
                    className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 pr-8 text-sm text-white focus:outline-none focus:border-[rgb(var(--ds-primary-rgb))] appearance-none disabled:opacity-50"
                  >
                    <option value="">— Select your deck —</option>
                    {myDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.commander_name ? ` · ${d.commander_name}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-red-600/80 hover:bg-red-600 text-white rounded-xl h-11"
                disabled={actionLoading !== null}
                onClick={handleReject}
              >
                {actionLoading === "reject" ? "Rejecting…" : "Reject"}
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11"
                disabled={actionLoading !== null || !selectedDeckId || decksLoading}
                onClick={handleApprove}
              >
                {actionLoading === "approve" ? "Approving…" : "Approve"}
              </Button>
            </div>
          </div>
        )}

        {!canAct && !auth.isGuest && game.status === "pending" && (
          <div className="px-5 py-3 border-t border-gray-800/60">
            <p className="text-xs text-gray-600 text-center">
              {myParticipant
                ? myParticipant.approval_status === "approved" ? "You already approved this game." : "You already responded to this game."
                : "You are not a participant in this game."}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const root = document.getElementById("modal-root");
  return root ? ReactDOM.createPortal(modal, root) : modal;
}