import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Trash2, EyeOff, Eye, AlertTriangle, RefreshCw,
  Gamepad2, Trophy, ChevronRight, X, User,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { searchProfiles } from "@/components/services/profileService.jsx";

// ── Confirm Modal ─────────────────────────────────────────────────────────────

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
            <p className="text-gray-400 text-xs mt-1 leading-relaxed whitespace-pre-line">{body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 border-gray-700 text-gray-300" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" className={`flex-1 ${confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Participant Autocomplete ───────────────────────────────────────────────────

function ParticipantSearch({ value, onSelect, onClear }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handle(e) { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProfiles(q.trim());
        setSuggestions(results.slice(0, 8));
        setOpen(results.length > 0);
      } catch (_) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectProfile(profile) {
    onSelect(profile);
    setQuery(profile.display_name);
    setSuggestions([]);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onClear();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search by participant name…"
          className="w-full pl-8 pr-8 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 h-9 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[rgb(var(--ds-primary-rgb))]"
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 animate-spin" />}
        {value && !searching && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <span className="text-[10px] text-gray-500">Filtering by:</span>
          <span className="text-[10px] bg-[rgba(var(--ds-primary-rgb),0.15)] text-[var(--ds-primary-text)] border border-[rgba(var(--ds-primary-rgb),0.25)] px-2 py-0.5 rounded-full font-medium">
            {value.display_name}
          </span>
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
          {suggestions.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProfile(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 last:border-0"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                  {(p.display_name || "?")[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{p.display_name}</p>
                {p.public_user_id && <p className="text-[10px] text-gray-500 font-mono">#{p.public_user_id}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Game Card — styled like PodActivityTab rows + founder controls ─────────────

function FounderGameCard({ game, onHide, onRestore, onDelete }) {
  const [confirm, setConfirm] = useState(null); // null | "hide" | "restore" | "delete"
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function act(fn, successMsg) {
    setActing(true);
    setActionError(null);
    try {
      await fn();
      toast.success(successMsg);
      setConfirm(null);
    } catch (e) {
      const msg = e.message || "Action failed.";
      setActionError(msg);
      toast.error(msg);
      // Don't close modal on error — let user see the error and retry or cancel
    } finally {
      setActing(false);
    }
  }

  const date = game.played_at ? format(new Date(game.played_at), "MMM d, yyyy") : "Unknown date";

  const confirmConfig = {
    hide: {
      title: "Hide this game?",
      body: "The game will be removed from all normal app surfaces:\n• Activity feeds\n• Leaderboards & stats\n• Game history\n\nThe data is preserved and a Founder can restore it at any time.",
      confirmLabel: "Hide Game",
      confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
      fn: () => act(onHide, "Game hidden from app surfaces."),
    },
    restore: {
      title: "Restore this game?",
      body: "The game will become visible again across all normal app surfaces and will be included in stats, leaderboard, and activity feeds.",
      confirmLabel: "Restore",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      fn: () => act(onRestore, "Game restored to normal visibility."),
    },
    delete: {
      title: "Permanently delete this game?",
      body: "⚠️ IRREVERSIBLE — Cannot be undone.\n\nThis will permanently delete:\n• The Game record\n• All GameParticipant rows\n• All related review Notifications\n• All GameApproval rows\n\nThe game will vanish from all history, stats, and leaderboards forever.",
      confirmLabel: "Delete Forever",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
      fn: () => act(onDelete, "Game permanently deleted."),
    },
  };

  const cfg = confirm ? confirmConfig[confirm] : null;

  const statusCls = game.status === "approved"
    ? "bg-green-500/10 text-green-400"
    : game.status === "rejected"
    ? "bg-red-500/10 text-red-400"
    : "bg-amber-500/10 text-amber-400";

  return (
    <>
      {cfg && (
        <ConfirmModal
          title={cfg.title}
          body={cfg.body}
          confirmLabel={cfg.confirmLabel}
          confirmClass={cfg.confirmClass}
          onConfirm={cfg.fn}
          onCancel={() => { setConfirm(null); setActionError(null); }}
          loading={acting}
        />
      )}

      {/* Card — mirrors PodActivityTab GameRow style */}
      <div className={`border rounded-2xl overflow-hidden ${game.is_hidden ? "border-amber-600/30 bg-amber-500/5" : "border-gray-800/50 bg-gray-900/60"}`}>
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${game.is_hidden ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
            <Trophy className={`w-4 h-4 ${game.is_hidden ? "text-amber-600" : "text-amber-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white text-sm font-medium">
                {game.participant_count != null ? `${game.participant_count}-player` : ""}{" "}
                {game.context_type === "pod" ? "POD game" : "Casual game"}
              </p>
              {game.is_hidden && (
                <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-medium">HIDDEN</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-gray-500 text-xs">{date}</span>
              {game.pod_name && <span className="text-gray-400 text-xs">· {game.pod_name}</span>}
              {game.participant_names && <span className="text-gray-500 text-xs">· {game.participant_names}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>{game.status}</span>
          </div>
        </div>

        {/* ID row */}
        <div className="px-4 pb-2">
          <p className="text-[10px] font-mono text-gray-600 truncate">{game.id}</p>
        </div>

        {/* Founder controls */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800/40 bg-gray-800/20">
          {game.is_hidden ? (
            <button
              onClick={() => setConfirm("restore")}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 transition-colors font-medium"
            >
              <Eye className="w-3.5 h-3.5" /> Restore
            </button>
          ) : (
            <button
              onClick={() => setConfirm("hide")}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-2.5 py-1.5 transition-colors font-medium"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
          )}
          <button
            onClick={() => setConfirm("delete")}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-2.5 py-1.5 transition-colors font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Forever
          </button>
          {actionError && (
            <span className="text-[10px] text-red-400 ml-1 flex-1 truncate">{actionError}</span>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function FounderGameSection({ auth }) {
  const [gameIdSearch, setGameIdSearch] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);

  async function search() {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const res = await base44.functions.invoke('founderGameActions', {
        action: 'founderListGames',
        callerProfileId: auth.currentUser?.id,
        callerAuthUserId: auth.authUserId,
        gameId: gameIdSearch.trim() || null,
        participantProfileId: selectedParticipant?.id || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        includeHidden: showHidden,
      });
      // Explicit backend error check
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.games) throw new Error("Backend returned unexpected response.");
      setGames(res.data.games);
    } catch (e) {
      const msg = e.message || "Search failed.";
      setSearchError(msg);
      toast.error(msg);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  async function hideGame(gameId) {
    const res = await base44.functions.invoke('founderGameActions', {
      action: 'founderHideGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    if (res.data?.error) throw new Error(res.data.error);
    if (!res.data?.success) throw new Error("Hide was not confirmed by backend.");
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, is_hidden: true } : g));
  }

  async function restoreGame(gameId) {
    const res = await base44.functions.invoke('founderGameActions', {
      action: 'founderRestoreGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    if (res.data?.error) throw new Error(res.data.error);
    if (!res.data?.success) throw new Error("Restore was not confirmed by backend.");
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, is_hidden: false } : g));
  }

  async function hardDeleteGame(gameId) {
    const res = await base44.functions.invoke('founderGameActions', {
      action: 'founderHardDeleteGame',
      callerProfileId: auth.currentUser?.id,
      callerAuthUserId: auth.authUserId,
      gameId,
    });
    const data = res.data || {};

    // Surface structured error including partial-delete info
    if (!data.success) {
      const isPartial = data.partial === true;
      const step = data.failed_step ? ` (failed at: ${data.failed_step})` : '';
      const partialWarning = isPartial ? '\n⚠️ Partial delete may have occurred.' : '';
      const msg = (data.error || 'Delete was not confirmed by backend.') + step + partialWarning;
      throw new Error(msg);
    }

    // Only remove from list after backend confirms full success + verification
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
        {/* Participant search with autocomplete */}
        <ParticipantSearch
          value={selectedParticipant}
          onSelect={setSelectedParticipant}
          onClear={() => setSelectedParticipant(null)}
        />

        {/* Game ID */}
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

        {/* Date range */}
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
        {loading
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <><Search className="w-3.5 h-3.5 mr-1.5" /> Search Games</>
        }
      </Button>

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-2">
          {searchError ? (
            <div className="py-4 text-center text-red-400 text-xs bg-red-500/5 border border-red-500/20 rounded-xl px-3">
              {searchError}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{games.length} game{games.length !== 1 ? "s" : ""} found</p>
              {games.length === 0 ? (
                <div className="py-6 text-center text-gray-600 text-xs">No games match the search criteria.</div>
              ) : (
                games.map((g) => (
                  <FounderGameCard
                    key={g.id}
                    game={g}
                    onHide={() => hideGame(g.id)}
                    onRestore={() => restoreGame(g.id)}
                    onDelete={() => hardDeleteGame(g.id)}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}