/**
 * GameSummary — dedicated full-screen page for viewing a logged game's details.
 *
 * Lives inside the normal app shell (TopBar + BottomNav).
 * Opens via ?gameId= query param, optionally ?podId= for pod-scoped access.
 *
 * Reuses:
 * - getGameDetailsForParticipant / getPodGameDetails from profileService
 * - MatchResultsDisplay for the visual podium
 * - GamePropsSection for props/praise rendering
 * - approveGameWithPraise / rejectGame from gameService (approval actions kept stable)
 * - statusBadge + all existing data shapes
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { getPodGameDetails, getGameDetailsForParticipant } from "@/components/services/profileService.jsx";
import { approveGameWithPraise, rejectGame } from "@/components/services/gameService";
import { listMyDecks } from "@/components/services/deckService";
import { ROUTES } from "@/components/utils/routes";
import { base44 } from "@/api/base44Client";
import MatchResultsDisplay from "@/components/leagues/MatchResultsDisplay";
import GamePropsSection from "@/components/praise/GamePropsSection";
import PraiseSelector from "@/components/praise/PraiseSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy, CheckCircle, XCircle, Clock, Loader2, Layers,
  ChevronDown, ArrowLeft, Trash2, Swords, Calendar, FileText, Users
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 border">Rejected</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 border">Pending</Badge>;
}

function formatLabel(fmt) {
  if (!fmt || fmt === "commander") return "Commander";
  return fmt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Meta pill ─────────────────────────────────────────────────────────────────

function MetaPill({ icon: Icon, label, className = "" }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

// ── Approval status row ───────────────────────────────────────────────────────

function ApprovalStatusRow({ participants }) {
  const nonCreators = participants.filter((p) => !p.is_creator);
  if (nonCreators.length === 0) return null;

  const approved = nonCreators.filter((p) => p.approval_status === "approved");
  const pending = nonCreators.filter((p) => p.approval_status === "pending");
  const rejected = nonCreators.filter((p) => p.approval_status === "rejected");

  return (
    <div className="space-y-2">
      {approved.length > 0 && (
        <div className="flex items-start gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-emerald-400 font-medium">Approved: </span>
          <span className="text-xs text-gray-300">{approved.map((p) => p.display_name).join(", ")}</span>
        </div>
      )}
      {pending.length > 0 && (
        <div className="flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-amber-400 font-medium">Pending: </span>
          <span className="text-xs text-gray-300">{pending.map((p) => p.display_name).join(", ")}</span>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-red-400 font-medium">Rejected: </span>
          <span className="text-xs text-gray-300">{rejected.map((p) => p.display_name).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ children, className = "" }) {
  return (
    <div className={`bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold px-4 pt-3.5 pb-1.5">{children}</p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GameSummary() {
  const auth = useAuth();
  const { currentUser, authUserId, isGuest, authLoading } = auth;
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");
  const podId = params.get("podId") || null;

  // ── Data state ──────────────────────────────────────────────────────────────
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── Approval action state ───────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [myDecks, setMyDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [praiseReceiver, setPraiseReceiver] = useState(null);
  const [praiseType, setPraiseType] = useState(null);

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // isPodAdmin passed via query param (set by Pod page when navigating)
  const isPodAdminParam = params.get("isPodAdmin") === "1";

  // ── Load game data ──────────────────────────────────────────────────────────
  async function loadGame() {
    if (!gameId) { setLoadError("No game ID provided."); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      let assembled = null;
      if (podId && currentUser?.id) {
        assembled = await getPodGameDetails(gameId, podId, currentUser.id);
      }
      if (!assembled) {
        const callerAuthUserId = authUserId || currentUser?.user_id || null;
        assembled = await getGameDetailsForParticipant(gameId, callerAuthUserId);
      }
      if (!assembled) {
        setLoadError("Game not found or you don't have access.");
        return;
      }
      setGame(assembled);
    } catch (e) {
      setLoadError(e?.message || "Could not load game details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (isGuest) { setLoading(false); return; }
    loadGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest, gameId, podId]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const currentProfileId = currentUser?.id;
  const currentAuthUserId = authUserId || currentUser?.user_id || null;

  const myParticipant = game?.participants?.find((p) => p.authUserId === currentAuthUserId);
  const canAct = !isGuest && myParticipant?.approval_status === "pending" && !myParticipant?.is_creator && game?.status === "pending";

  const isPodGame = game?.context_type === "pod" && !!game?.pod_id;

  // Permission to delete: game creator OR POD admin (for POD games)
  const isGameCreator = game?.participants?.find((p) => p.is_creator)?.authUserId === currentAuthUserId;
  const isPodAdmin = isPodGame && isPodAdminParam;
  const canDelete = isGameCreator || isPodAdmin;

  // ── Load decks when approval is needed ─────────────────────────────────────
  useEffect(() => {
    if (!canAct || isGuest) return;
    setDecksLoading(true);
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => setDecksLoading(false));
  }, [canAct]);

  // ── Approval actions ────────────────────────────────────────────────────────
  async function handleApprove() {
    if (actionLoading) return;
    if (!selectedDeckId) { setActionError("Please select the deck you played before approving."); return; }
    setActionLoading("approve");
    setActionError(null);
    try {
      const praise = (praiseReceiver && praiseType) ? { receiverProfileId: praiseReceiver, praiseType } : null;
      await approveGameWithPraise(game.id, currentAuthUserId, currentProfileId, selectedDeckId, praise);
      toast.success("Game approved!");
      await loadGame();
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
      await loadGame();
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

  async function handleDeleteGame() {
    if (!currentAuthUserId || !currentProfileId || !game?.id) return;
    setDeleteLoading(true);
    try {
      const res = await base44.functions.invoke("founderGameActions", {
        action: "creatorDeleteGame",
        gameId: game.id,
        callerAuthUserId: currentAuthUserId,
        callerProfileId: currentProfileId,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Game deleted.");
      navigate(-1);
    } catch (e) {
      toast.error(e.message || "Failed to delete game.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ds-primary-text)" }} />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="text-center py-20 space-y-3">
        <Trophy className="w-10 h-10 text-gray-700 mx-auto" />
        <p className="text-gray-400">Sign in to view game details.</p>
        <Button onClick={() => base44.auth.redirectToLogin()} className="ds-btn-primary">Sign In</Button>
      </div>
    );
  }

  if (loadError || !game) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <Trophy className="w-10 h-10 text-gray-700" />
        <p className="text-gray-400 text-sm">{loadError || "Game not found."}</p>
        <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Go Back
        </Button>
      </div>
    );
  }

  const { approvalSummary } = game;
  const hasApprovalData = approvalSummary?.total > 0;

  return (
    <div className="space-y-4 pb-6 pt-2">

      {/* ── Page title row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {statusBadge(game.status)}
          {canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-colors"
              title="Delete this game"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── Meta header card ────────────────────────────────────────────────── */}
      <Section>
        <div className="px-4 pt-4 pb-4 space-y-3">
          {/* Context pill row */}
          <div className="flex flex-wrap gap-2">
            {isPodGame ? (
              <button
                onClick={() => game.pod_id && navigate(ROUTES.POD(game.pod_id))}
                disabled={!game.pod_id}
                className="inline-flex items-center gap-2 bg-[rgba(92,124,250,0.12)] border border-[rgba(92,124,250,0.30)] rounded-full px-3.5 py-1.5 transition-colors hover:bg-[rgba(92,124,250,0.20)] disabled:cursor-default"
              >
                <Layers className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                <span className="text-xs text-blue-300 font-semibold">{game.pod_name || "POD Game"}</span>
              </button>
            ) : (
              <MetaPill icon={Swords} label="Casual Game" className="bg-sky-500/10 text-sky-400 border border-sky-500/20" />
            )}
            <MetaPill
              icon={Trophy}
              label={formatLabel(game.game_format)}
              className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
            />
          </div>

          {/* Date + player count */}
          <div className="flex flex-wrap gap-2">
            <MetaPill
              icon={Calendar}
              label={game.played_at ? format(new Date(game.played_at), "PPP · p") : "Unknown date"}
              className="bg-gray-800/60 text-gray-400 border border-gray-700/50"
            />
            <MetaPill
              icon={Users}
              label={`${game.participants?.length || 0} players`}
              className="bg-gray-800/60 text-gray-400 border border-gray-700/50"
            />
          </div>

          {/* Notes */}
          {game.notes && (
            <div className="flex items-start gap-2 pt-1 border-t border-gray-800/40">
              <FileText className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-400 leading-relaxed">{game.notes}</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Results (podium) ────────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Results</SectionLabel>
        <div className="px-4 pb-4 pt-2">
          <MatchResultsDisplay participants={game.participants} currentProfileId={currentProfileId} />
        </div>
      </Section>

      {/* ── Props ───────────────────────────────────────────────────────────── */}
      {game.status === "approved" && (
        <Section>
          <SectionLabel>Props</SectionLabel>
          <div className="px-4 pb-4">
            <GamePropsSection game={game} callerAuthUserId={currentAuthUserId} callerProfileId={currentProfileId} />
          </div>
        </Section>
      )}

      {/* ── Approval status ─────────────────────────────────────────────────── */}
      {hasApprovalData && (
        <Section>
          <SectionLabel>Approvals</SectionLabel>
          <div className="px-4 pb-4">
            <ApprovalStatusRow participants={game.participants} />
          </div>
        </Section>
      )}

      {/* ── My approval action ──────────────────────────────────────────────── */}
      {canAct && (
        <Section>
          <SectionLabel>Your Review</SectionLabel>
          <div className="px-4 pb-4 space-y-3">
            {/* Deck selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-1.5">
                Your deck <span className="text-red-400 text-xs font-normal">(required to approve)</span>
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

            {/* Props (praise) selector */}
            {game?.participants && (
              <PraiseSelector
                participants={(game.participants || []).map((p) => ({
                  profileId: p.userId || p.profileId || p.participant_profile_id,
                  display_name: p.display_name,
                  avatar_url: p.avatar_url || null,
                }))}
                currentProfileId={currentProfileId}
                selectedReceiver={praiseReceiver}
                selectedPraise={praiseType}
                onReceiverChange={(val) => { setPraiseReceiver(val); if (!val) setPraiseType(null); }}
                onPraiseChange={setPraiseType}
              />
            )}

            {actionError && <p className="text-red-400 text-xs">{actionError}</p>}

            <div className="flex gap-3 pt-1">
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
        </Section>
      )}

      {/* Already responded */}
      {!canAct && !isGuest && game.status === "pending" && myParticipant && (
        <p className="text-xs text-gray-600 text-center">
          {myParticipant.approval_status === "approved"
            ? "You already approved this game."
            : myParticipant.is_creator
            ? "You submitted this game — waiting for others to approve."
            : "You already responded to this game."}
        </p>
      )}

      {/* ── POD admin delete confirm ─────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-red-400 text-sm font-semibold text-center">Delete this game permanently?</p>
          <p className="text-gray-400 text-xs text-center leading-relaxed">
            This will permanently remove the game, approvals, awarded props, and all score/stat effects. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={deleteLoading}
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteLoading}
              onClick={handleDeleteGame}
            >
              {deleteLoading ? "Deleting…" : "Delete Game"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}