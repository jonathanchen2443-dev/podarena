/**
 * Step 2 — Rankings & Deck
 *
 * Participants are already chosen in Step 1.
 * This step focuses on:
 *  - Your deck selection
 *  - Ranking / placement of the selected participants
 */
import React, { useState, useMemo } from "react";
import { Search, User, X } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">{children}</p>
  );
}

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ── Deck tile ─────────────────────────────────────────────────────────────────
function DeckTile({ deck, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-all"
      style={
        selected
          ? { backgroundColor: "rgba(var(--ds-primary-rgb),0.14)", border: "1px solid rgba(var(--ds-primary-rgb),0.45)" }
          : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
      }
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
        style={{ border: selected ? "1px solid rgba(var(--ds-primary-rgb),0.35)" : "1px solid rgba(255,255,255,0.08)" }}>
        {deck.commander_image_url ? (
          <img src={deck.commander_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <span className="text-gray-600 text-xs">?</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-none" style={{ color: selected ? "var(--ds-primary-text)" : "#e5e7eb" }}>
          {deck.commander_name || deck.name}
        </p>
        {deck.commander_name && deck.name !== deck.commander_name && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5">{deck.name}</p>
        )}
        <div className="mt-1">
          <ManaPipRow colors={deck.color_identity || []} size={11} gap={2} />
        </div>
      </div>
      {selected && (
        <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "rgb(var(--ds-primary-rgb))" }}>
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

// ── My deck selector ──────────────────────────────────────────────────────────
function MyDeckSelector({ decks, value, onChange }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks.slice(0, 3);
    return decks.filter((d) =>
      d.name?.toLowerCase().includes(q) || d.commander_name?.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [decks, query]);

  if (decks.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-3 text-gray-600 text-xs italic"
        style={{ background: "rgba(var(--ds-primary-rgb),0.04)", border: "1px solid rgba(var(--ds-primary-rgb),0.12)" }}>
        No active decks — deck won't be tracked.
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 space-y-2"
      style={{ background: "rgba(var(--ds-primary-rgb),0.05)", border: "1px solid rgba(var(--ds-primary-rgb),0.15)" }}>
      <FieldLabel>Your deck for this game</FieldLabel>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decks…"
          className="w-full pl-8 pr-3 py-2 text-sm text-white rounded-xl focus:outline-none"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(var(--ds-primary-rgb),0.18)", colorScheme: "dark" }}
        />
      </div>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all"
          style={
            !value
              ? { background: "rgba(var(--ds-primary-rgb),0.1)", border: "1px solid rgba(var(--ds-primary-rgb),0.3)", color: "var(--ds-primary-text)" }
              : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#6b7280" }
          }
        >
          No deck / not tracked
        </button>
        {filtered.map((deck) => (
          <DeckTile
            key={deck.id}
            deck={deck}
            selected={value === deck.id}
            onClick={() => onChange(deck.id === value ? null : deck.id)}
          />
        ))}
        {decks.length > 3 && !query && (
          <p className="text-center text-gray-700 text-[11px]">Search to find more decks</p>
        )}
        {filtered.length === 0 && query && (
          <p className="text-center text-gray-700 text-xs py-1">No decks match "{query}"</p>
        )}
      </div>
    </div>
  );
}

// ── Participant pill (tap-to-place) ───────────────────────────────────────────
function ParticipantPill({ profile, isYou, isPlaced, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all flex-shrink-0"
      style={
        isPlaced
          ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", opacity: 0.45 }
          : isYou
          ? { background: "rgba(var(--ds-primary-rgb),0.14)", border: "1px solid rgba(var(--ds-primary-rgb),0.40)" }
          : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }
      }
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.1)" }}>
          <User className="w-3 h-3 text-gray-500" />
        </div>
      )}
      <span className="text-xs font-semibold leading-none whitespace-nowrap"
        style={{ color: isPlaced ? "#6b7280" : isYou ? "var(--ds-primary-text)" : "#e5e7eb" }}>
        {isYou ? "You" : formatName(profile.display_name)}
      </span>
    </button>
  );
}

// ── Rank slot ─────────────────────────────────────────────────────────────────
const RANK_CONFIG = {
  1: { label: "1st", medal: "🥇", glow: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.35)", text: "#fbbf24", emptyBg: "rgba(251,191,36,0.05)" },
  2: { label: "2nd", medal: "🥈", glow: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.30)", text: "#9ca3af", emptyBg: "rgba(156,163,175,0.04)" },
  3: { label: "3rd", medal: "🥉", glow: "rgba(217,119,6,0.12)", border: "rgba(217,119,6,0.28)", text: "#d97706", emptyBg: "rgba(217,119,6,0.04)" },
};
function getRankConfig(rank) {
  return RANK_CONFIG[rank] || { label: `${rank}th`, medal: null, glow: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#6b7280", emptyBg: "rgba(255,255,255,0.02)" };
}

function RankSlot({ rank, occupant, onClear, isYou }) {
  const cfg = getRankConfig(rank);
  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: occupant ? cfg.glow : cfg.emptyBg,
        border: `1px solid ${occupant ? cfg.border : "rgba(255,255,255,0.07)"}`,
        boxShadow: occupant && rank <= 3 ? `0 0 12px ${cfg.glow}` : "none",
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 text-center">
          {cfg.medal ? (
            <span className="text-lg leading-none">{cfg.medal}</span>
          ) : (
            <span className="text-sm font-bold" style={{ color: cfg.text }}>{cfg.label}</span>
          )}
        </div>
        {occupant ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {occupant.avatar_url ? (
              <img src={occupant.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                <User className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
            <span className="text-sm font-semibold truncate" style={{ color: cfg.text !== "#6b7280" ? cfg.text : "#e5e7eb" }}>
              {isYou ? "You" : formatName(occupant.display_name)}
              {isYou && <span className="text-gray-600 text-xs ml-1">(you)</span>}
            </span>
          </div>
        ) : (
          <div className="flex-1">
            <span className="text-xs text-gray-700 italic">empty — tap a player to fill</span>
          </div>
        )}
        {occupant && (
          <button
            type="button"
            onClick={onClear}
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main step component ───────────────────────────────────────────────────────
export default function WizardStep2Players({
  participants,
  memberData,
  placements,
  currentUser,
  myDecks,
  myDeckId,
  onMyDeckChange,
  onPlacementChange,
}) {
  // Rank slots derived from participant count
  const rankSlots = Array.from({ length: participants.length }, (_, i) => i + 1);

  // Occupant map: rank → profileId
  const occupantByRank = useMemo(() => {
    const map = {};
    Object.entries(placements).forEach(([pid, rank]) => { if (rank) map[rank] = pid; });
    return map;
  }, [placements]);

  function nearestFreeRank() {
    for (const rank of rankSlots) {
      if (!occupantByRank[rank]) return rank;
    }
    return null;
  }

  function handlePillClick(profileId) {
    const currentRank = placements[profileId];
    if (currentRank) {
      onPlacementChange(profileId, null);
    } else {
      const free = nearestFreeRank();
      if (free !== null) onPlacementChange(profileId, free);
    }
  }

  function handleClearSlot(rank) {
    const pid = occupantByRank[rank];
    if (pid) onPlacementChange(pid, null);
  }

  const pillProfiles = useMemo(() => {
    const sorted = [...participants].sort((a) => (a === currentUser?.id ? -1 : 1));
    return sorted.map((id) => ({
      profileId: id,
      display_name: memberData[id]?.display_name || id,
      avatar_url: memberData[id]?.avatar_url || null,
      isYou: id === currentUser?.id,
    }));
  }, [participants, memberData, currentUser?.id]);

  return (
    <div className="space-y-5 pt-2">

      {/* ── Your deck ─────────────────────────────────────────────────────── */}
      <MyDeckSelector decks={myDecks} value={myDeckId} onChange={onMyDeckChange} />

      {/* ── Tap-to-place pills ─────────────────────────────────────────────── */}
      <div>
        <FieldLabel>Tap player to place into ranking</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {pillProfiles.map((p) => (
            <ParticipantPill
              key={p.profileId}
              profile={p}
              isYou={p.isYou}
              isPlaced={!!placements[p.profileId]}
              onClick={() => handlePillClick(p.profileId)}
            />
          ))}
        </div>
      </div>

      {/* ── Rank slots ────────────────────────────────────────────────────── */}
      <div>
        <FieldLabel>Final Rankings</FieldLabel>
        <div className="space-y-2">
          {rankSlots.map((rank) => {
            const pid = occupantByRank[rank];
            const occupant = pid ? memberData[pid] : null;
            const isYou = pid === currentUser?.id;
            return (
              <RankSlot
                key={rank}
                rank={rank}
                occupant={occupant ? { ...occupant } : null}
                isYou={isYou}
                onClear={() => handleClearSlot(rank)}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}