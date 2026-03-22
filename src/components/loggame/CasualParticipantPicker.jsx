import React, { useState, useEffect, useRef } from "react";
import { X, User, Search, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * CasualParticipantPicker — backend search-on-demand for participant picking.
 *
 * Searches profiles via the searchProfilesForGameLog backend action (service role),
 * which returns user_id so participant_user_id linkage is correct for all user types.
 *
 * onAdd(profileId, participantData) where participantData = {
 *   profileId: string,     Profile.id
 *   authUserId: string,    Auth User ID (user_id on Profile) — from backend service role
 *   display_name: string,
 *   avatar_url: string|null,
 * }
 */
export default function CasualParticipantPicker({
  selectedIds,            // Profile.id[]
  onAdd,
  onRemove,
  currentUserProfileId,   // Profile.id of the logged-in user
  currentUserProfile,     // { display_name, avatar_url } — optional, seeds self chip without LogGame changes
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Map of profileId → profile data for selected participants (for display in the chip list)
  // Seeded with current user so the auto-added self chip renders without a backend fetch
  const [selectedProfiles, setSelectedProfiles] = useState(() =>
    currentUserProfileId && currentUserProfile
      ? { [currentUserProfileId]: currentUserProfile }
      : {}
  );

  const debounceRef = useRef(null);

  // Debounced backend search — fires after 300ms of no typing, min 2 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'searchProfilesForGameLog',
          searchQuery: query.trim(),
        });
        setResults(res.data?.profiles || []);
      } catch (_) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Filter out already-selected profiles from results
  const filtered = results.filter((p) => !selectedIds.includes(p.id));

  function handleSelect(profile) {
    onAdd(profile.id, {
      profileId: profile.id,
      authUserId: profile.user_id || null,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url || null,
    });
    // Cache the profile data so we can render the chip
    setSelectedProfiles((prev) => ({ ...prev, [profile.id]: profile }));
    setQuery("");
    setResults([]);
  }

  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        Participants <span className="text-red-400">*</span>{" "}
        <span className="text-gray-600 normal-case">(min. 2, max. 4)</span>
      </label>

      {/* Search box */}
      {selectedIds.length < 4 && (
        <div className="relative">
          {searching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or ID…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
          />
        </div>
      )}

      {/* Helper text / search results */}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-gray-600 text-xs mt-1.5 px-1">Type at least 2 characters to search…</p>
      )}
      {query.trim().length >= 2 && (
        <div className="mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
          {searching ? (
            <p className="text-gray-500 text-xs px-4 py-3">Searching…</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-xs px-4 py-3">No users found.</p>
          ) : (
            filtered.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-gray-800 transition-colors text-left"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" style={{ color: "var(--ds-primary-text)" }} />
                  </div>
                )}
                <span className="truncate">{p.display_name}</span>
                {p.username && <span className="text-gray-500 text-xs">@{p.username}</span>}
                {p.id === currentUserProfileId && <span className="text-gray-500 text-xs">(you)</span>}
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected participants chips */}
      {selectedIds.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedIds.map((profileId) => {
            const profile = selectedProfiles[profileId];
            return (
              <div
                key={profileId}
                className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" style={{ color: "var(--ds-primary-text)" }} />
                  </div>
                )}
                <span className="flex-1 text-sm text-white truncate">
                  {profile?.display_name || profileId}
                  {profileId === currentUserProfileId && <span className="text-gray-500 text-xs ml-1">(you)</span>}
                </span>
                {profileId !== currentUserProfileId && (
                  <button
                    type="button"
                    onClick={() => onRemove(profileId)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}