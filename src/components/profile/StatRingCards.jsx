import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";

/** SVG circular progress ring */
function Ring({ pct, size = 72, stroke = 6, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(pct / 100, 0), 1);

  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2F38" strokeWidth={stroke} />
      {/* Progress */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}

function WinsCard({ wins, gamesPlayed }) {
  const pct = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return (
    <div className="flex-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex flex-col items-center gap-2">
      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold self-start">Wins</p>
      <div className="relative">
        <Ring pct={pct} color="#F59E0B" />
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm rotate-0">
          {gamesPlayed === 0 ? "—" : `${pct}%`}
        </span>
      </div>
      <p className="text-gray-500 text-[10px] text-center leading-snug">
        {gamesPlayed === 0 ? "No games yet" : `${wins} wins / ${gamesPlayed} games`}
      </p>
    </div>
  );
}

function ActiveDecksCard({ activeDecks, totalDecks }) {
  const navigate = useNavigate();
  const pct = totalDecks > 0 ? Math.round((activeDecks / totalDecks) * 100) : 0;

  if (totalDecks === 0) {
    return (
      <div className="flex-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex flex-col items-center gap-2">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold self-start">Decks</p>
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
          <p className="text-white text-sm font-semibold">No decks yet</p>
          <p className="text-gray-500 text-[10px]">Add your first deck</p>
        </div>
        <button
          onClick={() => navigate(ROUTES.PROFILE_DECK_NEW)}
          className="text-[10px] font-semibold px-3 py-1 rounded-lg ds-btn-primary"
        >
          Add Deck
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 flex flex-col items-center gap-2">
      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold self-start">Decks</p>
      <div className="relative">
        <Ring pct={pct} color="#5C7CFA" />
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
          {pct}%
        </span>
      </div>
      <p className="text-gray-500 text-[10px] text-center leading-snug">
        {activeDecks} active / {totalDecks} total
      </p>
    </div>
  );
}

export default function StatRingCards({ stats, decks }) {
  const wins = stats?.wins ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const totalDecks = decks?.length ?? 0;
  const activeDecks = decks?.filter((d) => d.is_active !== false).length ?? 0;

  return (
    <div className="flex gap-3">
      <WinsCard wins={wins} gamesPlayed={gamesPlayed} />
      <ActiveDecksCard activeDecks={activeDecks} totalDecks={totalDecks} />
    </div>
  );
}