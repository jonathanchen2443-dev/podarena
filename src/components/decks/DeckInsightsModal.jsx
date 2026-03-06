/**
 * TODO: Deck insights were temporarily disabled due to Invalid query errors
 * with the current query model. Rebuild with a clean single-field query
 * approach before re-enabling.
 */
import React from "react";
import ReactDOM from "react-dom";
import { X, Swords, BarChart2 } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";

function ModalContent({ deck, onClose }) {
  const commanderName = deck.commander_name || deck.name;
  const imageUrl = deck.commander_image_url || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative z-10 bg-gray-900 border border-gray-700/60 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header image */}
        <div className="relative w-full h-36 bg-gray-800/60 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={commanderName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Swords className="w-10 h-10 text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <p className="text-white font-bold text-sm leading-tight">{commanderName}</p>
            {deck.commander_name && deck.name && deck.commander_name !== deck.name && (
              <p className="text-gray-500 text-xs mt-0.5">{deck.name}</p>
            )}
            <div className="mt-1.5">
              <ManaPipRow colors={deck.color_identity} size={14} gap={2} />
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* Static placeholder — insights disabled */}
          <div className="flex flex-col items-center justify-center py-5 gap-2">
            <BarChart2 className="w-8 h-8 text-gray-600" />
            <p className="text-gray-400 text-sm font-medium">Insights coming soon</p>
            <p className="text-gray-600 text-xs text-center">Deck performance stats will be available in a future update.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeckInsightsModal({ deck, auth, onClose }) {
  if (!deck) return null;
  const portal = document.getElementById("modal-root");
  const content = <ModalContent deck={deck} onClose={onClose} />;
  return portal ? ReactDOM.createPortal(content, portal) : content;
}