/**
 * PlayerSearch — inline user discovery component.
 * Search by display_name or exact public_user_id.
 * Navigates to public profile on selection.
 */
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, X, Loader2 } from "lucide-react";
import { searchProfiles } from "@/components/services/profileService.jsx";
import { ROUTES } from "@/components/utils/routes";

export default function PlayerSearch({ placeholder = "Search players…", className = "" }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchProfiles(val.trim());
        setResults(found);
        setOpen(true);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(profile) {
    navigate(ROUTES.USER_PROFILE(profile.id));
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full h-10 bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[rgb(var(--ds-primary-rgb))] transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 w-4 h-4 text-gray-500 animate-spin pointer-events-none" />
        )}
        {!loading && query && (
          <button onClick={handleClear} className="absolute right-3 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 last:border-0"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{profile.display_name}</p>
                {profile.public_user_id && (
                  <p className="text-gray-500 text-xs font-mono">#{profile.public_user_id}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50">
          <div className="px-4 py-3 text-gray-500 text-sm text-center">No players found.</div>
        </div>
      )}
    </div>
  );
}