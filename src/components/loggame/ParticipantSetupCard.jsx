import React from "react";
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

// Shared dark select style — makes native browser dropdown render dark
const DARK_SELECT_BASE = {
  colorScheme: "dark",
  backgroundColor: "transparent",
};

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

  // Build placement options: show current user's own selection even if in usedPlacements,
  // hide options taken by others entirely (cleaner than disabled grey).
  const placementOptions = Array.from({ length: participantCount }, (_, i) => i + 1).filter(
    (place) => !usedPlacements.has(place) || Number(placement) === place
  );

  return (
    <div
      className="rounded-2xl border transition-all overflow-hidden"
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

        {/* Placement selector */}
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

      {/* Deck row — only for current user */}
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
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedDeckId}
                onChange={(e) => onDeckChange(e.target.value || null)}
                className="w-full appearance-none text-sm focus:outline-none pr-5 bg-transparent"
                style={{
                  ...DARK_SELECT_BASE,
                  color: selectedDeckId ? "#e5e7eb" : "#6b7280",
                  // Ensure native popup width matches the visible field
                  minWidth: 0,
                }}
              >
                <option value="" style={{ backgroundColor: "#1a1f2e", color: "#9ca3af" }}>No deck / not tracked</option>
                {myDecks.map((d) => (
                  <option key={d.id} value={d.id} style={{ backgroundColor: "#1a1f2e", color: "#f3f4f6" }}>
                    {d.name}{d.commander_name ? ` — ${d.commander_name}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}