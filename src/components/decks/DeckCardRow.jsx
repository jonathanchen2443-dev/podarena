import React, { useState } from "react";
import ManaCost from "@/components/mtg/ManaCost";
import { Minus, Plus, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import CardImageModal from "@/components/decks/CardImageModal";

/**
 * DeckCardRow — compact, flat row for the deck list view.
 *
 * Layout:
 *   [thumbnail] [name + foil badge + mana] [spacer] [price] [qty controls | read-only]
 *
 * Props:
 *   card             – DeckCard record
 *   canEdit          – boolean
 *   onQuantityChange – async (deckCardId, newQuantity) => void
 *   onRemove         – async (deckCardId) => void
 *   issues           – array of issue objects (optional)
 */

function formatPrice(val) {
  if (val == null || val === "") return null; // null = show "---"
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return `$${n.toFixed(2)}`;
}

function getDisplayPrice(card) {
  const finish = card.selected_finish || "nonfoil";
  const raw = finish === "foil" ? card.price_usd_foil : card.price_usd_nonfoil;
  return formatPrice(raw);
}

export default function DeckCardRow({ card, canEdit = false, onQuantityChange, onRemove, issues = [] }) {
  const [pending, setPending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isFoil = card.is_foil || card.selected_finish === "foil";
  const price = getDisplayPrice(card);
  const hasError = issues.some((i) => i.severity === "error");
  const hasIssue = issues.length > 0;

  async function handleMinus(e) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    if (card.quantity <= 1) {
      await onRemove?.(card.id);
    } else {
      await onQuantityChange?.(card.id, (card.quantity || 1) - 1);
    }
    setPending(false);
  }

  async function handlePlus(e) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    await onQuantityChange?.(card.id, (card.quantity || 1) + 1);
    setPending(false);
  }

  async function handleRemove(e) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    await onRemove?.(card.id);
    setPending(false);
  }

  function openPreview() {
    setPreviewOpen(true);
  }

  const isCommander = card.is_commander;

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 border-b border-white/[0.03] last:border-0 cursor-pointer select-none ${
          isCommander ? "opacity-95" : ""
        }`}
        onClick={openPreview}
      >
        {/* Thumbnail */}
        <div
          className={`flex-shrink-0 rounded-[5px] overflow-hidden ${isCommander ? "ring-1 ring-blue-500/30" : "bg-white/[0.04]"}`}
          style={{ width: 32, height: 25 }}
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
            <div className="w-full h-full bg-white/[0.05]" />
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <p className={`text-[13px] font-medium leading-tight truncate ${isCommander ? "text-blue-200" : "text-white"}`}>
            {card.card_name}
          </p>

          {/* Foil badge */}
          {isFoil && (
            <span
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold leading-none"
              style={{ background: "rgba(251,191,36,0.2)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.4)" }}
              title="Foil"
            >
              F
            </span>
          )}

          {/* Issue icon */}
          {hasIssue && (
            hasError
              ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
              : <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          )}

          {/* Mana cost */}
          {card.mana_cost && (
            <span className="flex-shrink-0">
              <ManaCost cost={card.mana_cost} size={11} gap={1} />
            </span>
          )}
        </div>

        {/* Price */}
        <span
          className="flex-shrink-0 text-[11px] font-mono tabular-nums min-w-[36px] text-right"
          style={{ color: price ? "#9CA3AF" : "#4B5563" }}
        >
          {price ?? "---"}
        </span>

        {/* Controls */}
        <div
          className="flex-shrink-0 flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit && !isCommander ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleMinus}
                disabled={pending}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ color: "#6B7280" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#E5E7EB"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
                aria-label="Decrease"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-white text-[12px] font-semibold tabular-nums min-w-[18px] text-center">
                {card.quantity || 1}
              </span>
              <button
                onClick={handlePlus}
                disabled={pending}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ color: "#6B7280" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#E5E7EB"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
                aria-label="Increase"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={handleRemove}
                disabled={pending}
                className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-30 ml-0.5"
                style={{ color: "#6B7280" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.background = "rgba(248,113,113,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.background = ""; }}
                aria-label="Remove"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-gray-600 text-[11px] font-medium tabular-nums min-w-[24px] text-right pr-0.5">
              ×{card.quantity || 1}
            </span>
          )}
        </div>
      </div>

      {previewOpen && (
        <CardImageModal card={card} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
}