import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Search, Check, AlertCircle, Loader2, ChevronLeft } from "lucide-react";
import ManaCost from "@/components/mtg/ManaCost";
import { searchCards, addCardToDeck, getCardPrintings } from "@/components/services/cardActionsService";
import { toast } from "sonner";

/**
 * AddCardModal — two-step card search and add modal.
 *
 * Step 1: Search by card name → get card-name-level results
 * Step 2: Choose a specific printing + finish, then add to deck
 *
 * Props:
 *   deckId         – string (required)
 *   onClose        – () => void
 *   onCardsUpdated – (cards, summary) => void
 */

const RARITY_COLORS = {
  common:   "text-gray-400",
  uncommon: "text-blue-400",
  rare:     "text-amber-400",
  mythic:   "text-orange-400",
};

function formatPrice(val) {
  if (val == null || val === "") return "---";
  const n = parseFloat(val);
  if (isNaN(n)) return "---";
  return `$${n.toFixed(2)}`;
}

// ── Step 1: Search results ────────────────────────────────────────────────────

function SearchView({ query, setQuery, results, searching, searchError, onSelectCard, inputRef }) {
  return (
    <>
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
        {searchError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs mt-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {searchError}
          </div>
        )}

        {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm">No cards found for "{query}"</p>
          </div>
        )}

        {!searching && query.trim().length < 2 && (
          <div className="text-center py-8">
            <p className="text-gray-700 text-xs">Search for a card to add it to your deck</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-0.5 mt-1">
            {results.map((card) => {
              const uid = card.oracle_id || card.scryfall_id || card.card_name;
              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => onSelectCard(card)}
                  className="w-full flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-white/[0.06] transition-colors text-left"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 rounded-md overflow-hidden bg-white/[0.05]" style={{ width: 36, height: 28 }}>
                    {card.image_small_url ? (
                      <img src={card.image_small_url} alt="" aria-hidden="true" className="w-full h-full object-cover object-top" loading="lazy" draggable={false} />
                    ) : (
                      <div className="w-full h-full bg-white/[0.05]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-white text-xs font-medium leading-tight truncate">{card.card_name}</p>
                      {card.mana_cost && <ManaCost cost={card.mana_cost} size={11} gap={1} />}
                    </div>
                    {card.type_line && (
                      <p className="text-gray-600 text-[10px] leading-tight truncate mt-0.5">{card.type_line}</p>
                    )}
                  </div>

                  {/* Arrow hint */}
                  <span className="flex-shrink-0 text-gray-600 text-[10px] font-medium">Choose&nbsp;›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Step 2: Choose printing ───────────────────────────────────────────────────

function PrintingsView({ selectedCard, printings, printingsLoading, printingsError, addingKey, addedKeys, onAdd, onBack }) {
  const [finishStates, setFinishStates] = useState({});

  function getFinish(printing) {
    const key = printing.scryfall_id;
    if (finishStates[key] !== undefined) return finishStates[key];
    // Default: nonfoil if available, else foil
    return printing.finishes?.includes("nonfoil") ? "nonfoil" : "foil";
  }

  function setFinish(scryfallId, finish) {
    setFinishStates((prev) => ({ ...prev, [scryfallId]: finish }));
  }

  return (
    <>
      {/* Back header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-shrink-0 border-b border-white/[0.04]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{selectedCard.card_name}</p>
          {selectedCard.mana_cost && <ManaCost cost={selectedCard.mana_cost} size={10} gap={1} />}
        </div>
      </div>

      {/* Printings list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {printingsLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-600 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading printings…
          </div>
        )}
        {printingsError && !printingsLoading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs mt-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {printingsError}
          </div>
        )}
        {!printingsLoading && !printingsError && printings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm">No printings found.</p>
          </div>
        )}
        {!printingsLoading && printings.length > 0 && (
          <div className="space-y-1 mt-2">
            {printings.map((printing) => {
              const finish = getFinish(printing);
              const price = finish === "foil" ? printing.price_usd_foil : printing.price_usd_nonfoil;
              const addKey = `${printing.scryfall_id}::${finish}`;
              const isAdding = addingKey === addKey;
              const wasAdded = addedKeys.has(addKey);
              const hasNonfoil = printing.finishes?.includes("nonfoil");
              const hasFoil = printing.finishes?.includes("foil");
              const rarityColor = RARITY_COLORS[printing.rarity] || "text-gray-500";

              return (
                <div
                  key={printing.scryfall_id}
                  className="flex items-center gap-2 px-2 py-2 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                  style={{ background: "rgba(255,255,255,0.025)" }}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 rounded-md overflow-hidden bg-white/[0.04]" style={{ width: 32, height: 25 }}>
                    {printing.image_small_url ? (
                      <img src={printing.image_small_url} alt="" aria-hidden="true" className="w-full h-full object-cover object-top" loading="lazy" draggable={false} />
                    ) : (
                      <div className="w-full h-full bg-white/[0.04]" />
                    )}
                  </div>

                  {/* Set info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[11px] font-semibold font-mono uppercase leading-tight truncate">
                      {printing.set_code || "???"}
                      {printing.collector_number ? ` · ${printing.collector_number}` : ""}
                      <span className={`ml-1 ${rarityColor} text-[9px] normal-case not-italic font-normal`}>
                        {printing.rarity || ""}
                      </span>
                    </p>
                    {printing.set_name && (
                      <p className="text-gray-600 text-[9px] leading-tight truncate mt-0.5">{printing.set_name}</p>
                    )}
                  </div>

                  {/* Finish toggle */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {hasNonfoil && (
                      <button
                        onClick={() => setFinish(printing.scryfall_id, "nonfoil")}
                        className={`h-5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                          finish === "nonfoil"
                            ? "bg-white/[0.15] text-white"
                            : "text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        NF
                      </button>
                    )}
                    {hasFoil && (
                      <button
                        onClick={() => setFinish(printing.scryfall_id, "foil")}
                        className={`h-5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                          finish === "foil"
                            ? "bg-amber-500/20 text-amber-400"
                            : "text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        F
                      </button>
                    )}
                  </div>

                  {/* Price */}
                  <span className="flex-shrink-0 text-gray-400 text-[11px] font-mono min-w-[36px] text-right">
                    {formatPrice(price)}
                  </span>

                  {/* Add button */}
                  <button
                    onClick={() => !wasAdded && !isAdding && onAdd(printing, finish)}
                    disabled={!!addingKey}
                    className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                      wasAdded
                        ? "bg-green-500/15 border border-green-500/30 text-green-400"
                        : "bg-white/[0.06] border border-white/[0.10] text-gray-400 hover:text-white hover:bg-white/[0.10]"
                    }`}
                    aria-label={wasAdded ? "Added" : `Add ${printing.card_name}`}
                  >
                    {isAdding
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : wasAdded
                      ? <Check className="w-3.5 h-3.5" />
                      : <span className="text-[13px] leading-none font-bold">+</span>
                    }
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AddCardModal({ deckId, onClose, onCardsUpdated }) {
  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Printing view state
  const [view, setView] = useState("search"); // "search" | "printings"
  const [selectedCard, setSelectedCard] = useState(null);
  const [printings, setPrintings] = useState([]);
  const [printingsLoading, setPrintingsLoading] = useState(false);
  const [printingsError, setPrintingsError] = useState(null);

  // Add state
  const [addingKey, setAddingKey] = useState(null);
  const [addedKeys, setAddedKeys] = useState(new Set());

  // Keyboard + scroll lock
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

  // Auto-focus
  useEffect(() => { if (view === "search") inputRef.current?.focus(); }, [view]);

  // Debounced search
  useEffect(() => {
    if (view !== "search") return;
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); setSearchError(null); return; }
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
  }, [query, view]);

  const handleSelectCard = useCallback(async (card) => {
    setSelectedCard(card);
    setView("printings");
    setPrintings([]);
    setPrintingsError(null);
    setPrintingsLoading(true);
    const res = await getCardPrintings(card.oracle_id);
    setPrintingsLoading(false);
    if (res?.ok) {
      setPrintings(res.printings || []);
    } else {
      setPrintingsError(res?.message || "Failed to load printings.");
    }
  }, []);

  const handleBack = useCallback(() => {
    setView("search");
    setSelectedCard(null);
    setPrintings([]);
    setPrintingsError(null);
  }, []);

  const handleAdd = useCallback(async (printing, finish) => {
    const addKey = `${printing.scryfall_id}::${finish}`;
    if (addingKey) return;
    setAddingKey(addKey);
    const res = await addCardToDeck(deckId, printing, finish);
    setAddingKey(null);
    if (res?.ok) {
      setAddedKeys((prev) => new Set([...prev, addKey]));
      onCardsUpdated?.(res.cards, res.summary);
      toast.success(`${printing.card_name} (${finish}) added`);
    } else {
      toast.error(res?.message || "Failed to add card.");
    }
  }, [deckId, addingKey, onCardsUpdated]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ background: "#161A20", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <p className="text-white font-semibold text-sm">
            {view === "search" ? "Add Card" : "Choose Printing"}
          </p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === "search" ? (
          <SearchView
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            searchError={searchError}
            onSelectCard={handleSelectCard}
            inputRef={inputRef}
          />
        ) : (
          <PrintingsView
            selectedCard={selectedCard}
            printings={printings}
            printingsLoading={printingsLoading}
            printingsError={printingsError}
            addingKey={addingKey}
            addedKeys={addedKeys}
            onAdd={handleAdd}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}