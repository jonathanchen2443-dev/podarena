import React, { useState, useRef, useEffect } from "react";
import { User, ChevronDown } from "lucide-react";

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const PLACE_LABELS = {
  1: "1st place",
  2: "2nd place",
  3: "3rd place",
  4: "4th place",
  5: "5th place",
  6: "6th place",
};

const DARK_SELECT_BASE = {
  colorScheme: "dark",
  backgroundColor: "transparent",
};

// ── Custom deck dropdown — width-constrained, aligned, truncating ─────────────
function DeckDropdown({ decks, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = decks.find((d) => d.id === value) || null;
  const selectedLabel = selected
    ? `${selected.name}${selected.commander_name ? ` — ${selected.commander_name}` : ""}`
    : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(id) {
    onChange(id || null);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 text-sm focus:outline-none"
        style={{ color: value ? "#e5e7eb" : "#6b7280" }}
      >
        <span className="flex-1 min-w-0 text-left truncate">
          {selectedLabel || "No deck / not tracked"}
        </span>
        <ChevronDown
          className="flex-shrink-0 w-3 h-3 text-gray-600 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown panel — full width of container, positioned below */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden border"
          style={{
            backgroundColor: "#1a1f2e",
            borderColor: "rgba(var(--ds-primary-rgb),0.25)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          <div className="max-h-48 overflow-y-auto">
            {/* No deck option */}
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="w-full text-left px-3 py-2.5 text-sm truncate transition-colors hover:bg-white/5"
              style={{ color: !value ? "var(--ds-primary-text)" : "#9ca3af" }}
            >
              No deck / not tracked
            </button>
            {decks.map((d) => {
              const label = `${d.name}${d.commander_name ? ` — ${d.commander_name}` : ""}`;
              const isSelected = d.id === value;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSelect(d.id)}
                  className="w-full text-left px-3 py-2.5 text-sm truncate transition-colors hover:bg-white/5"
                  style={{ color: isSelected ? "var(--ds-primary-text)" : "#e5e7eb" }}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParticipantSetupCard({
  uid,
  member,
  isCurrentUser,
  placement,
  participantCount,
  usedPlacements,
  onPlacementChange,
  myDecks,
  selectedDeckId,
  onDeckChange,
}) {
  const displayName = member?.display_name || uid;
  const avatarUrl = member?.avatar_url || null;
  const hasPlacement = !!placement;

  const placementOptions = Array.from({ length: participantCount }, (_, i) => i + 1).filter(
    (place) => !usedPlacements.has(place) || Number(placement) === place
  );

  return (
    <div
      className="rounded-2xl border transition-all overflow-visible"
      style={{
        backgroundColor: isCurrentUser ? "rgba(var(--ds-primary-rgb),0.06)" : "rgba(255,255,255,0.03)",
        borderColor: isCurrentUser
          ? "rgba(var(--ds-primary-rgb),0.25)"
          : hasPlacement
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-9 h-9 rounded-xl object-cover border"
              style={{ borderColor: isCurrentUser ? "rgba(var(--ds-primary-rgb),0.3)" : "rgba(255,255,255,0.1)" }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: isCurrentUser ? "rgba(var(--ds-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${isCurrentUser ? "rgba(var(--ds-primary-rgb),0.25)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <User className="w-4 h-4" style={{ color: isCurrentUser ? "var(--ds-primary-text)" : "#6b7280" }} />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-none">
            {formatName(displayName)}
          </p>
          {isCurrentUser && (
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-primary-text)", opacity: 0.7 }}>
              You
            </p>
          )}
        </div>

        {/* Placement selector — native select, options are short so native is fine here */}
        <div className="relative flex-shrink-0">
          <select
            value={placement}
            onChange={(e) => onPlacementChange(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none text-sm font-semibold rounded-xl px-3 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] transition-colors"
            style={{
              ...DARK_SELECT_BASE,
              backgroundColor: hasPlacement ? "rgba(var(--ds-primary-rgb),0.18)" : "rgba(255,255,255,0.06)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: hasPlacement ? "rgba(var(--ds-primary-rgb),0.40)" : "rgba(255,255,255,0.10)",
              color: hasPlacement ? "var(--ds-primary-text)" : "#6b7280",
            }}
          >
            <option value="" style={{ backgroundColor: "#1a1f2e", color: "#9ca3af" }}>Place…</option>
            {placementOptions.map((place) => (
              <option key={place} value={place} style={{ backgroundColor: "#1a1f2e", color: "#f3f4f6" }}>
                {PLACE_LABELS[place] || `${place}th`}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
            style={{ color: hasPlacement ? "var(--ds-primary-text)" : "#6b7280" }}
          />
        </div>
      </div>

      {/* Deck row — only for current user, custom dropdown */}
      {isCurrentUser && myDecks.length > 0 && (
        <div className="px-4 pb-3">
          <div
            className="rounded-xl border flex items-center gap-2 px-3 py-2"
            style={{
              backgroundColor: "rgba(0,0,0,0.25)",
              borderColor: "rgba(var(--ds-primary-rgb),0.18)",
            }}
          >
            <span className="text-xs text-gray-500 flex-shrink-0 font-medium w-8">Deck</span>
            <DeckDropdown
              decks={myDecks}
              value={selectedDeckId}
              onChange={onDeckChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}