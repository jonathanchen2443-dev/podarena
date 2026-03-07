/**
 * PublicStatRings — read-only stat ring cards for public profiles.
 * No navigation CTAs, no edit affordances.
 */
import React from "react";

function Ring({ pct, size = 72, stroke = 6, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(pct / 100, 0), 1);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2F38" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}

function RingCard({ label, pct, centerText, subText, color }) {
  return (
    <div className="flex-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex flex-col items-center gap-2">
      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold self-start">{label}</p>
      <div className="relative">
        <Ring pct={pct} color={color} />
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
          {centerText}
        </span>
      </div>
      <p className="text-gray-500 text-[10px] text-center leading-snug">{subText}</p>
    </div>
  );
}

function SkeletonRingCard() {
  return (
    <div className="flex-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex flex-col items-center gap-2 animate-pulse">
      <div className="h-3 w-10 bg-gray-700 rounded self-start" />
      <div className="w-[72px] h-[72px] rounded-full bg-gray-800" />
      <div className="h-3 w-20 bg-gray-700 rounded" />
    </div>
  );
}

export default function PublicStatRings({ stats, loading }) {
  if (loading) {
    return (
      <div className="flex gap-3">
        <SkeletonRingCard />
        <SkeletonRingCard />
      </div>
    );
  }

  const wins = stats?.wins ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const activeDecks = stats?.activeDecksCount ?? 0;
  const totalDecks = stats?.decksCount ?? 0;

  const winPct = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const deckPct = totalDecks > 0 ? Math.round((activeDecks / totalDecks) * 100) : 0;

  return (
    <div className="flex gap-3">
      <RingCard
        label="Wins"
        pct={winPct}
        centerText={gamesPlayed === 0 ? "—" : `${winPct}%`}
        subText={gamesPlayed === 0 ? "No games yet" : `${wins} wins / ${gamesPlayed} games`}
        color="#F59E0B"
      />
      <RingCard
        label="Decks"
        pct={deckPct}
        centerText={totalDecks === 0 ? "—" : `${totalDecks}`}
        subText={totalDecks === 0 ? "No decks yet" : `${activeDecks} active / ${totalDecks} total`}
        color="#5C7CFA"
      />
    </div>
  );
}