import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, User, CheckCircle, XCircle, Clock, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { approveGame, rejectGame, setMyDeckForGame } from "@/components/services/gameService";
import { listMyDecks } from "@/components/services/deckService";
import RecentDecksIcon from "@/components/leagues/RecentDecksIcon";
import { toast } from "sonner";

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

function ParticipantRow({ p }) {
  const result = resultLabel(p);
  const colors = p.deck?.color_identity || [];
  const hasRealColors = colors.some((c) => ["W","U","B","R","G"].includes(c));
  const deckVariant = !p.deck ? "didNotPlay" : hasRealColors ? "deck" : "colorless";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/40 last:border-0">
      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={p.display_name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <User className="w-4 h-4 text-violet-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{p.display_name}</p>
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

export default function MatchDetailsModal({ game, auth, leagueId, onClose, onActionComplete }) {
  const [actionLoading, setActionLoading] = useState(null); // "approve" | "reject"
  const [actionError, setActionError] = useState(null);

  // Deck selection state
  const [myDecks, setMyDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  const currentUserId = auth.currentUser?.id;

  // Determine if current user is an eligible pending approver
  const myApproval = currentUserId
    ? game.approvalSummary.records.find(
        (a) => a.approver_user_id === currentUserId && a.status === "pending"
      )
    : null;
  const canAct = !auth.isGuest && !!myApproval && game.status === "pending";

  // Preselect deck if participant already has one recorded
  useEffect(() => {
    if (!canAct) return;
    const myParticipant = game.participants.find((p) => p.userId === currentUserId);
    if (myParticipant?.deck_id) setSelectedDeckId(myParticipant.deck_id);
  }, [canAct, currentUserId]);

  // Load active decks when user can act
  useEffect(() => {
    if (!canAct || auth.isGuest) return;
    setDecksLoading(true);
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => setDecksLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  async function handleApprove() {
    if (actionLoading) return;
    if (!selectedDeckId) {
      setActionError("Please select the deck you played before approving.");
      return;
    }
    setActionLoading("approve");
    setActionError(null);
    try {
      await setMyDeckForGame(auth, game.id, selectedDeckId);
      await approveGame(game.id, currentUserId);
      toast.success("Game approved!");
      await onActionComplete();
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
      await onActionComplete();
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
            <Trophy className="w-4 h-4 text-violet-400" />
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
                  <ParticipantRow key={p.userId} p={p} />
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
                    className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 pr-8 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none disabled:opacity-50"
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