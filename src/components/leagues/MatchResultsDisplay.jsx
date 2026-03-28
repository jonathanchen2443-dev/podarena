import React from "react";
import { Crown } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format display name as "FirstName L."
 * If only one word, return as-is.
 */
function formatName(name) {
  if (!name) return "Unknown";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Sort participants by placement, then put unplaced at the end */
function sortedParticipants(participants) {
  return [...participants].sort((a, b) => {
    const pa = a.placement ?? 99;
    const pb = b.placement ?? 99;
    return pa - pb;
  });
}

// ── CommanderCard ─────────────────────────────────────────────────────────────

function CommanderCard({ p, size = "md", showCrown = false }) {
  const deckLabel = p.deck?.name || null;
  const commanderImage = p.deck?.commander_image || null;
  const isWinner = p.placement === 1 || p.result === "win";

  const sizeMap = {
    lg: { card: "w-28", img: "h-28 w-28", name: "text-sm", deck: "text-[10px]", badge: "text-xs px-2 py-0.5" },
    md: { card: "w-24", img: "h-24 w-24", name: "text-xs", deck: "text-[10px]", badge: "text-[10px] px-1.5 py-0.5" },
    sm: { card: "w-20", img: "h-20 w-20", name: "text-xs", deck: "text-[10px]", badge: "text-[10px] px-1.5 py-0.5" },
  };
  const s = sizeMap[size] || sizeMap.md;

  const borderCls = isWinner
    ? "border-2 border-amber-400/70 shadow-lg shadow-amber-500/20"
    : "border border-gray-700/60";

  const placementLabel =
    p.placement === 1 ? "1st" :
    p.placement === 2 ? "2nd" :
    p.placement === 3 ? "3rd" :
    p.placement != null ? `${p.placement}th` : null;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.card}`}>
      {/* Crown for winner */}
      {showCrown && isWinner && (
        <Crown className="w-4 h-4 text-amber-400 mb-0.5 flex-shrink-0" />
      )}

      {/* Commander image */}
      <div className={`${s.img} rounded-xl overflow-hidden ${borderCls} bg-gray-800 flex-shrink-0 relative`}>
        {commanderImage ? (
          <img
            src={commanderImage}
            alt={deckLabel || p.display_name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-600 text-2xl font-bold select-none">
              {(p.display_name || "?")[0].toUpperCase()}
            </span>
          </div>
        )}
        {/* Placement badge overlay */}
        {placementLabel && (
          <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full font-bold leading-none ${s.badge} ${
            isWinner
              ? "bg-amber-400 text-gray-900"
              : p.placement === 2
              ? "bg-gray-300 text-gray-900"
              : p.placement === 3
              ? "bg-amber-700/80 text-white"
              : "bg-gray-700/90 text-gray-300"
          }`}>
            {placementLabel}
          </div>
        )}
      </div>

      {/* Name */}
      <p className={`${s.name} text-white font-semibold text-center leading-tight w-full truncate px-0.5`}>
        {formatName(p.display_name)}
      </p>

      {/* Deck label */}
      <p className={`${s.deck} text-gray-500 text-center leading-tight w-full line-clamp-2 px-0.5`}>
        {deckLabel || <span className="text-gray-700 italic">No deck</span>}
      </p>
    </div>
  );
}

// ── TwoPlayerLayout ───────────────────────────────────────────────────────────

function TwoPlayerLayout({ sorted }) {
  return (
    <div className="flex items-end justify-center gap-6 py-2">
      {sorted.map((p) => (
        <CommanderCard key={p.userId} p={p} size="lg" showCrown />
      ))}
    </div>
  );
}

// ── PodiumLayout ──────────────────────────────────────────────────────────────
// Used for 3 players and the top-3 of 4+ player games

function PodiumLayout({ top3 }) {
  const first = top3.find((p) => p.placement === 1) || top3[0];
  const second = top3.find((p) => p.placement === 2) || top3[1];
  const third = top3.find((p) => p.placement === 3) || top3[2];

  return (
    <div className="flex items-end justify-center gap-3 py-2">
      {/* 2nd place — left, slightly lower */}
      <div className="flex flex-col items-center pb-2">
        {second ? <CommanderCard p={second} size="md" showCrown={false} /> : null}
      </div>

      {/* 1st place — center, elevated */}
      <div className="flex flex-col items-center -mt-4">
        {first ? <CommanderCard p={first} size="lg" showCrown /> : null}
      </div>

      {/* 3rd place — right, slightly lower */}
      <div className="flex flex-col items-center pb-4">
        {third ? <CommanderCard p={third} size="md" showCrown={false} /> : null}
      </div>
    </div>
  );
}

// ── RemainingRow ──────────────────────────────────────────────────────────────

function RemainingRow({ p }) {
  const deckLabel = p.deck?.name || null;
  const commanderImage = p.deck?.commander_image || null;
  const placementLabel = p.placement != null ? `#${p.placement}` : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-800/40 last:border-0">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700/60 flex-shrink-0">
        {commanderImage ? (
          <img src={commanderImage} alt={deckLabel || p.display_name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-600 font-bold text-sm select-none">
              {(p.display_name || "?")[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{formatName(p.display_name)}</p>
        <p className="text-xs text-gray-500 truncate">{deckLabel || <span className="text-gray-700 italic">No deck</span>}</p>
      </div>
      {placementLabel && (
        <span className="text-xs text-gray-500 font-mono flex-shrink-0">{placementLabel}</span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MatchResultsDisplay({ participants }) {
  if (!participants || participants.length === 0) return null;

  const sorted = sortedParticipants(participants);
  const count = sorted.length;

  if (count === 2) {
    return <TwoPlayerLayout sorted={sorted} />;
  }

  if (count === 3) {
    return <PodiumLayout top3={sorted} />;
  }

  // 4+ players: podium for top 3, compact rows for the rest
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="space-y-3">
      <PodiumLayout top3={top3} />
      {rest.length > 0 && (
        <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl overflow-hidden">
          {rest.map((p) => (
            <RemainingRow key={p.userId} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}