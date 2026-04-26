import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Swords } from "lucide-react";

/**
 * CommanderCardModal — full-card commander image modal.
 * Shows the commander card art in a large, centered overlay.
 * Closes on X button, backdrop click, or Escape key.
 */
export default function CommanderCardModal({ commanderName, imageUrl, onClose }) {
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
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {/* Card container — stop propagation so clicking image itself doesn't close */}
      <div
        className="relative flex flex-col items-center gap-4 max-w-[320px] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Full card image */}
        <div className="w-full rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={commanderName}
              className="w-full h-auto object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-full aspect-[2/3] bg-gray-800 flex flex-col items-center justify-center gap-3">
              <Swords className="w-12 h-12 text-gray-600" />
              <p className="text-gray-500 text-sm">{commanderName || "Commander"}</p>
            </div>
          )}
        </div>

        {/* Commander name below card */}
        {commanderName && (
          <p className="text-gray-300 text-sm font-semibold text-center truncate w-full px-2">
            {commanderName}
          </p>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}