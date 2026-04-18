import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Swords, Lock, RefreshCw, AlertCircle, Trophy, Skull, Sword, Users, Calendar, Star } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { getDeckInsights } from "@/components/services/deckInsightsService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import { PRAISE_META } from "@/components/services/praiseService";
import { format, parseISO } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return null;
  try { return format(parseISO(iso), "MMM yyyy"); } catch { return null; }
}

function formatName(displayName) {
  if (!displayName || displayName === "Unknown") return null;
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gray-800/60 border border-gray-700/40 min-w-[60px]">
      <span className="text-white font-bold text-base leading-none">{value ?? "—"}</span>
      <span className="text-gray-500 text-[10px] mt-1 font-medium tracking-wide uppercase">{label}</span>
    </div>
  );
}

function InsightCard({ icon: Icon, title, primary, secondary }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">{title}</p>
        <p className="text-white font-bold text-sm mt-0.5 leading-tight truncate">
          {primary || <span className="text-gray-600 font-normal">Not enough data yet</span>}
        </p>
        {secondary && <p className="text-gray-500 text-xs mt-0.5">{secondary}</p>}
      </div>
    </div>
  );
}

function PropRow({ item }) {
  const iconUrl = PRAISE_ICONS[item.icon_key || item.type];
  const label = item.label || PRAISE_META[item.type]?.label || item.type;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/50 last:border-0">
      {iconUrl ? (
        <img src={iconUrl} alt={label} className="w-8 h-8 object-contain flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-gray-800 flex-shrink-0" />
      )}
      <span className="text-white text-sm flex-1">{label}</span>
      <span className="text-white font-bold text-sm">{item.count}</span>
    </div>
  );
}

function BreakdownRow({ label, games, wins, winRatePct }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/40 last:border-0">
      <span className="text-gray-400 text-xs font-medium">{label}</span>
      <span className="text-gray-500 text-xs">
        {games} game{games !== 1 ? "s" : ""} &bull; {wins} win{wins !== 1 ? "s" : ""} &bull; {winRatePct}%
      </span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-gray-800/60 rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 flex-1 bg-gray-800/60 rounded-xl" />)}
      </div>
      <div className="h-6 bg-gray-800/40 rounded w-32" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-16 bg-gray-800/40 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeckInsights() {
  const navigate = useNavigate();
  const auth = useAuth();

  const params = new URLSearchParams(window.location.search);
  const deckId = params.get("deckId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadInsights() {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeckInsights(auth, deckId);
      if (!result) throw new Error("No data returned");
      setData(result);
    } catch (e) {
      setError(e?.message || "Failed to load deck insights");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.authLoading) return;
    if (!deckId) { setError("No deck specified."); setLoading(false); return; }
    if (auth.isGuest) { setError("Sign in to view deck insights."); setLoading(false); return; }
    loadInsights();
  }, [auth.authLoading, auth.isGuest, deckId]);

  // ── Back button ──────────────────────────────────────────────────────────────
  const backBtn = (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        {backBtn}
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Error / access denied ─────────────────────────────────────────────────
  if (error || !data) {
    const isAccess = error?.toLowerCase().includes("forbidden") || error?.toLowerCase().includes("not found");
    return (
      <div>
        {backBtn}
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
          <AlertCircle className={`w-10 h-10 ${isAccess ? "text-amber-400/70" : "text-red-400/70"}`} />
          <p className={`text-sm font-medium ${isAccess ? "text-amber-400" : "text-red-400"}`}>
            {isAccess ? "Deck not found or access denied." : (error || "Something went wrong.")}
          </p>
          {!isAccess && (
            <button
              onClick={loadInsights}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm border border-gray-700 px-4 py-2 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const { deck, summary, eligibility, insights, props } = data;
  const commanderName = deck.commander_name || deck.name;
  const deckLabel = deck.commander_name && deck.name && deck.commander_name !== deck.name ? deck.name : null;
  const lastPlayed = formatDate(deck.last_played_at);
  const firstLogged = formatDate(deck.first_logged_at);

  const mostPlayedPod = insights?.most_played_pod;
  const bestAgainstPlayer = insights?.best_against_player;
  const toughestOpponent = insights?.toughest_opponent;
  const bestAgainstDeck = insights?.best_against_deck;

  return (
    <div className="space-y-5 pb-4">
      {backBtn}

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gray-900/80 border border-gray-800/50">
        {/* Commander image background */}
        {deck.commander_image_url && (
          <div className="absolute inset-0">
            <img
              src={deck.commander_image_url}
              alt={commanderName}
              className="w-full h-full object-cover object-top opacity-25 blur-sm scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/80 to-gray-900" />
          </div>
        )}

        <div className="relative z-10 p-4 flex gap-4">
          {/* Commander portrait */}
          <div className="w-24 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-gray-800/60 border border-gray-700/40">
            {deck.commander_image_url ? (
              <img src={deck.commander_image_url} alt={commanderName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Swords className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            {deckLabel && (
              <p className="text-gray-500 text-[10px] uppercase tracking-wide truncate">{deckLabel}</p>
            )}
            <p className="text-white font-bold text-base leading-tight">{commanderName}</p>
            <ManaPipRow colors={deck.color_identity || []} size={14} gap={2} />
            {lastPlayed && (
              <p className="text-gray-600 text-xs">Last played {lastPlayed}</p>
            )}
          </div>
        </div>

        {/* Stat chips */}
        <div className="relative z-10 px-4 pb-4 flex gap-2 overflow-x-auto scrollbar-none">
          <StatChip label="Games" value={summary.games_played} />
          <StatChip label="Wins" value={summary.wins} />
          <StatChip label="Win Rate" value={`${summary.win_rate_percent}%`} />
          {lastPlayed && <StatChip label="Last Played" value={lastPlayed} />}
        </div>
      </div>

      {/* ── LOCKED / LOW-DATA STATE ─────────────────────────────────────────── */}
      {!eligibility.insights_unlocked ? (
        <div className="bg-gray-900/70 border border-gray-800/50 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Insights locked</p>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[220px]">
              Play {eligibility.games_needed_to_unlock} more approved game{eligibility.games_needed_to_unlock !== 1 ? "s" : ""} with this deck to unlock insights.
            </p>
            <p className="text-gray-600 text-xs mt-2">
              {summary.games_played} / {eligibility.minimum_games_required} games played
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── INSIGHTS GRID ─────────────────────────────────────────────── */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 px-1">Insights</p>
            <div className="grid grid-cols-2 gap-2.5">
              <InsightCard
                icon={Users}
                title="Most played in"
                primary={mostPlayedPod?.pod_name || null}
                secondary={mostPlayedPod?.games ? `${mostPlayedPod.games} games` : null}
              />
              <InsightCard
                icon={Trophy}
                title="Best against"
                primary={formatName(bestAgainstPlayer?.display_name) || null}
                secondary={bestAgainstPlayer?.wins ? `${bestAgainstPlayer.wins} wins` : null}
              />
              <InsightCard
                icon={Skull}
                title="Toughest opponent"
                primary={formatName(toughestOpponent?.display_name) || null}
                secondary={toughestOpponent?.losses ? `${toughestOpponent.losses} losses` : null}
              />
              <InsightCard
                icon={Sword}
                title="Best against deck"
                primary={bestAgainstDeck?.deck_label || null}
                secondary={bestAgainstDeck?.wins ? `${bestAgainstDeck.wins} wins` : null}
              />
              <InsightCard
                icon={Calendar}
                title="First logged"
                primary={firstLogged || null}
              />
              <InsightCard
                icon={Star}
                title="Props received"
                primary={props.total_received > 0 ? `${props.total_received} total` : null}
              />
            </div>
          </div>

          {/* ── PROPS SECTION ──────────────────────────────────────────────── */}
          {props.total_received > 0 && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 px-1">Props received</p>
              <div className="bg-gray-900/70 border border-gray-800/50 rounded-2xl px-4 py-1">
                {props.sorted.map((item) => (
                  <PropRow key={item.type} item={item} />
                ))}
              </div>
            </div>
          )}

          {props.total_received === 0 && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 px-1">Props received</p>
              <div className="bg-gray-900/70 border border-gray-800/50 rounded-2xl px-4 py-4 text-center">
                <p className="text-gray-600 text-sm">No props received yet</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── POD / CASUAL BREAKDOWN ─────────────────────────────────────────── */}
      {summary.games_played > 0 && (
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3 px-1">Record breakdown</p>
          <div className="bg-gray-900/50 border border-gray-800/40 rounded-2xl px-4 py-1">
            {summary.pod_games > 0 && (
              <BreakdownRow
                label="POD"
                games={summary.pod_games}
                wins={summary.pod_wins}
                winRatePct={summary.pod_win_rate_percent}
              />
            )}
            {summary.casual_games > 0 && (
              <BreakdownRow
                label="Casual"
                games={summary.casual_games}
                wins={summary.casual_wins}
                winRatePct={summary.casual_win_rate_percent}
              />
            )}
            {summary.pod_games === 0 && summary.casual_games === 0 && (
              <p className="text-gray-600 text-xs py-3 text-center">No breakdown available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}