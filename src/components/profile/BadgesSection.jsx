import React from "react";
import { ChevronRight, Swords, Trophy, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Tier config
function getTier(value) {
  if (value >= 10) return "gold";
  if (value >= 5) return "silver";
  return "bronze";
}

const TIER_COLORS = {
  bronze: { ring: "#CD7F32", bar: "#CD7F32", label: "text-amber-700" },
  silver: { ring: "#9CA3AF", bar: "#9CA3AF", label: "text-gray-400" },
  gold:   { ring: "#F59E0B", bar: "#F59E0B", label: "text-amber-400" },
};

function getProgress(value) {
  const tier = getTier(value);
  if (tier === "bronze") return { pct: Math.min(value / 5, 1), label: `${value} / 5` };
  if (tier === "silver") return { pct: Math.min((value - 5) / 5, 1), label: `${value} / 10` };
  // Gold: bar stays full, show total
  return { pct: 1, label: `Total: ${value}` };
}

function BadgeCard({ icon: Icon, name, value }) {
  const tier = getTier(value);
  const colors = TIER_COLORS[tier];
  const { pct, label } = getProgress(value);

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
      {/* Icon circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${colors.ring}22`, border: `1.5px solid ${colors.ring}` }}
      >
        <Icon className="w-5 h-5" style={{ color: colors.ring }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-xs font-semibold uppercase tracking-wide">{name}</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.label}`}>{tier}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round(pct * 100)}%`, background: colors.bar }}
          />
        </div>
        <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function BadgesSection({ stats, decks }) {
  const navigate = useNavigate();

  const totalGames = stats?.gamesPlayed ?? 0;

  // Winner deck: count of decks with at least 1 win — fallback 0 since we don't have per-deck win data here
  const winnerDeck = 0;

  // Friends: not yet implemented, fallback 0
  const friends = 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-white font-semibold text-base uppercase tracking-wide text-sm">Badges</h2>
        <button
          onClick={() => navigate(createPageUrl("Badges"))}
          className="flex items-center gap-0.5 text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--ds-primary-text)" }}
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <BadgeCard icon={Swords} name="Total Games" value={totalGames} />
        <BadgeCard icon={Trophy} name="Winner Deck" value={winnerDeck} />
        <BadgeCard icon={Users} name="Friends" value={friends} />
      </div>
    </div>
  );
}