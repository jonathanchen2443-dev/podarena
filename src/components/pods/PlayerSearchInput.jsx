import React, { useState, useEffect } from "react";
import { Search, User } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Reusable player search/autocomplete.
 * Loads all profiles once, filters client-side by display name or 6-digit user ID.
 *
 * Props:
 *   excludeProfileIds: string[]  – profile IDs to exclude from results (already added, self, etc.)
 *   onSelect(profile): void      – called when a user is picked from the dropdown
 *   placeholder: string
 */
export default function PlayerSearchInput({ excludeProfileIds = [], onSelect, placeholder = "Search by name or #ID…" }) {
  const [allProfiles, setAllProfiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    base44.entities.Profile.list("-created_date", 200)
      .then(setAllProfiles)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q.length < 1 ? [] : allProfiles.filter((p) => {
    if (excludeProfileIds.includes(p.id)) return false;
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.display_name_lc?.includes(q) ||
      p.public_user_id === q ||
      p.public_user_id === q.replace(/^0+/, "").padStart(6, "0")
    );
  }).slice(0, 8);

  function handleSelect(profile) {
    onSelect(profile);
    setQuery("");
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
        />
      </div>
      {query.length >= 1 && loaded && (
        <div className="mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-xs px-4 py-3">No users found.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{p.display_name}</p>
                  {p.public_user_id && <p className="text-gray-500 text-xs">#{p.public_user_id}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}