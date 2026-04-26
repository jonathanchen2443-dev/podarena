import React from "react";
import ManaCost from "@/components/mtg/ManaCost";

/**
 * DeckCardRow — compact card row for the deck list view.
 *
 * Layout (L→R):
 *   [thumbnail]  [name + type line]  [mana pips · qty]
 *
 * Thumbnail: art-crop style (object-top to show card art, not the frame)
 * Quantity: right-aligned, small, de-emphasised
 * Mana cost: rendered as pips via ManaCost
 */
export default function DeckCardRow({ card }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.04] last:border-0">

      {/* Thumbnail — art-crop style: landscape aspect, object-top to show art zone */}
      <div
        className="flex-shrink-0 rounded-md overflow-hidden bg-white/[0.05]"
        style={{ width: 36, height: 28 }}
      >
        {card.image_small_url ? (
          <img
            src={card.image_small_url}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-top"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-white/[0.06]" />
        )}
      </div>

      {/* Name + type line */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[13px] font-medium leading-tight truncate">
          {card.card_name}
        </p>
        {card.type_line && (
          <p className="text-gray-600 text-[10px] leading-tight truncate mt-0.5">
            {card.type_line}
          </p>
        )}
      </div>

      {/* Right side: mana pips + quantity */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {card.mana_cost && (
          <ManaCost cost={card.mana_cost} size={12} gap={1} />
        )}
        <span
          className="text-gray-600 text-[10px] font-medium tabular-nums leading-none"
          style={{ minWidth: "1ch" }}
        >
          ×{card.quantity || 1}
        </span>
      </div>
    </div>
  );
}