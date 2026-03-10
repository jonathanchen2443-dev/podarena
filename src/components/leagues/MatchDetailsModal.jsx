import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, User, CheckCircle, XCircle, Clock, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { approveGame, rejectGame, setMyDeckForGame } from "@/components/services/gameService";
import { listMyDecks } from "@/components/services/deckService";
import { getPublicProfile } from "@/components/services/profileService.jsx";
import RecentDecksIcon from "@/components/leagues/RecentDecksIcon";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { ROUTES } from "@/components/utils/routes";

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Rejected</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>;
}

function resultLabel(p) {
  if (p.result === "win" || p.placement === 1) return { text: "Win", cls: "text-emerald-400" };
  if (p.result === "draw") return { text: "Draw", cls: "text-blue-400" };
  if (p.result === "loss" || (p.placement != null && p.placement > 1)) return { text: `Loss`, cls: "text-red-400" };
  return null;
}

function ParticipantRow({ p, onNavigate }) {
  const result = resultLabel(p);
  const colors = p.deck?.color_identity || [];
  const hasRealColors = colors.some((c) => ["W","U","B","R","G"].includes(c));
  const deckVariant = !p.deck ? "didNotPlay" : hasRealColors ? "deck" : "colorless";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/40 last:border-0">
      <div className="w-8 h-8 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={p.display_name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <User className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => p.userId && onNavigate && onNavigate(p.userId)}
          className="text-sm text-white font-medium truncate hover:underline text-left disabled:cursor-default"
          disabled={!p.userId || !onNavigate}
        >
          {p.display_name}
        </button>
        {p.deck ? (
          <p className="text-xs text-gray-500 truncate">{p.deck.name}</p>
        ) : (
          <p className="text-xs text-gray-600 italic">No deck</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <RecentDecksIcon
          variant={deckVariant}
          colors={colors}
          size={20}
          title={p.deck?.name}
        />
        {result && (
          <span className={`text-xs font-semibold ${result.cls}`}>{result.text}</span>
        )}
        {p.placement != null && (
          <span className="text-xs text-gray-500">#{p.placement}</span>
        )}
      </div>
    </div>
  );
}

/**
 * MatchDetailsModal can be used in two ways:
 * 1. With a pre-loaded `game` object (from Inbox/GamesTab)
 * 2. With just a `gameId` prop — the modal fetches its own data (from Dashboard casual games)
 */
export default function MatchDetailsModal({ game: gameProp, gameId, auth, leagueId, onClose, onActionComplete }) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [myDecks, setMyDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  // Self-fetch mode: when only gameId is provided (no pre-loaded game)
  const [fetchedGame, setFetchedGame] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(!gameProp && !!gameId);

  useEffect(() => {
    if (gameProp || !gameId) return;
    setFetchLoading(true);
    (async () => {
      try {
        const [gameArr, approvalArr, participantArr] = await Promise.all([
          base44.entities.Game.filter({ id: gameId }),
          base44.entities.GameApproval.filter({ game_id: gameId }),
          base44.entities.GameParticipant.filter({ game_id: gameId }),
        ]);
        const g = gameArr[0];
        if (!g) { onClose(); return; }
        // Resolve participant identities via the public-safe backend layer.
        // getPublicProfile() uses asServiceRole + field sanitization — email never exposed.
        const profileResults = await Promise.allSettled(
          participantArr.map((p) => getPublicProfile(p.participant_profile_id || p.user_id))
        );
        const participants = participantArr.map((p, i) => {
          const pub = profileResults[i].status === "fulfilled" ? profileResults[i].value : null;
          const profileId = p.participant_profile_id || p.user_id;
          return {
            userId: profileId,             // Profile.id — for display/navigation
            authUserId: p.participant_user_id || null,  // Auth UID
            display_name: pub?.display_name || "Unknown",
            avatar_url: pub?.avatar_url || null,
            result: p.result,
            placement: p.placement,
            deck_id: p.selected_deck_id || p.deck_id,
            deck: (p.selected_deck_id || p.deck_id) ? {
              id: p.selected_deck_id || p.deck_id,
              name: p.deck_name_at_time || null,
              color_identity: p.deck_snapshot_json?.color_identity || [],
            } : null,
          };
        });
        const approvedCount = approvalArr.filter((a) => a.status === "approved").length;
        const assembled = {
          id: g.id,
          status: g.status,
          played_at: g.played_at || g.created_date,
          notes: g.notes || "",
          context_type: g.context_type || "casual",
          participants,
          approvalSummary: {
            total: approvalArr.length,
            approved: approvedCount,
            rejected: approvalArr.filter((a) => a.status === "rejected").length,
            pending: approvalArr.filter((a) => a.status === "pending").length,
            records: approvalArr,
          },
        };
        setFetchedGame(assembled);
      } catch (e) {
        toast.error("Could not load game details.");
        onClose();
      } finally {
        setFetchLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const game = gameProp || fetchedGame;

  // For permission checks: use auth user id (not Profile.id)
  // currentUser.user_id = Auth UID; currentUser.id = Profile.id
  const currentProfileId = auth.currentUser?.id;
  const currentAuthUserId = auth.currentUser?.user_id || null;

  // Find my approval by auth user id (approver_user_id is always Auth UID)
  const myApproval = game
    ? game.approvalSummary.records.find(
        (a) => a.approver_user_id === currentAuthUserId && a.status === "pending"
      )
    : null;
  // currentUserId kept for display/navigation lookups (Profile.id)
  const currentUserId = currentProfileId;
  const canAct = !auth.isGuest && !!myApproval && game?.status === "pending";

  useEffect(() => {
    if (!canAct || !game) return;
    // Match participant by Profile.id for display purposes
    const myParticipant = game.participants.find((p) => p.userId === currentProfileId);
    if (myParticipant?.deck_id) setSelectedDeckId(myParticipant.deck_id);
  }, [canAct, currentProfileId, game]);

  useEffect(() => {
    if (!canAct || auth.isGuest) return;
    setDecksLoading(true);
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => setDecksLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  if (fetchLoading || !game) {
    const loadingModal = (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 flex items-center justify-center">
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
      // Pass both auth user id (for permission) and profile id (for participant row update)
      await approveGame(game.id, currentAuthUserId, currentProfileId, selectedDeckId);
      toast.success("Game approved!");
      if (onActionComplete) await onActionComplete();
      onClose();
    } catch (e) {
      const isRate = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      const msg = isRate ? "Too many requests. Wait a moment and try again." : (e.message || "Failed to approve.");
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
      await rejectGame(game.id, currentUserId, "");
      toast.success("Game rejected.");
      if (onActionComplete) await onActionComplete();
      onClose();
    } catch (e) {
      const isRate = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      const msg = isRate ? "Too many requests. Wait a moment and try again." : (e.message || "Failed to reject.");
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  const { approved, rejected, pending, total, records } = game.approvalSummary;

  // Build per-name breakdown using participant data as a profile map
  const participantNameMap = {};
  game.participants.forEach((p) => { participantNameMap[p.userId] = p.display_name; });

  const approvedNames = records.filter((r) => r.status === "approved").map((r) => participantNameMap[r.approver_user_id] || "Unknown");
  const pendingNames  = records.filter((r) => r.status === "pending").map((r) => participantNameMap[r.approver_user_id] || "Unknown");
  const rejectedNames = records.filter((r) => r.status === "rejected").map((r) => participantNameMap[r.approver_user_id] || "Unknown");

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative z-10 w-full sm:max-w-md bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
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
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Date */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
            <p className="text-sm text-white">
              {format(new Date(game.played_at), "PPP · p")}
            </p>
          </div>

          {/* Participants */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Players · {game.participants.length}
            </p>
            <div>
              {game.participants
                .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
                .map((p) => (
                  <ParticipantRow
                    key={p.userId}
                    p={p}
                    onNavigate={(uid) => { onClose(); navigate(ROUTES.USER_PROFILE(uid)); }}
                  />
                ))}
            </div>
          </div>

          {/* Approvals breakdown */}
          {total > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Approvals · {approved}/{total} complete
              </p>
              <div className="space-y-1.5">
                {approvedNames.length > 0 && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-emerald-400 font-medium">Approved: </span>
                    <span className="text-xs text-gray-300">{approvedNames.join(", ")}</span>
                  </div>
                )}
                {pendingNames.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-amber-400 font-medium">Pending: </span>
                    <span className="text-xs text-gray-300">{pendingNames.join(", ")}</span>
                  </div>
                )}
                {rejectedNames.length > 0 && (
                  <div className="flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-400 font-medium">Rejected: </span>
                    <span className="text-xs text-gray-300">{rejectedNames.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {game.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-300">{game.notes}</p>
            </div>
          )}

          {/* Error */}
          {actionError && (
            <p className="text-red-400 text-xs">{actionError}</p>
          )}
        </div>

        {/* Action footer */}
        {canAct && (
          <div className="px-5 py-4 border-t border-gray-800/60 space-y-3">
            {/* Deck selector */}
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
            <p className="text-xs text-gray-600 text-center">You are not an approver for this game.</p>
          </div>
        )}
      </div>
    </div>
  );

  const root = document.getElementById("modal-root");
  return root ? ReactDOM.createPortal(modal, root) : modal;
}