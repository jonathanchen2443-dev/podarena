import React, { useState, useEffect, useRef } from "react";
import { listLeagueGames, invalidateLeagueCache } from "@/components/services/leagueService";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Swords, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] px-1.5">Rejected</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5">Pending</Badge>;
}

function GameRow({ game, onClick }) {
  const names = game.participants.map((p) => p.display_name);
  const preview = names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  const winner = game.participants.find((p) => p.result === "win" || p.placement === 1);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/40 transition-colors text-left border-b border-gray-800/50 last:border-0"
    >
      <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <Swords className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {statusBadge(game.status)}
          <span className="text-gray-500 text-xs">
            {formatDistanceToNow(new Date(game.played_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-white text-sm truncate font-medium">{preview}</p>
        {winner && game.status === "approved" && (
          <p className="text-gray-500 text-xs truncate">Winner: {winner.display_name}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </button>
  );
}

export default function GamesTab({ auth, leagueId }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(() =>
    new URLSearchParams(window.location.search).get("gameId")
  );

  // Guard against duplicate in-flight fetches
  const fetchingRef = useRef(false);

  async function loadGames(invalidate = false) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (invalidate) invalidateLeagueCache(leagueId);
    setLoading(true);
    setError(null);
    try {
      const data = await listLeagueGames(auth, leagueId);
      setGames(data);
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setError(isRateLimit
        ? "Too many requests right now. Please wait a few seconds and try again."
        : e.message
      );
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  // Only fetch once on mount (leagueId won't change while tab is mounted)
  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  function openGame(gameId) {
    setSelectedGameId(gameId);
    const url = new URL(window.location.href);
    url.searchParams.set("gameId", gameId);
    window.history.replaceState(null, "", url.toString());
  }

  function closeModal() {
    setSelectedGameId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("gameId");
    window.history.replaceState(null, "", url.toString());
  }

  // After approve/reject: invalidate cache and reload only games
  async function handleActionComplete() {
    invalidateLeagueCache(leagueId);
    await loadGames(true);
  }

  const selectedGame = games.find((g) => g.id === selectedGameId) || null;

  if (loading) return <LoadingState message="Loading games…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => loadGames(true)}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (games.length === 0) {
    return <EmptyState title="No games yet" description="Games will appear here after players log them." />;
  }

  return (
    <>
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-0">
          {games.map((game) => (
            <GameRow key={game.id} game={game} onClick={() => openGame(game.id)} />
          ))}
        </CardContent>
      </Card>

      {selectedGame && (
        <MatchDetailsModal
          game={selectedGame}
          auth={auth}
          leagueId={leagueId}
          onClose={closeModal}
          onActionComplete={handleActionComplete}
        />
      )}
    </>
  );
}