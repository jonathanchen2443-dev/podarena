import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Search, Plus, Check, AlertCircle, Loader2 } from "lucide-react";
import ManaCost from "@/components/mtg/ManaCost";
import { searchCards, addCardToDeck } from "@/components/services/cardActionsService";
import { toast } from "sonner";

/**
 * AddCardModal — owner-only card search and add modal.
 *
 * Props:
 *   deckId     – string (required)
 *   onClose    – () => void
 *   onCardsUpdated – (cards, summary) => void — called after successful add
 */
export default function AddCardModal({ deckId, onClose, onCardsUpdated }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // Track which card oracle_ids have been added in this session (for per-row feedback)
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null); // oracle_id or scryfall_id of card being added
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const res = await searchCards(trimmed);
      setSearching(false);
      if (res?.ok) {
        setResults(res.cards || []);
      } else {
        setSearchError(res?.message || "Search failed. Please try again.");
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleAdd = useCallback(async (card) => {
    const uid = card.oracle_id || card.scryfall_id || card.card_name;
    if (addingId) return; // prevent concurrent adds
    setAddingId(uid);
    const res = await addCardToDeck(deckId, card);
    setAddingId(null);
    if (res?.ok) {
      setAddedIds((prev) => new Set([...prev, uid]));
      onCardsUpdated?.(res.cards, res.summary);
      toast.success(`${card.card_name} added`);
    } else {
      toast.error(res?.message || "Failed to add card.");
    }
  }, [deckId, addingId, onCardsUpdated]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{
          background: "#161A20",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <p className="text-white font-semibold text-sm">Add Card</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            {searching
              ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 animate-spin" />
              : query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by card name…"
              className="w-full h-9 pl-8 pr-8 rounded-xl text-sm text-white placeholder-gray-600 outline-none border border-white/[0.07] focus:border-white/[0.15] transition-colors"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          </div>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className="text-gray-600 text-xs mt-1.5 px-0.5">Type at least 2 characters to search</p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {/* Error */}
          {searchError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs mt-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {searchError}
            </div>
          )}

          {/* Empty state — no results */}
          {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">No cards found for "{query}"</p>
            </div>
          )}

          {/* Idle state */}
          {!searching && query.trim().length < 2 && (
            <div className="text-center py-8">
              <p className="text-gray-700 text-xs">Search for a card to add it to your deck</p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {results.map((card) => {
                const uid = card.oracle_id || card.scryfall_id || card.card_name;
                const isAdding = addingId === uid;
                const wasAdded = addedIds.has(uid);
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
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
                        <div className="w-full h-full bg-white/[0.05]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white text-xs font-medium leading-tight truncate">
                          {card.card_name}
                        </p>
                        {card.mana_cost && (
                          <ManaCost cost={card.mana_cost} size={11} gap={1} />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {card.type_line && (
                          <p className="text-gray-600 text-[10px] leading-tight truncate">
                            {card.type_line}
                          </p>
                        )}
                        {card.set_code && (
                          <p className="text-gray-700 text-[9px] font-mono uppercase leading-tight flex-shrink-0">
                            {card.set_code}{card.collector_number ? ` · ${card.collector_number}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => !wasAdded && !isAdding && handleAdd(card)}
                      disabled={isAdding || !!addingId}
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                        wasAdded
                          ? "bg-green-500/15 border border-green-500/30 text-green-400"
                          : "bg-white/[0.06] border border-white/[0.10] text-gray-400 hover:text-white hover:bg-white/[0.10]"
                      }`}
                      aria-label={wasAdded ? "Added" : `Add ${card.card_name}`}
                    >
                      {isAdding
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : wasAdded
                        ? <Check className="w-3.5 h-3.5" />
                        : <Plus className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}