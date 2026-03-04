import React, { useState, useEffect } from "react";
import { UserPlus, X, User, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * CasualParticipantPicker — lets the user search all profiles to add participants
 * (no league membership requirement).
 */
/**
 * onAdd(id, profileData) — passes id + profile object so parent can cache display names
 */
export default function CasualParticipantPicker({
  selectedIds,
  onAdd,
  onRemove,
  currentUserId,
}) {
  const [allProfiles, setAllProfiles] = useState([]);
  const [query, setQuery] = useState("");
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  useEffect(() => {
    base44.entities.Profile.list("-created_date", 200)
      .then((ps) => setAllProfiles(ps))
      .catch(() => {})
      .finally(() => setProfilesLoaded(true));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = allProfiles.filter((p) => {
    if (selectedIds.includes(p.id)) return false;
    if (!q) return true;
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.display_name_lc?.includes(q) ||
      p.username_lc?.includes(q) ||
      p.public_user_id === q ||
      p.public_user_id === q.replace(/^0+/, "").padStart(6, "0")
    );
  });

  function handleSelect(profile) {
    onAdd(profile.id, { userId: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url });
    setQuery("");
  }

  function handleAddSelf() {
    const self = allProfiles.find((p) => p.id === currentUserId);
    if (self) onAdd(self.id, { userId: self.id, display_name: self.display_name, avatar_url: self.avatar_url });
    else onAdd(currentUserId);
  }

  const isSelfAdded = selectedIds.includes(currentUserId);

  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        Participants <span className="text-red-400">*</span>{" "}
        <span className="text-gray-600 normal-case">(min. 2)</span>
      </label>

      {/* Quick-add self */}
      {!isSelfAdded && currentUserId && (
        <button
          type="button"
          onClick={handleAddSelf}
          className="mb-2 flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
          style={{ color: "var(--ds-primary-text)" }}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add me
        </button>
      )}

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
        />
      </div>

      {/* Dropdown results */}
      {query && profilesLoaded && (
        <div className="mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
          {filtered.length === 0 ? (
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
                {p.id === currentUserId && <span className="text-gray-500 text-xs">(you)</span>}
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected list */}
      {selectedIds.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedIds.map((uid) => {
            const profile = allProfiles.find((p) => p.id === uid);
            return (
              <div
                key={uid}
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
                  {profile?.display_name || uid}
                  {uid === currentUserId && <span className="text-gray-500 text-xs ml-1">(you)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(uid)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}