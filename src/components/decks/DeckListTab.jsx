import React, { useState, useEffect, useMemo } from "react";
import { Lock, List, AlertCircle, Clock, Search, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import DeckCardRow from "@/components/decks/DeckCardRow";

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

function PlaceholderBox({ icon: Icon, iconBg, iconColor, title, body }) {
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
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * DeckListTab — renders the deck list tab with real card data.
 *
 * Props:
 *   deckId               – string  (required to load cards)
 *   isOwner              – boolean
 *   showDeckListPublicly – boolean
 *   importStatus         – string: not_imported | importing | imported | failed | unsupported_source
 *   lastSyncedAt         – ISO string or null
 *   cardCount            – number or null (used as hint, not for gating)
 */
export default function DeckListTab({
  deckId,
  isOwner,
  showDeckListPublicly,
  importStatus = 'not_imported',
  lastSyncedAt = null,
  cardCount = null,
}) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [search, setSearch] = useState('');

  const isPrivateForViewer = !isOwner && !showDeckListPublicly;
  const shouldLoad = importStatus === 'imported' && !isPrivateForViewer && !!deckId;

  // Load DeckCard rows when imported
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    setLoadingCards(true);
    setCardError(null);
    base44.functions.invoke('deckImport', { action: 'getDeckCards', deckId })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.error) { setCardError(res.data.error); return; }
        setCards(res.data?.cards || []);
      })
      .catch((e) => { if (!cancelled) setCardError(e?.message || 'Failed to load cards'); })
      .finally(() => { if (!cancelled) setLoadingCards(false); });
    return () => { cancelled = true; };
  }, [deckId, shouldLoad, importStatus]);

  // ── All derived state (must be before any early returns) ──────────────────
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

  const totalCards = cards.reduce((s, c) => s + (c.quantity || 1), 0);

  const syncLabel = lastSyncedAt
    ? `Last synced ${format(parseISO(lastSyncedAt), "MMM d, yyyy")}`
    : null;

  // ── Privacy gate ──────────────────────────────────────────────────────────
  if (isPrivateForViewer) {
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

  // ── Status-based placeholder states ──────────────────────────────────────
  if (importStatus === 'importing') {
    return (
      <PlaceholderBox
        icon={Clock}
        iconBg="rgba(92,124,250,0.10)"
        iconColor="text-blue-400 animate-pulse"
        title="Importing deck list…"
        body="This usually takes a few seconds."
      />
    );
  }

  if (importStatus === 'failed') {
    return (
      <PlaceholderBox
        icon={AlertCircle}
        iconBg="rgba(239,68,68,0.10)"
        iconColor="text-red-400"
        title="Import failed"
        body={isOwner
          ? "Something went wrong importing the deck list. Try refreshing below."
          : "The deck list could not be imported from the external source."}
      />
    );
  }

  if (importStatus === 'unsupported_source') {
    return (
      <PlaceholderBox
        icon={AlertCircle}
        iconBg="rgba(251,191,36,0.08)"
        iconColor="text-amber-400"
        title="Source not yet supported"
        body="The deck link is saved and valid, but automatic import isn't available for this source yet."
      />
    );
  }

  if (importStatus !== 'imported') {
    // not_imported or unknown
    return (
      <PlaceholderBox
        icon={List}
        iconBg="rgba(255,255,255,0.05)"
        iconColor="text-gray-500"
        title="No deck list yet"
        body={isOwner
          ? "Add a deck link or upload a TXT file to import your card list."
          : "Deck list will appear here once imported from the external deck source."}
      />
    );
  }

  // ── imported state: render cards ──────────────────────────────────────────

  if (loadingCards) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  if (cardError) {
    return (
      <PlaceholderBox
        icon={AlertCircle}
        iconBg="rgba(239,68,68,0.10)"
        iconColor="text-red-400"
        title="Could not load deck list"
        body={cardError}
      />
    );
  }

  if (cards.length === 0) {
    return (
      <PlaceholderBox
        icon={List}
        iconBg="rgba(255,255,255,0.05)"
        iconColor="text-gray-500"
        title="No cards found"
        body={isOwner ? "Try re-importing the deck list." : "No cards have been imported yet."}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row: card count + sync date */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-gray-500 text-xs font-medium">{totalCards} cards</span>
        {syncLabel && <span className="text-gray-700 text-xs">{syncLabel}</span>}
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
          return (
            <div key={section}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">
                  {section}
                </span>
                <span className="text-gray-700 text-[10px] font-medium tabular-nums">{sectionQty}</span>
              </div>
              {/* Card rows */}
              <div className="rounded-2xl px-3 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                {sectionCards.map((card, i) => (
                  <DeckCardRow key={card.id || `${card.card_name}-${i}`} card={card} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}