/**
 * PublicDeckGrid — read-only deck display for public profiles.
 * Clicking a deck navigates to the Deck Insights page.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { ROUTES } from "@/components/utils/routes";

function ReadOnlyDeckTile({ deck, onClick }) {
  const hasImage = !!deck.commander_image_url;

  return (
    <button
      onClick={() => onClick(deck)}
      className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900 border border-gray-800/60 hover:border-gray-600/60 transition-all group"
    >
      {hasImage ? (
        <img
          src={deck.commander_image_url}
          alt={deck.commander_name || deck.name}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center ds-accent-bg">
          <Layers className="w-8 h-8" style={{ color: "var(--ds-primary-text)", opacity: 0.5 }} />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
        <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-black/60 rounded-lg">
          Insights
        </span>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-4 pb-2">
        <p className="text-white text-xs font-medium truncate leading-tight">{deck.name}</p>
        {deck.commander_name && (
          <p className="text-gray-400 text-[10px] truncate">{deck.commander_name}</p>
        )}
        {deck.color_identity?.length > 0 && (
          <div className="mt-1">
            <ManaPipRow colors={deck.color_identity} size={10} />
          </div>
        )}
      </div>
    </button>
  );
}

export default function PublicDeckGrid({ decks, loading }) {
  const navigate = useNavigate();

  function handleDeckClick(deck) {
    navigate(ROUTES.DECK_INSIGHTS(deck.id));
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square rounded-2xl bg-gray-900 border border-gray-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!decks || decks.length === 0) {
    return (
      <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-6 text-center">
        <Layers className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No decks yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {decks.map((deck) => (
        <ReadOnlyDeckTile key={deck.id} deck={deck} onClick={handleDeckClick} />
      ))}
    </div>
  );
}