/**
 * GameApproval — dedicated participant game review & approval page.
 *
 * Opens via ?gameId= (+ optional ?podId=, ?notifId=).
 * Lives inside the normal app shell (TopBar + BottomNav).
 *
 * Reuses:
 * - getGameDetailsForParticipant / getPodGameDetails from profileService
 * - approveGameWithPraise / rejectGame from gameService
 * - listMyDecks from deckService
 * - MatchResultsDisplay for podium
 * - GamePropsSection for view-only props
 * - PraiseSelector for optional praise on approval
 * - All approval engine / backend logic unchanged
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
  Trophy, Clock, Loader2, Layers, ChevronDown,
  ArrowLeft, Swords, Calendar, FileText, Users,
  CheckCircle2, XCircle, Shield
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Shared helpers (same as GameSummary) ─────────────────────────────────────

function formatLabel(fmt) {
  if (!fmt || fmt === "commander") return "Commander";
  return fmt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetaPill({ icon: Icon, label, className = "" }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

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

// ── Deck tile ─────────────────────────────────────────────────────────────────

function DeckTile({ deck, selected, onSelect, disabled }) {
  return (
    <button
      onClick={() => onSelect(deck.id)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
        selected
          ? "border-[rgb(var(--ds-primary-rgb))] bg-[rgba(var(--ds-primary-rgb),0.12)]"
          : "border-gray-700/50 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {/* Commander image or placeholder */}
      <div className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border ${selected ? "border-[rgba(var(--ds-primary-rgb),0.5)]" : "border-gray-700/50"}`}>
        {deck.commander_image_url ? (
          <img src={deck.commander_image_url} alt={deck.commander_name || deck.name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-gray-500 font-bold text-sm">{(deck.name || "?")[0].toUpperCase()}</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${selected ? "text-white" : "text-gray-200"}`}>{deck.name}</p>
        {deck.commander_name && (
          <p className="text-xs text-gray-500 truncate">{deck.commander_name}</p>
        )}
      </div>
      {/* Selected indicator */}
      {selected && (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "rgb(var(--ds-primary-rgb))" }} />
      )}
    </button>
  );
}

// ── Approval status summary ────────────────────────────────────────────────────

function ApprovalProgress({ participants }) {
  const nonCreators = participants.filter((p) => !p.is_creator);
  if (nonCreators.length === 0) return null;
  const approved = nonCreators.filter((p) => p.approval_status === "approved").length;
  const total = nonCreators.length;
  const rejected = nonCreators.filter((p) => p.approval_status === "rejected").length;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <Shield className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
      <span>{approved}/{total} approved{rejected > 0 ? ` · ${rejected} rejected` : ""}</span>
    </div>
  );
}

// ── Completion screen ─────────────────────────────────────────────────────────

function CompletionScreen({ outcome, gameId, podId, onBack }) {
  const navigate = useNavigate();
  const approved = outcome === "approved";

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6 min-h-[50vh]">
      <div
        className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
          approved
            ? "bg-emerald-500/15 border border-emerald-500/30"
            : "bg-red-500/15 border border-red-500/30"
        }`}
      >
        {approved
          ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          : <XCircle className="w-10 h-10 text-red-400" />
        }
      </div>

      <div className="space-y-2">
        <p className="text-white font-extrabold text-xl">
          {approved ? "Game approved!" : "Game rejected."}
        </p>
        <p className="text-gray-400 text-sm leading-relaxed max-w-[260px]">
          {approved
            ? "Your review has been submitted. The game will count once all players approve."
            : "Your rejection has been recorded. The game won't count until the issue is resolved."
          }
        </p>
      </div>

      <div className="flex gap-3 w-full max-w-[280px]">
        <Button
          variant="outline"
          className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl h-11"
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          className="flex-1 ds-btn-primary rounded-xl h-11"
          onClick={() => navigate(ROUTES.GAME_SUMMARY(gameId, { podId: podId || null }))}
        >
          View Game
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GameApproval() {
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

  // ── Deck state ──────────────────────────────────────────────────────────────
  const [myDecks, setMyDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  // ── Praise state ────────────────────────────────────────────────────────────
  const [praiseReceiver, setPraiseReceiver] = useState(null);
  const [praiseType, setPraiseType] = useState(null);

  // ── Action state ────────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(null); // "approve" | "reject" | null
  const [actionError, setActionError] = useState(null);
  const [outcome, setOutcome] = useState(null); // "approved" | "rejected" | null

  // ── Load game ──────────────────────────────────────────────────────────────
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
      if (!assembled) { setLoadError("Game not found or you don't have access."); return; }
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentProfileId = currentUser?.id;
  const currentAuthUserId = authUserId || currentUser?.user_id || null;

  const myParticipant = game?.participants?.find((p) => p.authUserId === currentAuthUserId);
  const canAct = !isGuest
    && myParticipant?.approval_status === "pending"
    && !myParticipant?.is_creator
    && game?.status === "pending";

  const isPodGame = game?.context_type === "pod" && !!game?.pod_id;

  // ── Load my decks once we know we can act ──────────────────────────────────
  useEffect(() => {
    if (!canAct || isGuest) return;
    setDecksLoading(true);
    listMyDecks(auth)
      .then((decks) => setMyDecks(decks.filter((d) => d.is_active !== false)))
      .catch(() => setMyDecks([]))
      .finally(() => setDecksLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleApprove() {
    if (actionLoading) return;
    if (!selectedDeckId) { setActionError("Select your deck before approving."); return; }
    setActionLoading("approve");
    setActionError(null);
    try {
      const praise = (praiseReceiver && praiseType) ? { receiverProfileId: praiseReceiver, praiseType } : null;
      await approveGameWithPraise(game.id, currentAuthUserId, currentProfileId, selectedDeckId, praise);
      setOutcome("approved");
    } catch (e) {
      const msg = e.message?.toLowerCase().includes("rate") || e.message?.includes("429")
        ? "Too many requests — wait a moment and try again."
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
      setOutcome("rejected");
    } catch (e) {
      const msg = e.message?.toLowerCase().includes("rate") || e.message?.includes("429")
        ? "Too many requests — wait a moment and try again."
        : (e.message || "Failed to reject.");
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
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
        <Shield className="w-10 h-10 text-gray-700 mx-auto" />
        <p className="text-gray-400">Sign in to review this game.</p>
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

  // ── Completion screen ────────────────────────────────────────────────────────
  if (outcome) {
    return (
      <CompletionScreen
        outcome={outcome}
        gameId={gameId}
        podId={podId}
        onBack={() => navigate(ROUTES.INBOX)}
      />
    );
  }

  // ── Safe redirect: game already finalized or user has no action ─────────────
  if (!canAct && game) {
    const alreadyResponded = myParticipant && myParticipant.approval_status !== "pending";
    const notAParticipant = !myParticipant;

    return (
      <div className="space-y-4 pb-6 pt-2">
        {/* Back row */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
          <div className="space-y-1.5">
            <p className="text-white font-semibold text-base">
              {notAParticipant
                ? "No action needed"
                : alreadyResponded
                ? "Already responded"
                : myParticipant?.is_creator
                ? "Waiting for others"
                : "Game finalized"
              }
            </p>
            <p className="text-gray-400 text-sm max-w-[240px]">
              {notAParticipant
                ? "You're not a participant in this game."
                : myParticipant?.approval_status === "approved"
                ? "You already approved this game."
                : myParticipant?.approval_status === "rejected"
                ? "You already rejected this game."
                : myParticipant?.is_creator
                ? "Waiting for other players to review."
                : "This game is no longer pending review."
              }
            </p>
          </div>
          <Button
            className="ds-btn-primary rounded-xl"
            onClick={() => navigate(ROUTES.GAME_SUMMARY(gameId, { podId: podId || null }))}
          >
            View Game Summary
          </Button>
        </div>
      </div>
    );
  }

  // ── Main approval view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6 pt-2">

      {/* ── Header row ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 border">
          Review Needed
        </Badge>
      </div>

      {/* ── Context + metadata card ───────────────────────────────────────────── */}
      <Section>
        <div className="px-4 pt-4 pb-4 space-y-3">
          {/* Context type */}
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

          {/* Date, players, approval progress */}
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

          {/* Approval progress */}
          <ApprovalProgress participants={game.participants || []} />

          {/* Notes */}
          {game.notes && (
            <div className="flex items-start gap-2 pt-1 border-t border-gray-800/40">
              <FileText className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-400 leading-relaxed">{game.notes}</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Results (podium) ──────────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Results</SectionLabel>
        <div className="px-4 pb-4 pt-2">
          <MatchResultsDisplay participants={game.participants} currentProfileId={currentProfileId} />
        </div>
      </Section>

      {/* ── View-only props (if present on pending game) ──────────────────────── */}
      {(game.participants || []).some((p) => p.praise_type) && (
        <Section>
          <SectionLabel>Props (submitted)</SectionLabel>
          <div className="px-4 pb-4">
            <GamePropsSection
              game={game}
              callerAuthUserId={currentAuthUserId}
              callerProfileId={currentProfileId}
            />
          </div>
        </Section>
      )}

      {/* ── Your deck selection ───────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Your deck for this game</SectionLabel>
        <div className="px-4 pb-4 space-y-2">
          {decksLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-800/50 animate-pulse" />
              ))}
            </div>
          ) : myDecks.length === 0 ? (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-4 py-3.5">
              <p className="text-sm text-gray-400">You have no active decks.</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Add a deck in your profile to select one here. You can still reject without a deck.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myDecks.map((deck) => (
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  selected={selectedDeckId === deck.id}
                  onSelect={setSelectedDeckId}
                  disabled={actionLoading !== null}
                />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Optional praise / props ───────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Give Props (optional)</SectionLabel>
        <div className="px-4 pb-4">
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
        </div>
      </Section>

      {/* ── Approve / Reject ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {actionError && (
          <p className="text-red-400 text-xs text-center">{actionError}</p>
        )}

        {!selectedDeckId && myDecks.length > 0 && (
          <p className="text-xs text-gray-600 text-center">Select your deck above to approve</p>
        )}

        <div className="flex gap-3">
          <Button
            className="flex-1 bg-red-600/80 hover:bg-red-600 text-white rounded-xl h-12 text-sm font-semibold"
            disabled={actionLoading !== null}
            onClick={handleReject}
          >
            {actionLoading === "reject" ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Rejecting…</>
            ) : (
              <><XCircle className="w-4 h-4 mr-1.5" /> Reject</>
            )}
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-sm font-semibold"
            disabled={actionLoading !== null || (!selectedDeckId && myDecks.length > 0) || decksLoading}
            onClick={handleApprove}
          >
            {actionLoading === "approve" ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Approving…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve</>
            )}
          </Button>
        </div>
      </div>

    </div>
  );
}