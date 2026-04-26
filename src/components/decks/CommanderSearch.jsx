import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// ── Tiny in-memory cache (60s TTL) ──────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 60_000;

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { _cache.set(key, { ts: Date.now(), value }); return value; }

// ── Scryfall helpers ─────────────────────────────────────────────────────────

/**
 * Search commander-only cards via Scryfall search API.
 * Returns array of card objects (not just names).
 */
async function searchCommanders(query) {
  const cKey = `cmd::${query}`;
  const cached = cacheGet(cKey);
  if (cached) return cached;

  const q = encodeURIComponent(`is:commander ${query}`);
  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=${q}&order=name&unique=cards`
  );
  if (res.status === 404) return cacheSet(cKey, []); // no results
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return cacheSet(cKey, data.data || []);
}

function extractArtCrop(card) {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop;
  if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop;
  // fallback to normal if art_crop somehow missing
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return "";
}

function extractFullCardImage(card) {
  // Prefer "large" for best quality full-card render; fallback to "normal"
  if (card.image_uris?.large) return card.image_uris.large;
  if (card.image_uris?.normal) return card.image_uris.normal;
  // For double-faced cards use front face
  if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return "";
}

/**
 * CommanderSearch
 * Props:
 *   value          – current commander_name string
 *   onChange(name) – called when text changes manually
 *   onSelect({ name, color_identity, commander_image_url }) – called on card selection
 *   inputClassName – extra classes for the input
 */
export default function CommanderSearch({ value, onChange, onSelect, inputClassName = "" }) {
  // suggestions are card objects now, not just strings
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const debounceRef = useRef(null);
  const inflightAc = useRef(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const triggerSearch = useCallback((text) => {
    clearTimeout(debounceRef.current);
    if (text.length < 2) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (inflightAc.current) return;
      inflightAc.current = true;
      setLoading(true);
      setFetchError("");
      try {
        const cards = await searchCommanders(text);
        const top8 = cards.slice(0, 8);
        setSuggestions(top8);
        setOpen(top8.length > 0);
      } catch {
        setFetchError("Could not load suggestions.");
        setOpen(false);
      } finally {
        setLoading(false);
        inflightAc.current = false;
      }
    }, 350);
  }, []);

  function handleInputChange(e) {
    const text = e.target.value;
    onChange(text);
    triggerSearch(text);
  }

  function handleSelect(card) {
    setOpen(false);
    setSuggestions([]);
    const imageUrl = extractArtCrop(card);
    const fullCardImageUrl = extractFullCardImage(card);
    const colorIdentity = card.color_identity || card.colors || [];
    onChange(card.name);
    onSelect({
      name: card.name,
      color_identity: colorIdentity,
      commander_image_url: imageUrl,
      commander_full_card_image_url: fullCardImageUrl,
      commander_scryfall_id: card.id || "",
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="e.g. Atraxa, Praetors' Voice"
          className={`bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-[rgb(var(--ds-primary-rgb))] pr-8 ${inputClassName}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: "var(--ds-primary-text)" }} />
        )}
      </div>

      {fetchError && (
        <p className="text-amber-400 text-xs mt-1">{fetchError}</p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full mt-1 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "#111827" }}
        >
          {suggestions.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(card)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-800/60 transition-colors"
              >
                {/* tiny art thumbnail */}
                {card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop ? (
                  <img
                    src={card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop}
                    alt=""
                    className="w-8 h-8 rounded object-cover flex-shrink-0 opacity-90"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-800 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-200">{card.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}