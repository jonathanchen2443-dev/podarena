import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Lock, RefreshCw, AlertCircle, Trophy, Skull, Sword, Users, ChevronLeft } from "lucide-react";
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

/** KPI card — prominent number, quiet label, borderless depth */
function KpiCard({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-white/[0.04] flex-1 min-w-0 gap-0.5">
      <span className="text-white font-extrabold text-lg leading-none tracking-tight">{value ?? "—"}</span>
      <span className="text-gray-500 text-[10px] font-semibold tracking-widest uppercase mt-1">{label}</span>
    </div>
  );
}

// Category accent palette — badge bg, icon color, title color
const ACCENTS = {
  pod:   { bg: "bg-blue-500/15",   icon: "text-blue-400",   title: "text-blue-400/70"   },
  best:  { bg: "bg-green-500/15",  icon: "text-green-400",  title: "text-green-400/70"  },
  tough: { bg: "bg-red-500/15",    icon: "text-red-400",    title: "text-red-400/70"    },
  deck:  { bg: "bg-orange-500/15", icon: "text-orange-400", title: "text-orange-400/70" },
};

/** Stacked insight row with colored icon badge, no colored border */
function InsightRow({ icon: Icon, title, primary, secondary, accent }) {
  const hasData = !!primary;
  const a = ACCENTS[accent] || {};
  return (
    <div className="flex items-center gap-3.5 py-3.5 border-b border-white/[0.04] last:border-0">
      {/* Colored icon badge */}
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${hasData ? (a.bg || "bg-white/[0.06]") : "bg-white/[0.03]"}`}>
        <Icon className={`w-4 h-4 ${hasData ? (a.icon || "text-gray-500") : "text-gray-700"}`} />
      </div>

      {/* Text area */}
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] uppercase tracking-widest font-semibold leading-none mb-1.5 ${hasData ? (a.title || "text-gray-500") : "text-gray-700"}`}>
          {title}
        </p>
        {hasData ? (
          <p className="text-white text-sm font-semibold leading-snug truncate">{primary}</p>
        ) : (
          <p className="text-gray-700 text-xs italic">Not enough data yet</p>
        )}
      </div>

      {/* Secondary badge */}
      {hasData && secondary && (
        <span className="text-gray-500 text-[11px] flex-shrink-0 font-medium bg-white/[0.04] rounded-lg px-2 py-1 leading-none ml-1">
          {secondary}
        </span>
      )}
    </div>
  );
}

/** Props row — PNG icon + label + count badge */
function PropRow({ item }) {
  const iconUrl = PRAISE_ICONS[item.icon_key || item.type];
  const label = item.label || PRAISE_META[item.type]?.label || item.type;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0">
      {iconUrl ? (
        <img src={iconUrl} alt={label} className="w-8 h-8 object-contain flex-shrink-0 opacity-90" />
      ) : (
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex-shrink-0" />
      )}
      <span className="text-gray-300 text-sm flex-1 truncate font-medium">{label}</span>
      <span className="text-white font-bold text-sm bg-white/[0.07] rounded-lg px-2.5 py-1 leading-none min-w-[28px] text-center">
        {item.count}
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold mb-2 px-0.5">{children}</p>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-52 bg-white/[0.04] rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 flex-1 bg-white/[0.04] rounded-2xl" />)}
      </div>
      <div className="h-3 bg-white/[0.04] rounded w-16 mt-2" />
      <div className="bg-white/[0.03] rounded-2xl h-44" />
      <div className="h-3 bg-white/[0.04] rounded w-20" />
      <div className="bg-white/[0.03] rounded-2xl h-28" />
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
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm border border-white/10 px-4 py-2 rounded-xl transition-colors"
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
  const firstLogged = formatDate(deck.first_logged_at);
  const ownerLabel = formatOwnerName(owner?.display_name);
  const isOwnDeck = !!(owner?.id && auth.currentUser?.id && owner.id === auth.currentUser.id);

  const mostPlayedPod = insights?.most_played_pod;
  const bestAgainstPlayer = insights?.best_against_player;
  const toughestOpponent = insights?.toughest_opponent;
  const bestAgainstDeck = insights?.best_against_deck;

  function handleBackToProfile() {
    if (isOwnDeck) {
      navigate(ROUTES.PROFILE);
    } else if (owner?.id) {
      navigate(ROUTES.USER_PROFILE(owner.id));
    } else {
      navigate(-1);
    }
  }

  return (
    <div className="space-y-4 pb-4">

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, #161b24 0%, #111418 100%)" }}
      >
        {/* Blurred commander background */}
        {deck.commander_image_url && (
          <div className="absolute inset-0">
            <img
              src={deck.commander_image_url}
              alt={commanderName}
              className="w-full h-full object-cover object-top opacity-15 blur-md scale-110"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(17,20,24,0.55) 0%, rgba(17,20,24,0.85) 60%, #111418 100%)" }} />
          </div>
        )}

        <div className="relative z-10 p-4 pb-0 flex gap-4">
          {/* Commander portrait — slightly lifted with subtle inner shadow */}
          <div className="w-[72px] h-[92px] flex-shrink-0 rounded-xl overflow-hidden"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.07)" }}
          >
            {deck.commander_image_url ? (
              <img src={deck.commander_image_url} alt={commanderName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
                <Swords className="w-7 h-7 text-gray-600" />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 pt-1">
            {/* Pills row — owner + format in the same visual family */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ownerLabel && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-gray-400"
                  style={{ background: "rgba(255,255,255,0.07)" }}>
                  {ownerLabel}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-gray-500"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                Commander
              </span>
            </div>

            {/* Deck archetype label if present */}
            {deckLabel && (
              <p className="text-gray-500 text-[10px] uppercase tracking-wide truncate -mb-0.5">{deckLabel}</p>
            )}

            {/* Commander name — visual focal point */}
            <p className="text-white font-extrabold text-[17px] leading-tight truncate tracking-tight">
              {commanderName}
            </p>

            {/* Mana pips */}
            <ManaPipRow colors={deck.color_identity || []} size={14} gap={3} />

            {/* First logged — quiet supporting meta */}
            {firstLogged && (
              <p className="text-gray-600 text-[10px] mt-0.5">First logged {firstLogged}</p>
            )}
          </div>
        </div>

        {/* KPI row — flush inside the hero card, separated by subtle rule */}
        <div className="relative z-10 px-4 pb-4 pt-4 flex gap-2 mt-2">
          <div className="absolute top-0 left-4 right-4 h-px bg-white/[0.05]" />
          <KpiCard label="Games" value={summary.games_played} />
          <KpiCard label="Wins" value={summary.wins} />
          <KpiCard label="Win Rate" value={`${summary.win_rate_percent}%`} />
        </div>
      </div>

      {/* ── LOCKED STATE ────────────────────────────────────────────────────── */}
      {!eligibility.insights_unlocked ? (
        <div className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <Lock className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Insights locked</p>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-[220px]">
              Play {eligibility.games_needed_to_unlock} more approved game{eligibility.games_needed_to_unlock !== 1 ? "s" : ""} with this deck to unlock insights.
            </p>
            <p className="text-gray-600 text-xs mt-2">
              {summary.games_played} / {eligibility.minimum_games_required} games played
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── INSIGHTS ────────────────────────────────────────────────────── */}
          <div>
            <SectionLabel>Insights</SectionLabel>
            <div className="rounded-2xl px-4 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>
              <InsightRow
                icon={Users}
                title="Most played in"
                primary={mostPlayedPod?.pod_name || null}
                secondary={mostPlayedPod?.games ? `${mostPlayedPod.games} games` : null}
                accent="pod"
              />
              <InsightRow
                icon={Trophy}
                title="Best against"
                primary={formatName(bestAgainstPlayer?.display_name) || null}
                secondary={bestAgainstPlayer?.wins ? `${bestAgainstPlayer.wins} wins` : null}
                accent="best"
              />
              <InsightRow
                icon={Skull}
                title="Toughest opponent"
                primary={formatName(toughestOpponent?.display_name) || null}
                secondary={toughestOpponent?.losses ? `${toughestOpponent.losses} losses` : null}
                accent="tough"
              />
              <InsightRow
                icon={Sword}
                title="Best against deck"
                primary={bestAgainstDeck?.deck_label || null}
                secondary={bestAgainstDeck?.wins ? `${bestAgainstDeck.wins} wins` : null}
                accent="deck"
              />
            </div>
          </div>

          {/* ── PROPS RECEIVED ──────────────────────────────────────────────── */}
          <div>
            <SectionLabel>Props received</SectionLabel>
            {props.sorted && props.sorted.length > 0 ? (
              <div className="rounded-2xl px-4 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                {props.sorted.map((item) => (
                  <PropRow key={item.type} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
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
          <div className="rounded-2xl px-4 py-1" style={{ background: "rgba(255,255,255,0.02)" }}>
            {summary.pod_games > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-gray-500 text-xs font-semibold tracking-wide">POD</span>
                <span className="text-gray-600 text-xs tabular-nums">
                  {summary.pod_games}G · {summary.pod_wins}W · {summary.pod_win_rate_percent}%
                </span>
              </div>
            )}
            {summary.casual_games > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-gray-500 text-xs font-semibold tracking-wide">Casual</span>
                <span className="text-gray-600 text-xs tabular-nums">
                  {summary.casual_games}G · {summary.casual_wins}W · {summary.casual_win_rate_percent}%
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
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </button>
      </div>

    </div>
  );
}