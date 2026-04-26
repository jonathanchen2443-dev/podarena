import React from "react";

/**
 * DeckCardRow — compact card row for the deck list view.
 * Shows: quantity · thumbnail · name · mana cost · type line
 */
export default function DeckCardRow({ card }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      {/* Quantity badge */}
      <span className="flex-shrink-0 w-6 text-center text-xs font-bold text-gray-400 tabular-nums">
        {card.quantity || 1}
      </span>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-8 h-11 rounded overflow-hidden bg-white/[0.04]">
        {card.image_small_url ? (
          <img
            src={card.image_small_url}
            alt={card.card_name}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-white/[0.06]" />
        )}
      </div>

      {/* Name + type line */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium leading-tight truncate">{card.card_name}</p>
        {card.type_line && (
          <p className="text-gray-600 text-[10px] leading-tight truncate mt-0.5">{card.type_line}</p>
        )}
      </div>

      {/* Mana cost */}
      {card.mana_cost && (
        <span className="flex-shrink-0 text-gray-500 text-[10px] font-mono leading-none">
          {card.mana_cost.replace(/[{}]/g, '')}
        </span>
      )}
    </div>
  );
}