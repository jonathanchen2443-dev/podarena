import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Lock, List, AlertCircle, Plus, Search, X, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DeckCardRow from "@/components/decks/DeckCardRow";
import AddCardModal from "@/components/decks/AddCardModal";
import { listDeckCards, updateCardQuantity, removeCardFromDeck } from "@/components/services/cardActionsService";

// Canonical section order for display
const SECTION_ORDER = [
  'Commander', 'Companion',
  'Creatures', 'Creature',
  'Planeswalkers', 'Planeswalker',
  'Instants', 'Instant',
  'Sorceries', 'Sorcery',
  'Artifacts', 'Artifact',
  'Enchantments', 'Enchantment',
  'Lands', 'Land',
  'Mainboard', 'Sideboard', 'Other',
];

function sectionSortKey(section) {
  const idx = SECTION_ORDER.indexOf(section);
  return idx === -1 ? 99 : idx;
}

// ── Placeholder states ────────────────────────────────────────────────────────

function PlaceholderBox({ icon: Icon, iconBg, iconColor, title, body, action }) {
  return (
    <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
      style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: iconBg }}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[240px]">{body}</p>
      </div>
      {action}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * DeckListTab — renders the deck list tab, loaded via cardActionsService.listDeckCards.
 *
 * Props:
 *   deckId               – string  (required to load cards)
 *   isOwner              – boolean (used as UI hint; backend is authoritative)
 *   showDeckListPublicly – boolean (used as UI hint; backend is authoritative)
 *   importStatus         – string: not_imported | importing | imported | failed | unsupported_source
 *   lastSyncedAt         – ISO string or null (passed through, not used for gating)
 *   cardCount            – number or null (hint only, replaced by backend summary)
 *   onImportDone         – optional callback; if parent refreshes after import, DeckListTab re-fetches
 */
export default function DeckListTab({
  deckId,
  isOwner,
  showDeckListPublicly,
  importStatus = 'not_imported',
  lastSyncedAt = null,
  cardCount = null,
  onImportDone,
}) {
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Privacy — if non-owner and not public, show locked placeholder immediately
  const isPrivateForViewer = !isOwner && !showDeckListPublicly;

  const loadCards = useCallback(async () => {
    if (!deckId || isPrivateForViewer) return;
    setLoadingCards(true);
    setCardError(null);
    const res = await listDeckCards(deckId);
    setLoadingCards(false);
    if (res?.ok) {
      setCards(res.cards || []);
      setSummary(res.summary || null);
    } else if (res?.code === 'DECK_PRIVATE') {
      // Backend confirmed private — show lock
      setCardError('PRIVATE');
    } else {
      setCardError(res?.message || 'Failed to load deck list.');
    }
  }, [deckId, isPrivateForViewer]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // When parent signals import completed, re-fetch cards
  useEffect(() => {
    if (importStatus === 'imported') loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importStatus]);

  const toggleSection = useCallback((section) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // Derived state
  const canEdit = summary?.canEdit ?? isOwner ?? false;
  const q = search.trim().toLowerCase();

  const grouped = useMemo(() => {
    const filtered = q ? cards.filter((c) => c.card_name?.toLowerCase().includes(q)) : cards;
    const map = new Map();
    for (const card of filtered) {
      const sec = card.section || 'Other';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec).push(card);
    }
    return [...map.entries()].sort((a, b) => sectionSortKey(a[0]) - sectionSortKey(b[0]));
  }, [cards, q]);

  const totalCards = summary?.totalCards ?? cards.reduce((s, c) => s + (c.quantity || 1), 0);

  // ── Mutation handlers ─────────────────────────────────────────────────────

  async function handleQuantityChange(deckCardId, newQty) {
    const res = await updateCardQuantity(deckCardId, newQty);
    if (res?.ok) {
      setCards(res.cards || []);
      setSummary(res.summary || null);
    } else {
      toast.error(res?.message || 'Failed to update quantity.');
    }
  }

  async function handleRemove(deckCardId) {
    const res = await removeCardFromDeck(deckCardId);
    if (res?.ok) {
      setCards(res.cards || []);
      setSummary(res.summary || null);
    } else {
      toast.error(res?.message || 'Failed to remove card.');
    }
  }

  function handleCardsUpdated(newCards, newSummary) {
    setCards(newCards || []);
    setSummary(newSummary || null);
  }

  // ── Privacy gate ──────────────────────────────────────────────────────────
  if (isPrivateForViewer || cardError === 'PRIVATE') {
    return (
      <PlaceholderBox
        icon={Lock}
        iconBg="rgba(255,255,255,0.05)"
        iconColor="text-gray-500"
        title="Deck list is private"
        body="The deck owner has chosen to keep their deck list private."
      />
    );
  }

  // ── Importing placeholder ─────────────────────────────────────────────────
  if (importStatus === 'importing' && cards.length === 0) {
    return (
      <PlaceholderBox
        icon={RefreshCw}
        iconBg="rgba(92,124,250,0.10)"
        iconColor="text-blue-400 animate-spin"
        title="Importing deck list…"
        body="This usually takes a few seconds."
      />
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loadingCards) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (cardError && cardError !== 'PRIVATE') {
    return (
      <PlaceholderBox
        icon={AlertCircle}
        iconBg="rgba(239,68,68,0.10)"
        iconColor="text-red-400"
        title="Could not load deck list"
        body={cardError}
        action={
          <button
            onClick={loadCards}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        }
      />
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div>
        <PlaceholderBox
          icon={List}
          iconBg="rgba(255,255,255,0.05)"
          iconColor="text-gray-500"
          title="No cards in this deck yet"
          body={canEdit
            ? "Add cards manually or import your deck list from an external source."
            : "No cards have been added to this deck yet."}
          action={canEdit ? (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl ds-btn-primary text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Card
            </button>
          ) : null}
        />
        {addModalOpen && (
          <AddCardModal
            deckId={deckId}
            onClose={() => setAddModalOpen(false)}
            onCardsUpdated={handleCardsUpdated}
          />
        )}
      </div>
    );
  }

  // ── Card list ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header: count + Add Card */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-gray-500 text-xs font-medium">{totalCards} cards</span>
        {canEdit && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1 h-7 px-3 rounded-lg ds-btn-primary text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Card
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="w-full h-9 pl-8 pr-8 rounded-xl text-sm text-white placeholder-gray-600 outline-none border border-white/[0.07] focus:border-white/[0.15] transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Sections */}
      {grouped.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-6">No cards match your search.</p>
      ) : (
        grouped.map(([section, sectionCards]) => {
          const sectionQty = sectionCards.reduce((s, c) => s + (c.quantity || 1), 0);
          const isOpen = !!search.trim() || !collapsed.has(section);
          return (
            <div key={section}>
              <button
                type="button"
                onClick={() => !search.trim() && toggleSection(section)}
                className="w-full flex items-center justify-between mb-1 px-0.5 group"
                style={{ cursor: search.trim() ? "default" : "pointer" }}
              >
                <span className="flex items-center gap-1.5">
                  {!search.trim() && (
                    isOpen
                      ? <ChevronDown className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                  )}
                  <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">
                    {section}
                  </span>
                </span>
                <span className="text-gray-700 text-[10px] font-medium tabular-nums">{sectionQty}</span>
              </button>

              {isOpen && (
                <div className="rounded-2xl px-3 py-0.5 mb-0.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                  {sectionCards.map((card, i) => (
                    <DeckCardRow
                      key={card.id || `${card.card_name}-${i}`}
                      card={card}
                      canEdit={canEdit}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add Card modal */}
      {addModalOpen && (
        <AddCardModal
          deckId={deckId}
          onClose={() => setAddModalOpen(false)}
          onCardsUpdated={handleCardsUpdated}
        />
      )}
    </div>
  );
}