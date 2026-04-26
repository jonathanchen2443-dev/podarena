import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Swords } from "lucide-react";

/**
 * CommanderCardModal — shows the full MTG card image (frame, text, art) in a modal.
 * Uses commander_full_card_image_url as primary source; falls back to the art crop URL.
 * Closes on X button, backdrop click, or Escape key.
 */
export default function CommanderCardModal({ commanderName, imageUrl, fullCardImageUrl, onClose }) {
  // The "best" image to show — prefer full card, fall back to art crop
  const displayUrl = fullCardImageUrl || imageUrl;

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      {/* Card container — stop propagation so clicking the image doesn't close */}
      <div
        className="relative max-w-[300px] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Full card image — natural MTG card aspect ratio ~2:3 */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={commanderName}
              className="w-full h-auto object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-full aspect-[2/3] bg-gray-800 flex flex-col items-center justify-center gap-3 rounded-2xl">
              <Swords className="w-12 h-12 text-gray-600" />
              <p className="text-gray-500 text-sm">{commanderName || "Commander"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}