import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Pencil, Trash2, Swords, Star, Info } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { base44 } from "@/api/base44Client";
import { invalidateDeckStatsCache } from "@/components/services/deckStatsService";
import { invalidateDeckInsightsCache } from "@/components/services/deckInsightsService";

/**
 * DeckTile — square 2-column tile.
 * Props:
 *   deck         – deck with optional gamesWithDeck/winsWithDeck/winRatePercent
 *   onDelete     – (deck) => void
 *   editHref     – optional override for edit link
 *   onFavoriteToggle – (deck, newIsFavorite) => void  (for optimistic update in parent)
 *   onInsights   – (deck) => void  (opens insights modal in parent)
 *   isGuest      – boolean
 */
export default function DeckTile({ deck, onDelete, editHref, onFavoriteToggle, onInsights, isGuest }) {
  const [localFav, setLocalFav] = useState(deck.is_favorite ?? false);
  const [favSaving, setFavSaving] = useState(false);

  const winRate = deck.winRatePercent ?? (
    deck.gamesWithDeck > 0
      ? Math.round((deck.winsWithDeck / deck.gamesWithDeck) * 100)
      : 0
  );
  const gamesCount = deck.gamesWithDeck ?? 0;
  const colors = deck.color_identity || [];
  const imageUrl = deck.commander_image_url || null;
  const commanderName = deck.commander_name || deck.name;

  async function handleFavoriteClick(e) {
    e.stopPropagation();
    e.preventDefault();
    if (favSaving) return;
    const next = !localFav;
    setLocalFav(next); // optimistic
    setFavSaving(true);
    try {
      await base44.entities.Deck.update(deck.id, { is_favorite: next });
      onFavoriteToggle?.(deck, next);
      if (deck.owner_id) {
        invalidateDeckStatsCache(deck.owner_id);
        invalidateDeckInsightsCache(deck.owner_id);
      }
    } catch {
      setLocalFav(!next); // revert
    } finally {
      setFavSaving(false);
    }
  }

  function handleImageClick(e) {
    e.stopPropagation();
    onInsights?.(deck);
  }

  return (
    <div className="relative flex flex-col rounded-2xl bg-gray-900/70 border border-gray-800/50 overflow-hidden group">
      {/* Commander image (square aspect) — click opens insights */}
      <div
        className="relative w-full aspect-square bg-gray-800/60 overflow-hidden cursor-pointer"
        onClick={handleImageClick}
      >
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

        {/* Info icon (visible on hover) */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-6 h-6 rounded-md bg-gray-900/80 border border-gray-700 flex items-center justify-center backdrop-blur-sm">
            <Info className="w-3 h-3 text-gray-300" />
          </div>
        </div>

        {/* Edit + Delete overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={editHref || ROUTES.PROFILE_DECK_EDIT(deck.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-lg bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:border-gray-500 transition-colors backdrop-blur-sm"
            style={{}}
            onMouseEnter={e => e.currentTarget.style.color = "var(--ds-primary-text)"}
            onMouseLeave={e => e.currentTarget.style.color = ""}
          >
            <Pencil className="w-3 h-3" />
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(deck); }}
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

        {/* Commander name + star */}
        <div className="flex items-center gap-1.5">
          {!isGuest && (
            <button
              onClick={handleFavoriteClick}
              disabled={favSaving}
              className="flex-shrink-0 transition-opacity disabled:opacity-50"
              title={localFav ? "Remove from favorites" : "Add to favorites"}
            >
              <Star
                className={`w-3.5 h-3.5 transition-colors ${
                  localFav ? "fill-amber-400 text-amber-400" : "text-gray-600 hover:text-amber-400"
                }`}
              />
            </button>
          )}
          <p className="text-white text-xs font-semibold truncate leading-tight flex-1">{commanderName}</p>
        </div>

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
              className="h-1 rounded-full transition-all duration-500"
              style={{ background: "linear-gradient(to right, rgb(var(--ds-primary-rgb)), var(--ds-primary-text))" }}
              style={{ width: `${Math.min(winRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}