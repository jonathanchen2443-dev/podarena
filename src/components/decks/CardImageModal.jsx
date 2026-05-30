import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";

/**
 * CardImageModal — full card image preview overlay.
 *
 * Props:
 *   card     – DeckCard or normalized printing object
 *   onClose  – () => void
 */
export default function CardImageModal({ card, onClose }) {
  const imageUrl = card?.image_normal_url || card?.image_small_url || null;
  const setInfo = card?.set_code
    ? `${card.set_code.toUpperCase()}${card.collector_number ? ` · ${card.collector_number}` : ""}`
    : null;

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const content = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-3 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.10)" }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card?.card_name || "Card"}
            className="w-full rounded-2xl shadow-2xl"
            draggable={false}
            style={{ maxWidth: 280 }}
          />
        ) : (
          <div
            className="w-full rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", aspectRatio: "2/3", maxWidth: 280 }}
          >
            <span className="text-gray-600 text-sm">No image available</span>
          </div>
        )}

        {/* Card info */}
        <div className="text-center">
          <p className="text-white text-sm font-semibold leading-tight">{card?.card_name}</p>
          {setInfo && (
            <p className="text-gray-500 text-xs mt-0.5 font-mono uppercase">{setInfo}</p>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}