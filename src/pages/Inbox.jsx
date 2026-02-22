import React, { useState, useEffect, useRef } from "react";
import { Bell, Lock, AlertCircle, RefreshCw, Swords, ChevronRight } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { base44 } from "@/api/base44Client";
import { listMyPendingApprovals } from "@/components/services/gameService";
import { invalidateLeagueCache } from "@/components/services/leagueService";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";
import { formatDistanceToNow } from "date-fns";

function ApprovalRow({ row, onClick }) {
  const { game, leagueName, submittedByName } = row;
  const names = game.participants.map((p) => p.display_name);
  const preview =
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/40 transition-colors text-left border-b border-gray-800/50 last:border-0"
    >
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-sm font-medium truncate">{leagueName}</span>
          <span className="text-gray-500 text-xs shrink-0">
            {formatDistanceToNow(new Date(game.played_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-gray-400 text-xs truncate">{preview}</p>
        {submittedByName && (
          <p className="text-gray-600 text-xs">Logged by {submittedByName}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </button>
  );
}

export default function Inbox() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser } = auth;

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  // Modal state — driven by query params
  const [selectedRow, setSelectedRow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("gameId");
    return gameId ? gameId : null;
  });

  async function loadApprovals() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyPendingApprovals(auth);
      setApprovals(rows);
    } catch (e) {
      const isRateLimit =
        e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setError(
        isRateLimit
          ? "Too many requests right now. Please wait a few seconds and try again."
          : e.message || "Failed to load approvals."
      );
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  useEffect(() => {
    if (authLoading || isGuest) return;
    loadApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  function openModal(gameId) {
    setSelectedRow(gameId);
    const url = new URL(window.location.href);
    url.searchParams.set("gameId", gameId);
    window.history.replaceState(null, "", url.toString());
  }

  function closeModal() {
    setSelectedRow(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("gameId");
    window.history.replaceState(null, "", url.toString());
  }

  async function handleActionComplete(leagueId) {
    // Invalidate relevant caches
    if (leagueId) invalidateLeagueCache(leagueId);
    closeModal();
    // Reload inbox — force a fresh fetch
    fetchingRef.current = false;
    await loadApprovals();
  }

  // ── Guest gate ──────────────────────────────────────────────────────────────
  if (authLoading) return <LoadingState message="Loading inbox…" />;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in to view approvals</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to approve or reject game results logged by your playgroup.
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 px-6"
          onClick={() => base44.auth.redirectToLogin()}
        >
          Sign In
        </Button>
      </div>
    );
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) return <LoadingState message="Loading approvals…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; loadApprovals(); }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────────────────
  if (approvals.length === 0) {
    return (
      <EmptyState
        title="No pending approvals"
        description="You're all caught up. New game submissions that need your approval will appear here."
      />
    );
  }

  // ── Pending modal row ────────────────────────────────────────────────────────
  const modalRow = selectedRow ? approvals.find((r) => r.game.id === selectedRow) : null;

  return (
    <>
      <div className="space-y-4">
        <p className="text-xs text-gray-500 px-1">
          {approvals.length} pending {approvals.length === 1 ? "approval" : "approvals"}
        </p>
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-0">
            {approvals.map((row) => (
              <ApprovalRow key={row.game.id} row={row} onClick={() => openModal(row.game.id)} />
            ))}
          </CardContent>
        </Card>
      </div>

      {modalRow && (
        <MatchDetailsModal
          game={modalRow.game}
          auth={auth}
          leagueId={modalRow.leagueId}
          onClose={closeModal}
          onActionComplete={() => handleActionComplete(modalRow.leagueId)}
        />
      )}
    </>
  );
}