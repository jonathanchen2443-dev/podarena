import React, { useState, useEffect, useRef, useCallback } from "react";
import { listLeagueGames, invalidateLeagueCache } from "@/components/services/leagueService";
import { LoadingState } from "@/components/shell/PageStates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Swords, ChevronRight, AlertCircle, RefreshCw, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import MatchDetailsModal from "@/components/leagues/MatchDetailsModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] px-1.5">Rejected</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5">Pending</Badge>;
}

function gameDate(game) {
  return game.played_at || game.created_date || game.created_at || "";
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
];

const VALID_STATUSES = new Set(["all", "pending", "approved", "rejected"]);
const VALID_SORTS = new Set(["newest", "oldest"]);

function readQP(key, valid, fallback) {
  const val = new URLSearchParams(window.location.search).get(key);
  return val && valid.has(val) ? val : fallback;
}

function applyFilterSort(games, statusFilter, sortOrder) {
  let result = statusFilter === "all" ? games : games.filter((g) => g.status === statusFilter);
  result = [...result].sort((a, b) => {
    const da = new Date(gameDate(a)).getTime() || 0;
    const db = new Date(gameDate(b)).getTime() || 0;
    return sortOrder === "oldest" ? da - db : db - da;
  });
  return result;
}

function emptyStateLabel(statusFilter) {
  if (statusFilter === "pending") return { title: "No pending games", desc: "There are no games awaiting approval right now." };
  if (statusFilter === "approved") return { title: "No approved games yet", desc: "Approved games will appear here." };
  if (statusFilter === "rejected") return { title: "No rejected games", desc: "No games have been rejected." };
  return { title: "No games yet", desc: "Games will appear here after players log them." };
}

function countLabel(count, statusFilter) {
  if (statusFilter === "all") return `${count} ${count === 1 ? "game" : "games"}`;
  return `${count} ${statusFilter} ${count === 1 ? "game" : "games"}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GameRow({ game, onClick }) {
  const names = game.participants.map((p) => p.display_name);
  const preview = names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  const winner = game.participants.find((p) => p.result === "win" || p.placement === 1);
  const date = gameDate(game);

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
          {date && (
            <span className="text-gray-500 text-xs">
              {formatDistanceToNow(new Date(date), { addSuffix: true })}
            </span>
          )}
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

function FilterBar({ statusFilter, setStatusFilter, sortOrder, setSortOrder, games }) {
  const pendingCount = games.filter((g) => g.status === "pending").length;

  return (
    <div className="space-y-2.5 mb-3">
      {/* Status chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id;
          const showBadge = f.id === "pending" && pendingCount > 0;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`flex items-center gap-1 h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-violet-600 text-white"
                  : "bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {f.label}
              {showBadge && (
                <span className={`ml-0.5 text-[10px] font-semibold ${isActive ? "text-violet-200" : "text-amber-400"}`}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort + count row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortOrder(s.id)}
              className={`flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
                sortOrder === s.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s.id === "newest" && <ArrowUpDown className="w-3 h-3" />}
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

// ── Main component ────────────────────────────────────────────────────────────

export default function GamesTab({ auth, leagueId, inviteToken = null }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Read filter/sort from query params on init
  const [statusFilter, setStatusFilterState] = useState(() =>
    readQP("gameStatus", VALID_STATUSES, "all")
  );
  const [sortOrder, setSortOrderState] = useState(() =>
    readQP("gameSort", VALID_SORTS, "newest")
  );
  const [selectedGameId, setSelectedGameId] = useState(() =>
    new URLSearchParams(window.location.search).get("gameId")
  );

  const fetchingRef = useRef(false);

  // ── Query param sync helpers ───────────────────────────────────────────────

  function updateQP(updates) {
    const url = new URL(window.location.href);
    Object.entries(updates).forEach(([k, v]) => {
      if (v == null) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    });
    window.history.replaceState(null, "", url.toString());
  }

  function setStatusFilter(val) {
    setStatusFilterState(val);
    updateQP({ gameStatus: val });
  }

  function setSortOrder(val) {
    setSortOrderState(val);
    updateQP({ gameSort: val });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadGames(invalidate = false) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (invalidate) invalidateLeagueCache(leagueId);
    setLoading(true);
    setError(null);
    try {
      const data = await listLeagueGames(auth, leagueId, { inviteToken });
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

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openGame(gameId) {
    setSelectedGameId(gameId);
    updateQP({ gameId });
  }

  function closeModal() {
    setSelectedGameId(null);
    updateQP({ gameId: null });
  }

  async function handleActionComplete() {
    closeModal();
    await loadGames(true);
  }

  // ── Derived list ──────────────────────────────────────────────────────────

  const filteredGames = applyFilterSort(games, statusFilter, sortOrder);
  const visibleGames = filteredGames.slice(0, visibleCount);
  const hasMore = filteredGames.length > visibleCount;
  const selectedGame = games.find((g) => g.id === selectedGameId) || null;

  // ── Render ────────────────────────────────────────────────────────────────

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

  const { title: emptyTitle, desc: emptyDesc } = emptyStateLabel(statusFilter);

  return (
    <>
      {/* Controls — always show if there are any games loaded */}
      {games.length > 0 && (
        <FilterBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          games={games}
        />
      )}

      {/* Count label */}
      {games.length > 0 && (
        <p className="text-xs text-gray-500 mb-2 px-0.5">
          {countLabel(filteredGames.length, statusFilter)}
        </p>
      )}

      {/* Empty state */}
      {games.length === 0 || filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
            <Swords className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">{emptyTitle}</p>
            <p className="text-gray-500 text-xs mt-0.5">{emptyDesc}</p>
          </div>
          {games.length > 0 && statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="text-violet-400 text-xs hover:text-violet-300 transition-colors"
            >
              Show all games
            </button>
          )}
        </div>
      ) : (
        <>
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-0">
              {visibleGames.map((game) => (
                <GameRow key={game.id} game={game} onClick={() => openGame(game.id)} />
              ))}
            </CardContent>
          </Card>
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full mt-2 py-2.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-gray-800/40 rounded-xl border border-gray-800/50 transition-colors"
            >
              Load more ({filteredGames.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}

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