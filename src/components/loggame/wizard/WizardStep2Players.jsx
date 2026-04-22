/**
 * Step 2 — Players & Results (corrected)
 *
 * Deck selection: search + up to 3 deck tiles (rich visual, not dropdown)
 * Participants: pill-based, click to auto-place into nearest free slot
 * Placements: visual ranking slots, click placed player to return to pool
 * No manual dropdown assignment as primary UX
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, User, X } from "lucide-react";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { base44 } from "@/api/base44Client";

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

// ── Deck tile — commander image, name, mana pips ──────────────────────────────
function DeckTile({ deck, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-all"
      style={
        selected
          ? {
              backgroundColor: "rgba(var(--ds-primary-rgb),0.14)",
              border: "1px solid rgba(var(--ds-primary-rgb),0.45)",
            }
          : {
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }
      }
    >
      {/* Commander image */}
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
      {/* Info */}
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

// ── My deck selector — search + up to 3 deck tiles ───────────────────────────
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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decks…"
          className="w-full pl-8 pr-3 py-2 text-sm text-white rounded-xl focus:outline-none"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(var(--ds-primary-rgb),0.18)",
            colorScheme: "dark",
          }}
        />
      </div>
      {/* Deck tiles */}
      <div className="space-y-1.5">
        {/* "No deck" option */}
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

// ── Participant pill ──────────────────────────────────────────────────────────
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

// Casual search pill pool
function CasualSearchPool({ selectedIds, memberData, currentUser, onAdd, onRemove }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'searchProfilesForGameLog',
          searchQuery: q,
        });
        const profiles = (res.data?.profiles || []).filter(
          (p) => !selectedIds.includes(p.id) && p.id !== currentUser?.id
        );
        setResults(profiles.slice(0, 5));
      } catch (_) {} finally {
        setSearching(false);
      }
    }, 300);
  }, [query, selectedIds, currentUser?.id]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add player by name…"
          className="w-full pl-8 pr-3 py-2.5 text-sm text-white rounded-xl focus:outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border border-gray-600 border-t-white rounded-full animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: "#1a1f2e" }}>
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onAdd(p.id, { profileId: p.id, authUserId: p.user_id || null, display_name: p.display_name, avatar_url: p.avatar_url || null });
                setQuery("");
                setResults([]);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="w-3 h-3 text-gray-500" />
                </div>
              )}
              <span className="text-gray-200 truncate">{p.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rank slot — visual placement box by rank ──────────────────────────────────
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
        {/* Rank badge */}
        <div className="flex-shrink-0 w-8 text-center">
          {cfg.medal ? (
            <span className="text-lg leading-none">{cfg.medal}</span>
          ) : (
            <span className="text-sm font-bold" style={{ color: cfg.text }}>{cfg.label}</span>
          )}
        </div>
        {/* Occupant or empty */}
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
        {/* Clear button */}
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
  mode,
  pod,
  podMembers,
  podMembersLoading,
  participants,
  memberData,
  placements,
  participantCount,
  currentUser,
  myDecks,
  myDeckId,
  onMyDeckChange,
  onAddPodParticipant,
  onRemovePodParticipant,
  onAddCasualParticipant,
  onRemoveCasualParticipant,
  onPlacementChange,
}) {
  // Build reverse map: profileId → placement rank
  const placementByProfile = placements; // { profileId: rank }

  // All rank slots from 1 to participantCount
  const rankSlots = Array.from({ length: participantCount }, (_, i) => i + 1);

  // Occupant map: rank → profileId
  const occupantByRank = useMemo(() => {
    const map = {};
    Object.entries(placements).forEach(([pid, rank]) => { if (rank) map[rank] = pid; });
    return map;
  }, [placements]);

  // Find nearest free slot
  function nearestFreeRank() {
    for (const rank of rankSlots) {
      if (!occupantByRank[rank]) return rank;
    }
    return null;
  }

  // Click pill → auto-place into nearest free slot
  function handlePillClick(profileId) {
    const currentRank = placementByProfile[profileId];
    if (currentRank) {
      // Already placed → remove from slot (return to pool)
      onPlacementChange(profileId, null);
    } else {
      const free = nearestFreeRank();
      if (free !== null) {
        onPlacementChange(profileId, free);
      }
    }
  }

  // Clear a rank slot
  function handleClearSlot(rank) {
    const pid = occupantByRank[rank];
    if (pid) onPlacementChange(pid, null);
  }

  // Available pill profiles (all participants, YOU first)
  const pillProfiles = useMemo(() => {
    const sorted = [...participants].sort((a) => (a === currentUser?.id ? -1 : 1));
    return sorted.map((id) => ({
      profileId: id,
      display_name: memberData[id]?.display_name || id,
      avatar_url: memberData[id]?.avatar_url || null,
      isYou: id === currentUser?.id,
    }));
  }, [participants, memberData, currentUser?.id]);

  // Pod participant pool for display (unselected members)
  const unselectedPodMembers = useMemo(() => {
    if (mode !== "pod") return [];
    return podMembers.filter((m) => !participants.includes(m.userId));
  }, [mode, podMembers, participants]);

  return (
    <div className="space-y-5 pt-2">

      {/* ── Your deck ─────────────────────────────────────────────────────── */}
      <MyDeckSelector decks={myDecks} value={myDeckId} onChange={onMyDeckChange} />

      {/* ── Participant picker ─────────────────────────────────────────────── */}
      <div>
        <FieldLabel>
          Add Players{" "}
          <span className="normal-case font-normal text-gray-700">
            ({participants.length}/{participantCount})
          </span>
        </FieldLabel>

        {mode === "casual" ? (
          <CasualSearchPool
            selectedIds={participants}
            memberData={memberData}
            currentUser={currentUser}
            onAdd={onAddCasualParticipant}
            onRemove={onRemoveCasualParticipant}
          />
        ) : podMembersLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
            <div className="w-4 h-4 border border-gray-600 border-t-white rounded-full animate-spin" />
            Loading members…
          </div>
        ) : (
          <div className="space-y-2">
            {unselectedPodMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {unselectedPodMembers.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => onAddPodParticipant(m.userId)}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all text-xs font-semibold"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                    {formatName(m.display_name)}
                  </button>
                ))}
              </div>
            )}
            {unselectedPodMembers.length === 0 && participants.length === 0 && (
              <p className="text-gray-700 text-xs italic">No POD members found.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Participants + tap-to-place pills ─────────────────────────────── */}
      {participants.length > 0 && (
        <div>
          <FieldLabel>Tap player to place into ranking</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {pillProfiles.map((p) => {
              const isPlaced = !!placementByProfile[p.profileId];
              return (
                <ParticipantPill
                  key={p.profileId}
                  profile={p}
                  isYou={p.isYou}
                  isPlaced={isPlaced}
                  onClick={() => handlePillClick(p.profileId)}
                />
              );
            })}
          </div>
          {/* Remove non-self */}
          {participants.filter((id) => id !== currentUser?.id).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {participants.filter((id) => id !== currentUser?.id).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => mode === "pod" ? onRemovePodParticipant(id) : onRemoveCasualParticipant(id)}
                  className="text-[10px] text-gray-700 hover:text-red-400 transition-colors"
                >
                  — remove {formatName(memberData[id]?.display_name)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
                occupant={occupant ? { ...occupant, display_name: occupant.display_name } : null}
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