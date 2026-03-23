import React, { useState, useEffect, useRef } from "react";
import { Search, Layers, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * PodSearchPicker — backend-driven search among the caller's active PODs.
 * Used in LogGame free-POD mode (not locked mode).
 *
 * Props:
 *   authUserId      - Auth User ID — identity for backend gate
 *   profileId       - Profile entity UUID — identity for backend gate
 *   onSelect(pod)   - called when user picks a POD
 */
export default function PodSearchPicker({ authUserId, profileId, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false); // true after first search fires
  const debounceRef = useRef(null);

  // Trigger search on mount (empty query = all my PODs) and on query change
  useEffect(() => {
    if (!authUserId || !profileId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Debounce typed queries; fire immediately for empty (show all on open)
    const delay = query.trim().length === 0 ? 0 : 300;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'searchMyPodsForLogGame',
          callerAuthUserId: authUserId,
          callerProfileId: profileId,
          query: query.trim(),
        });
        setResults(res.data?.pods || []);
        setSearched(true);
      } catch (_) {
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, delay);

    return () => clearTimeout(debounceRef.current);
  }, [authUserId, profileId, query]);

  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        Select POD <span className="text-red-400">*</span>
      </label>
      <div className="relative mb-1">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by POD name or code…"
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
        />
      </div>

      {!authUserId || !profileId ? (
        <p className="text-xs text-gray-500 py-2">Sign in to see your PODs.</p>
      ) : searching && !searched ? (
        <p className="text-xs text-gray-500 py-2">Loading your PODs…</p>
      ) : searched && results.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">
          {query.trim() ? "No matching PODs found." : "You are not an active member of any POD."}
        </p>
      ) : results.length > 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          {results.map((pod) => (
            <button
              key={pod.id}
              type="button"
              onClick={() => onSelect(pod)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
            >
              {pod.image_url ? (
                <img src={pod.image_url} alt="" className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <Layers className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm text-white font-medium">{pod.pod_name}</p>
                <p className="text-xs font-mono text-gray-500">{pod.pod_code}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}