/**
 * PublicBadges — icon-only badge indicators for public profiles.
 * No progress bars, no labels — just tier-colored icons.
 */
import React from "react";
import { Swords, Trophy, Users } from "lucide-react";

function getTier(value) {
  if (value >= 10) return "gold";
  if (value >= 5) return "silver";
  return "bronze";
}

const TIER_COLORS = {
  bronze: "#CD7F32",
  silver: "#9CA3AF",
  gold: "#F59E0B",
};

const TIER_LABELS = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

function BadgeIcon({ icon: Icon, value, name }) {
  const tier = getTier(value);
  const color = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  return (
    <div className="flex flex-col items-center gap-1.5" title={`${name} · ${label}`}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: `${color}22`, border: `1.5px solid ${color}` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

export default function PublicBadges({ stats }) {
  const totalGames = stats?.gamesPlayed ?? 0;

  // Only show badges if the user has meaningful data
  if (totalGames === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-white font-semibold text-base uppercase tracking-wide text-sm px-1">Badges</h2>
      <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-4">
        <div className="flex items-center gap-6 justify-center">
          <BadgeIcon icon={Swords} name="Total Games" value={totalGames} />
        </div>
      </div>
    </div>
  );
}