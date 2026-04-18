import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Lock, RefreshCw, AlertCircle, Trophy, Skull, Sword, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { getDeckInsights } from "@/components/services/deckInsightsService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import { PRAISE_META } from "@/components/services/praiseService";
import { ROUTES } from "@/components/utils/routes";
import { format, parseISO } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return null;
  try { return format(parseISO(iso), "MMM yyyy"); } catch { return null; }
}

function formatOwnerName(displayName) {
  if (!displayName || displayName === "Unknown") return null;
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
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
    <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gray-800/60 border border-gray-700/40 min-w-[60px] flex-1">
      <span className="text-white font-bold text-sm leading-none">{value ?? "—"}</span>
      <span className="text-gray-500 text-[10px] mt-1 font-medium tracking-wide uppercase">{label}</span>
    </div>
  );
}

// Lightweight stacked row — replaces the old 2-col InsightCard grid
function InsightRow({ icon: Icon, title, primary, secondary }) {
  const hasData = !!primary;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800/40 last:border-0">
      <Icon className={`w-4 h-4 flex-shrink-0 ${hasData ? "text-gray-500" : "text-gray-700"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold leading-none mb-1">{title}</p>
        {hasData ? (
          <p className="text-white text-sm font-semibold leading-snug truncate">{primary}</p>
        ) : (
          <p className="text-gray-700 text-xs">Not enough data yet</p>
        )}
      </div>
      {hasData && secondary && (
        <span className="text-gray-500 text-xs flex-shrink-0 ml-1">{secondary}</span>
      )}
    </div>
  );
}

function PropRow({ item }) {
  const iconUrl = PRAISE_ICONS[item.icon_key || item.type];
  const label = item.label || PRAISE_META[item.type]?.label || item.type;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/40 last:border-0">
      {iconUrl ? (
        <img src={iconUrl} alt={label} className="w-7 h-7 object-contain flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-lg bg-gray-800 flex-shrink-0" />
      )}
      <span className="text-white text-sm flex-1 truncate">{label}</span>
      <span className="text-white font-bold text-sm">{item.count}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold mb-2 px-1">{children}</p>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-52 bg-gray-800/60 rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 flex-1 bg-gray-800/60 rounded-xl" />)}
      </div>
      <div className="h-4 bg-gray-800/40 rounded w-20 mt-2" />
      <div className="bg-gray-800/30 rounded-2xl h-40" />
      <div className="h-4 bg-gray-800/40 rounded w-24" />
      <div className="bg-gray-800/30 rounded-2xl h-28" />
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authLoading, auth.isGuest, deckId]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    const isAccess = error?.toLowerCase().includes("forbidden") || error?.toLowerCase().includes("not found");
    return (
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
    );
  }

  const { deck, owner, summary, eligibility, insights, props } = data;
  const commanderName = deck.commander_name || deck.name;
  const deckLabel = deck.commander_name && deck.name && deck.commander_name !== deck.name ? deck.name : null;
  const lastPlayed = formatDate(deck.last_played_at);
  const firstLogged = formatDate(deck.first_logged_at);
  const ownerLabel = formatOwnerName(owner?.display_name);

  const mostPlayedPod = insights?.most_played_pod;
  const bestAgainstPlayer = insights?.best_against_player;
  const toughestOpponent = insights?.toughest_opponent;
  const bestAgainstDeck = insights?.best_against_deck;

  function handleBackToProfile() {
    if (owner?.id) {
      navigate(ROUTES.USER_PROFILE(owner.id));
    } else {
      navigate(-1);
    }
  }

  return (
    <div className="space-y-5 pb-4">

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gray-900/80 border border-gray-800/50">
        {deck.commander_image_url && (
          <div className="absolute inset-0">
            <img
              src={deck.commander_image_url}
              alt={commanderName}
              className="w-full h-full object-cover object-top opacity-20 blur-sm scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/80 to-gray-900" />
          </div>
        )}

        <div className="relative z-10 p-4 flex gap-4">
          {/* Commander portrait */}
          <div className="w-20 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-800/60 border border-gray-700/40">
            {deck.commander_image_url ? (
              <img src={deck.commander_image_url} alt={commanderName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Swords className="w-7 h-7 text-gray-600" />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            {ownerLabel && (
              <div className="inline-flex self-start">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-700/60 border border-gray-600/30 text-gray-400">
                  Deck by {ownerLabel}
                </span>
              </div>
            )}
            {deckLabel && (
              <p className="text-gray-500 text-[10px] uppercase tracking-wide truncate">{deckLabel}</p>
            )}
            <p className="text-white font-bold text-base leading-tight truncate">{commanderName}</p>
            <ManaPipRow colors={deck.color_identity || []} size={13} gap={2} />
            {/* Last played + First logged — header meta only, not in insights */}
            <div className="space-y-0.5 mt-0.5">
              {lastPlayed && <p className="text-gray-600 text-[11px]">Last played {lastPlayed}</p>}
              {firstLogged && <p className="text-gray-600 text-[11px]">First logged {firstLogged}</p>}
            </div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="relative z-10 px-4 pb-4 flex gap-2">
          <StatChip label="Games" value={summary.games_played} />
          <StatChip label="Wins" value={summary.wins} />
          <StatChip label="Win Rate" value={`${summary.win_rate_percent}%`} />
          <StatChip label="Format" value="Cmdr" />
        </div>
      </div>

      {/* ── LOCKED STATE ────────────────────────────────────────────────────── */}
      {!eligibility.insights_unlocked ? (
        <div className="bg-gray-900/60 border border-gray-800/40 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gray-800/80 border border-gray-700/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gray-500" />
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
          {/* ── INSIGHTS — stacked list rows, NOT a grid ─────────────────────── */}
          <div>
            <SectionLabel>Insights</SectionLabel>
            <div className="bg-gray-900/50 border border-gray-800/40 rounded-2xl px-4 py-0">
              <InsightRow
                icon={Users}
                title="Most played in"
                primary={mostPlayedPod?.pod_name || null}
                secondary={mostPlayedPod?.games ? `${mostPlayedPod.games} games` : null}
              />
              <InsightRow
                icon={Trophy}
                title="Best against"
                primary={formatName(bestAgainstPlayer?.display_name) || null}
                secondary={bestAgainstPlayer?.wins ? `${bestAgainstPlayer.wins} wins` : null}
              />
              <InsightRow
                icon={Skull}
                title="Toughest opponent"
                primary={formatName(toughestOpponent?.display_name) || null}
                secondary={toughestOpponent?.losses ? `${toughestOpponent.losses} losses` : null}
              />
              <InsightRow
                icon={Sword}
                title="Best against deck"
                primary={bestAgainstDeck?.deck_label || null}
                secondary={bestAgainstDeck?.wins ? `${bestAgainstDeck.wins} wins` : null}
              />
            </div>
          </div>

          {/* ── PROPS RECEIVED ──────────────────────────────────────────────── */}
          <div>
            <SectionLabel>Props received</SectionLabel>
            {props.sorted && props.sorted.length > 0 ? (
              <div className="bg-gray-900/50 border border-gray-800/40 rounded-2xl px-4 py-0">
                {props.sorted.map((item) => (
                  <PropRow key={item.type} item={item} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800/40 rounded-2xl px-4 py-4 text-center">
                <p className="text-gray-700 text-sm">No props received yet</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── RECORD BREAKDOWN ─────────────────────────────────────────────────── */}
      {summary.games_played > 0 && (summary.pod_games > 0 || summary.casual_games > 0) && (
        <div>
          <SectionLabel>Record breakdown</SectionLabel>
          <div className="bg-gray-900/50 border border-gray-800/40 rounded-2xl px-4 py-0">
            {summary.pod_games > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-800/40 last:border-0">
                <span className="text-gray-400 text-xs font-medium">POD</span>
                <span className="text-gray-600 text-xs">
                  {summary.pod_games}G &bull; {summary.pod_wins}W &bull; {summary.pod_win_rate_percent}%
                </span>
              </div>
            )}
            {summary.casual_games > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-800/40 last:border-0">
                <span className="text-gray-400 text-xs font-medium">Casual</span>
                <span className="text-gray-600 text-xs">
                  {summary.casual_games}G &bull; {summary.casual_wins}W &bull; {summary.casual_win_rate_percent}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BACK TO PROFILE CTA ─────────────────────────────────────────────── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={handleBackToProfile}
          className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800/60 text-sm font-medium transition-colors"
        >
          Back to Profile
        </button>
      </div>

    </div>
  );
}