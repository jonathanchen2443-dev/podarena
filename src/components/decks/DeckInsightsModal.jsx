import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Swords, RefreshCw } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { getDeckInsights } from "@/components/services/deckInsightsService";

function ModalContent({ deck, auth, onClose }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getDeckInsights(auth, deck);
      setInsights(data);
    } catch (e) {
      const isRate = e?.message?.toLowerCase().includes("rate") || e?.message?.toLowerCase().includes("429");
      setError(isRate ? "Too many requests. Please wait a moment and retry." : (e.message || "Failed to load insights."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [deck.id]);

  const commanderName = deck.commander_name || deck.name;
  const imageUrl = deck.commander_image_url || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
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

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center space-y-2 py-2">
              <p className="text-red-400 text-xs">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-violet-400 text-xs hover:text-violet-300 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : insights ? (
            <div className="space-y-3">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Games", value: insights.gamesWithDeck },
                  { label: "Wins", value: insights.winsWithDeck },
                  { label: "Win Rate", value: `${insights.winRatePercent}%` },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800/60 rounded-xl p-2 text-center">
                    <p className="text-white font-bold text-base">{s.value}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Most defeated */}
              <div className="bg-gray-800/40 rounded-xl p-3">
                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Most Defeated Opponent</p>
                {insights.mostDefeatedOpponent ? (
                  <p className="text-white text-sm font-medium">
                    {insights.mostDefeatedOpponent.display_name}
                    <span className="text-gray-400 font-normal text-xs ml-1.5">
                      ({insights.mostDefeatedOpponent.count}×)
                    </span>
                  </p>
                ) : (
                  <p className="text-gray-500 text-xs italic">Not enough data yet</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function DeckInsightsModal({ deck, auth, onClose }) {
  if (!deck) return null;
  const portal = document.getElementById("modal-root");
  const content = <ModalContent deck={deck} auth={auth} onClose={onClose} />;
  return portal ? ReactDOM.createPortal(content, portal) : content;
}