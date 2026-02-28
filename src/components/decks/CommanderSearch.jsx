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

async function fetchSuggestions(query) {
  const cached = cacheGet(`ac::${query}`);
  if (cached) return cached;
  const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Autocomplete failed");
  const data = await res.json();
  return cacheSet(`ac::${query}`, data.data || []);
}

async function fetchCardDetails(name) {
  const cached = cacheGet(`card::${name}`);
  if (cached) return cached;
  const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error("Card not found");
  const card = await res.json();
  return cacheSet(`card::${name}`, card);
}

function extractImageUrl(card) {
  if (card.image_uris?.normal) return card.image_uris.normal;
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
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const debounceRef = useRef(null);
  const inflightAc = useRef(false);
  const inflightCard = useRef(false);
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

  const triggerAutocomplete = useCallback((text) => {
    clearTimeout(debounceRef.current);
    if (text.length < 2) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (inflightAc.current) return;
      inflightAc.current = true;
      setLoading(true);
      setFetchError("");
      try {
        const results = await fetchSuggestions(text);
        setSuggestions(results.slice(0, 8));
        setOpen(results.length > 0);
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
    triggerAutocomplete(text);
  }

  async function handleSelect(name) {
    setOpen(false);
    setSuggestions([]);
    onChange(name);
    if (inflightCard.current) return;
    inflightCard.current = true;
    setLoading(true);
    setFetchError("");
    try {
      const card = await fetchCardDetails(name);
      const imageUrl = extractImageUrl(card);
      const colorIdentity = card.color_identity || card.colors || [];
      onSelect({ name: card.name, color_identity: colorIdentity, commander_image_url: imageUrl });
    } catch {
      setFetchError("Could not fetch card details. You can fill the fields manually.");
    } finally {
      setLoading(false);
      inflightCard.current = false;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="e.g. Atraxa, Praetors' Voice"
          className={`bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 pr-8 ${inputClassName}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 animate-spin" />
        )}
      </div>

      {fetchError && (
        <p className="text-amber-400 text-xs mt-1">{fetchError}</p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-850 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "#111827" }}>
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-violet-600/20 hover:text-white transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}