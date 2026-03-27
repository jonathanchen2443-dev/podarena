import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, EyeOff, Eye, AlertTriangle, RefreshCw, Gamepad2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function statusColor(status) {
  if (status === "approved") return "text-emerald-400";
  if (status === "rejected") return "text-red-400";
  return "text-amber-400";
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-gray-950 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">{body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-gray-700 text-gray-300"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className={`flex-1 ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GameCard({ game, onHide, onRestore, onDelete }) {
  const [confirm, setConfirm] = useState(null); // null | "hide" | "restore" | "delete"
  const [acting, setActing] = useState(false);

  async function act(fn, successMsg) {
    setActing(true);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e) {
      toast.error(e.message || "Action failed.");
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  const date = game.played_at ? format(new Date(game.played_at), "MMM d, yyyy") : "Unknown date";
  const createdDate = game.created_date ? format(new Date(game.created_date), "MMM d, yyyy") : null;

  const confirmConfig = {
    hide: {
      title: "Hide this game?",
      body: "The game will be hidden from all normal app surfaces (activity, history, leaderboard, stats). It remains in the Founder console and can be restored at any time.",
      confirmLabel: "Hide Game",
      confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
      fn: () => act(onHide, "Game hidden."),
    },
    restore: {
      title: "Restore this game?",
      body: "The game will become visible again across all normal app surfaces, and will be included in stats and leaderboard calculations.",
      confirmLabel: "Restore Game",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      fn: () => act(onRestore, "Game restored."),
    },
    delete: {
      title: "Permanently delete this game?",
      body: "⚠️ This is irreversible. The Game record, all GameParticipant rows, all related Notifications, and all GameApproval rows for this game will be permanently deleted. This cannot be undone. The game will vanish from all history, stats, and leaderboards forever.",
      confirmLabel: "Delete Forever",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
      fn: () => act(onDelete, "Game permanently deleted."),
    },
  };

  const cfg = confirm ? confirmConfig[confirm] : null;

  return (
    <>
      {cfg && (
        <ConfirmModal
          title={cfg.title}
          body={cfg.body}
          confirmLabel={cfg.confirmLabel}
          confirmClass={cfg.confirmClass}
          onConfirm={cfg.fn}
          onCancel={() => setConfirm(null)}
          loading={acting}
        />
      )}
      <div className={`bg-gray-800/50 border rounded-xl p-3 space-y-2 ${game.is_hidden ? "border-amber-600/30" : "border-gray-700/50"}`}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-gray-500 truncate">{game.id}</span>
              {game.is_hidden && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">HIDDEN</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium ${statusColor(game.status)}`}>{game.status}</span>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-400">{game.context_type === "pod" ? "POD" : "Casual"}</span>
              {game.pod_name && (
                <>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-300 truncate">{game.pod_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
          <span>Played: {date}</span>
          {createdDate && <span>Logged: {createdDate}</span>}
          {game.participant_count != null && <span>{game.participant_count} players</span>}
          {game.participant_names && <span className="text-gray-400">{game.participant_names}</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-0.5">
          {game.is_hidden ? (
            <button
              onClick={() => setConfirm("restore")}
              className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2 py-1 transition-colors"
            >
              <Eye className="w-3 h-3" /> Restore
            </button>
          ) : (
            <button
              onClick={() => setConfirm("hide")}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-2 py-1 transition-colors"
            >
              <EyeOff className="w-3 h-3" /> Hide
            </button>
          )}
          <button
            onClick={() => setConfirm("delete")}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-2 py-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Delete Forever
          </button>
        </div>
      </div>
    </>
  );
}

export default function FounderGameSection({ auth }) {
  const [gameIdSearch, setGameIdSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    setLoading(true);
    setSearched(true);
    try {
      const res = await base44.functions.invoke('publicProfiles', {
        action: 'founderListGames',
        callerProfileId: auth.currentUser?.id,
        callerAuthUserId: auth.authUserId,
        gameId: gameIdSearch.trim() || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        includeHidden: showHidden,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setGames(res.data?.games || []);
    } catch (e) {
      toast.error(e.message || "Search failed.");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  async function hideGame(gameId) {
    await base44.functions.invoke('publicProfiles', {
      action: 'founderHideGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, is_hidden: true } : g));
  }

  async function restoreGame(gameId) {
    await base44.functions.invoke('publicProfiles', {
      action: 'founderRestoreGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, is_hidden: false } : g));
  }

  async function hardDeleteGame(gameId) {
    await base44.functions.invoke('publicProfiles', {
      action: 'founderHardDeleteGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    setGames((prev) => prev.filter((g) => g.id !== gameId));
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Gamepad2 className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
        <h2 className="text-white font-semibold text-sm">Game Management</h2>
        <span className="text-xs text-gray-600">Founder only</span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <Input
            value={gameIdSearch}
            onChange={(e) => setGameIdSearch(e.target.value)}
            placeholder="Game ID (exact or partial)…"
            className="pl-8 bg-gray-800 border-gray-700 text-white rounded-xl h-9 text-xs"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wider">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[rgb(var(--ds-primary-rgb))]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wider">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[rgb(var(--ds-primary-rgb))]"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 cursor-pointer"
            style={{ accentColor: "rgb(var(--ds-primary-rgb))" }}
          />
          <span className="text-xs text-gray-400">Include hidden/archived games</span>
        </label>
      </div>

      <Button
        size="sm"
        className="w-full ds-btn-primary rounded-xl h-9 text-xs"
        onClick={search}
        disabled={loading}
      >
        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Search className="w-3.5 h-3.5 mr-1" /> Search Games</>}
      </Button>

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{games.length} game{games.length !== 1 ? "s" : ""} found</p>
          {games.length === 0 ? (
            <div className="py-6 text-center text-gray-600 text-xs">No games match the search criteria.</div>
          ) : (
            games.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onHide={() => hideGame(g.id)}
                onRestore={() => restoreGame(g.id)}
                onDelete={() => hardDeleteGame(g.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}