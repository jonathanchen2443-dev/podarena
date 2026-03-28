import React from "react";
import { Crown } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatName(name) {
  if (!name) return "Unknown";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function sortedParticipants(participants) {
  return [...participants].sort((a, b) => {
    const pa = a.placement ?? 99;
    const pb = b.placement ?? 99;
    return pa - pb;
  });
}

// ── PlayerCard ────────────────────────────────────────────────────────────────
// Vertical card with commander image overlapping above the card body.
// size = "lg" (winner) | "md" (2nd/3rd)

function PlayerCard({ p, size = "md", showCrown = false }) {
  const deckLabel = p.deck?.name || null;
  const commanderImage = p.deck?.commander_image || null;
  const isWinner = p.placement === 1 || p.result === "win";

  // Image dimensions
  const imgCls   = size === "lg" ? "w-24 h-24" : "w-20 h-20";
  // Card width matches image width so they align
  const cardW    = size === "lg" ? "w-24" : "w-20";
  // How far the image overlaps above the card (half the image height)
  const overlapPx = size === "lg" ? 48 : 40;
  // Card body padding-top = overlap so content starts below the overlapping portion
  const cardPtCls = size === "lg" ? "pt-12" : "pt-10";

  const borderCls = isWinner
    ? "border-2 border-amber-400/70 shadow-lg shadow-amber-500/20"
    : "border border-gray-700/60";

  const cardBg = isWinner
    ? "bg-gray-800/80 border border-amber-400/20"
    : "bg-gray-800/50 border border-gray-700/30";

  const placementLabel =
    p.placement === 1 ? "1st" :
    p.placement === 2 ? "2nd" :
    p.placement === 3 ? "3rd" :
    p.placement != null ? `${p.placement}th` : null;

  const placementBadgeCls = isWinner
    ? "bg-amber-400 text-gray-900"
    : p.placement === 2
    ? "bg-gray-300 text-gray-900"
    : p.placement === 3
    ? "bg-amber-700/80 text-white"
    : "bg-gray-700/90 text-gray-300";

  const nameCls  = size === "lg" ? "text-sm"    : "text-xs";
  const deckCls  = size === "lg" ? "text-[11px]" : "text-[10px]";
  const crownCls = size === "lg" ? "w-5 h-5"    : "w-4 h-4";

  return (
    <div className={`flex flex-col items-center ${cardW}`} style={{ paddingTop: showCrown && isWinner ? 0 : 0 }}>
      {/* Crown above image */}
      {showCrown && isWinner && (
        <Crown className={`${crownCls} text-amber-400 mb-1 flex-shrink-0`} />
      )}

      {/* Wrapper: positions image overlapping above the card */}
      <div className="relative w-full flex flex-col items-center">
        {/* Commander image — sits above the card, overlapping it */}
        <div
          className={`${imgCls} rounded-xl overflow-hidden ${borderCls} bg-gray-800 flex-shrink-0 relative z-10`}
          style={{ marginBottom: `-${overlapPx}px` }}
        >
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
          {/* Placement badge on the image */}
          {placementLabel && (
            <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full font-bold leading-none text-[10px] px-1.5 py-0.5 ${placementBadgeCls}`}>
              {placementLabel}
            </div>
          )}
        </div>

        {/* Card body — image overlaps the top of this */}
        <div className={`w-full rounded-xl ${cardBg} ${cardPtCls} pb-2.5 px-1.5 flex flex-col items-center gap-1`}>
          <p className={`${nameCls} text-white font-semibold text-center leading-tight w-full truncate`}>
            {formatName(p.display_name)}
          </p>
          <p className={`${deckCls} text-gray-500 text-center leading-tight w-full line-clamp-2`}>
            {deckLabel || <span className="text-gray-700 italic">No deck</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── TwoPlayerLayout ───────────────────────────────────────────────────────────

function TwoPlayerLayout({ sorted }) {
  return (
    <div className="flex items-end justify-center gap-5 py-2">
      {sorted.map((p) => (
        <PlayerCard key={p.userId} p={p} size="lg" showCrown />
      ))}
    </div>
  );
}

// ── PodiumLayout ──────────────────────────────────────────────────────────────

function PodiumLayout({ top3 }) {
  const first  = top3.find((p) => p.placement === 1) || top3[0];
  const second = top3.find((p) => p.placement === 2) || top3[1];
  const third  = top3.find((p) => p.placement === 3) || top3[2];

  return (
    <div className="flex items-end justify-center gap-3 py-2">
      {/* 2nd — left, slightly lower */}
      <div className="flex flex-col items-center pb-3">
        {second ? <PlayerCard p={second} size="md" showCrown={false} /> : null}
      </div>

      {/* 1st — center, elevated */}
      <div className="flex flex-col items-center -mt-5">
        {first ? <PlayerCard p={first} size="lg" showCrown /> : null}
      </div>

      {/* 3rd — right, lowest */}
      <div className="flex flex-col items-center pb-6">
        {third ? <PlayerCard p={third} size="md" showCrown={false} /> : null}
      </div>
    </div>
  );
}

// ── RemainingRow — compact, no commander image ────────────────────────────────

function RemainingRow({ p }) {
  const deckLabel = p.deck?.name || null;
  const placementLabel = p.placement != null ? `#${p.placement}` : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-800/40 last:border-0">
      {/* Simple initial avatar — no commander image */}
      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center flex-shrink-0">
        <span className="text-gray-500 font-bold text-xs select-none">
          {(p.display_name || "?")[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{formatName(p.display_name)}</p>
        <p className="text-xs text-gray-500 truncate">
          {deckLabel || <span className="text-gray-700 italic">No deck</span>}
        </p>
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