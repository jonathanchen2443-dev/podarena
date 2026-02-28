import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Pencil, Trash2, Swords } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";

/**
 * DeckTile — square 2-column tile.
 * Props: deck (with optional gamesWithDeck, winsWithDeck, winRatePercent), onDelete, editHref (optional override for edit link)
 */
export default function DeckTile({ deck, onDelete, editHref }) {
  const winRate = deck.winRatePercent ?? (
    deck.gamesWithDeck > 0
      ? Math.round((deck.winsWithDeck / deck.gamesWithDeck) * 100)
      : 0
  );
  const gamesCount = deck.gamesWithDeck ?? 0;
  const colors = deck.color_identity || [];
  const imageUrl = deck.commander_image_url || null;
  const commanderName = deck.commander_name || deck.name;

  return (
    <div className="relative flex flex-col rounded-2xl bg-gray-900/70 border border-gray-800/50 overflow-hidden group">
      {/* Commander image (square aspect) */}
      <div className="relative w-full aspect-square bg-gray-800/60 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={commanderName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Swords className="w-10 h-10 text-gray-700" />
          </div>
        )}

        {/* Active / Retired badge */}
        <div className="absolute top-2 left-2">
          {deck.is_active !== false ? (
            <span className="flex items-center gap-1 bg-gray-900/80 border border-green-700/60 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-green-400 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-gray-900/80 border border-gray-600/60 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-gray-500 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
              Retired
            </span>
          )}
        </div>

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={editHref || ROUTES.PROFILE_DECK_EDIT(deck.id)}
            className="w-7 h-7 rounded-lg bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-violet-400 hover:border-violet-500/50 transition-colors backdrop-blur-sm"
          >
            <Pencil className="w-3 h-3" />
          </Link>
          <button
            onClick={() => onDelete?.(deck)}
            className="w-7 h-7 rounded-lg bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-colors backdrop-blur-sm"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Info section */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Deck name (small, muted) */}
        {deck.commander_name && deck.name && deck.commander_name !== deck.name && (
          <p className="text-gray-600 text-[9px] truncate leading-none">{deck.name}</p>
        )}

        {/* Commander name */}
        <p className="text-white text-xs font-semibold truncate leading-tight">{commanderName}</p>

        {/* Mana pips */}
        <ManaPipRow colors={colors} size={14} gap={2} />

        {/* Winrate bar */}
        <div className="mt-auto pt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 text-[9px]">{gamesCount} {gamesCount === 1 ? "game" : "games"}</span>
            <span className="text-gray-400 text-[9px] font-semibold">{winRate}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-gray-800">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
              style={{ width: `${Math.min(winRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}