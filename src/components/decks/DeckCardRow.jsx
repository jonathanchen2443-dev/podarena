import React, { useState } from "react";
import ManaCost from "@/components/mtg/ManaCost";
import { Minus, Plus, Trash2, AlertTriangle, AlertCircle } from "lucide-react";

/**
 * DeckCardRow — compact card row for the deck list view.
 *
 * Layout (L→R):
 *   [thumbnail]  [name + type line]  [mana pips · qty controls]
 *
 * Props:
 *   card             – DeckCard record
 *   canEdit          – boolean; shows owner controls when true
 *   onQuantityChange – async (deckCardId, newQuantity) => void
 *   onRemove         – async (deckCardId) => void
 *   issues           – array of issue objects for this card (optional)
 */
export default function DeckCardRow({ card, canEdit = false, onQuantityChange, onRemove, issues = [] }) {
  const [pending, setPending] = useState(false);

  async function handleMinus() {
    if (pending) return;
    setPending(true);
    if (card.quantity <= 1) {
      await onRemove?.(card.id);
    } else {
      await onQuantityChange?.(card.id, (card.quantity || 1) - 1);
    }
    setPending(false);
  }

  async function handlePlus() {
    if (pending) return;
    setPending(true);
    await onQuantityChange?.(card.id, (card.quantity || 1) + 1);
    setPending(false);
  }

  async function handleRemove() {
    if (pending) return;
    setPending(true);
    await onRemove?.(card.id);
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.04] last:border-0">

      {/* Thumbnail */}
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
        <div className="flex items-center gap-1.5">
          <p className="text-white text-[13px] font-medium leading-tight truncate">
            {card.card_name}
          </p>
          {issues.length > 0 && (() => {
            const hasError = issues.some((i) => i.severity === 'error');
            return hasError
              ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
              : <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />;
          })()}
        </div>
        {card.type_line && (
          <p className="text-gray-600 text-[10px] leading-tight truncate mt-0.5">
            {card.type_line}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {card.mana_cost && (
          <ManaCost cost={card.mana_cost} size={12} gap={1} />
        )}

        {canEdit && !card.is_commander ? (
          /* Owner controls: − qty + trash (not shown for commander row) */
          <div className="flex items-center gap-1">
            <button
              onClick={handleMinus}
              disabled={pending}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-gray-400 text-[11px] font-semibold tabular-nums min-w-[16px] text-center">
              {card.quantity || 1}
            </span>
            <button
              onClick={handlePlus}
              disabled={pending}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemove}
              disabled={pending}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40 ml-0.5"
              aria-label="Remove card"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* View-only or commander: quantity badge (commander always shows ×1) */
          <span
            className="text-gray-600 text-[10px] font-medium tabular-nums leading-none"
            style={{ minWidth: "1ch" }}
          >
            ×{card.quantity || 1}
          </span>
        )}
      </div>
    </div>
  );
}