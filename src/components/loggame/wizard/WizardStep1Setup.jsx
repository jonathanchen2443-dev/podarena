/**
 * Step 1 — Game Setup + Participant Selection
 *
 * - Game type (Casual / POD)
 * - POD selection (pod mode)
 * - Participant selection (both modes) — count is derived from selection
 * - Format (locked to Commander)
 * - Date & time
 * - Notes
 */
import React, { useState, useEffect, useRef } from "react";
import { Layers, Search, User, X, Loader2 } from "lucide-react";
import PodSearchPicker from "@/components/loggame/PodSearchPicker";
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

function PodChip({ pod, locked, onClear }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        <Layers className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{pod.pod_name}</p>
        <p className="text-xs font-mono text-violet-400/60">{pod.pod_code}</p>
      </div>
      {locked ? (
        <span className="text-[10px] text-gray-600 px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}>Locked</span>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 px-1"
        >
          Change
        </button>
      )}
    </div>
  );
}

// ── Casual participant search ──────────────────────────────────────────────────
function CasualParticipantSection({ participants, memberData, currentUser, onAdd, onRemove }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'searchProfilesForGameLog',
          searchQuery: q,
        });
        const profiles = (res.data?.profiles || []).filter(
          (p) => !participants.includes(p.id) && p.id !== currentUser?.id
        );
        setResults(profiles.slice(0, 5));
      } catch (_) {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, participants, currentUser?.id]);

  const atMax = participants.length >= 8;

  return (
    <div className="space-y-3">
      {/* Selected participants */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map((id) => {
            const p = memberData[id] || {};
            const isYou = id === currentUser?.id;
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={
                  isYou
                    ? { background: "rgba(var(--ds-primary-rgb),0.14)", border: "1px solid rgba(var(--ds-primary-rgb),0.40)", color: "var(--ds-primary-text)" }
                    : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb" }
                }
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.1)" }}>
                    <User className="w-2.5 h-2.5 text-gray-500" />
                  </div>
                )}
                <span className="whitespace-nowrap">{isYou ? "You" : formatName(p.display_name)}</span>
                {!isYou && (
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {!atMax && (
        <div className="space-y-1">
          <div className="relative">
            {searching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 animate-spin pointer-events-none" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add player by name…"
              className="w-full pl-8 pr-3 py-2.5 text-sm text-white rounded-xl focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
            />
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
                  {p.username && <span className="text-gray-500 text-xs">@{p.username}</span>}
                </button>
              ))}
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && !searching && (
            <p className="text-gray-700 text-xs px-1">No users found.</p>
          )}
        </div>
      )}
      {atMax && (
        <p className="text-gray-600 text-xs">Maximum 8 participants reached.</p>
      )}
    </div>
  );
}

// ── POD participant section ────────────────────────────────────────────────────
function PodParticipantSection({ participants, memberData, podMembers, podMembersLoading, currentUser, onAdd, onRemove }) {
  const unselected = podMembers.filter((m) => !participants.includes(m.userId));

  return (
    <div className="space-y-3">
      {/* Selected participant pills */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map((id) => {
            const p = memberData[id] || {};
            const isYou = id === currentUser?.id;
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={
                  isYou
                    ? { background: "rgba(var(--ds-primary-rgb),0.14)", border: "1px solid rgba(var(--ds-primary-rgb),0.40)", color: "var(--ds-primary-text)" }
                    : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb" }
                }
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.1)" }}>
                    <User className="w-2.5 h-2.5 text-gray-500" />
                  </div>
                )}
                <span className="whitespace-nowrap">{isYou ? "You" : formatName(p.display_name)}</span>
                {!isYou && (
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Available POD members to add */}
      {podMembersLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-1">
          <div className="w-4 h-4 border border-gray-600 border-t-white rounded-full animate-spin" />
          Loading members…
        </div>
      ) : unselected.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-600 mb-1.5">Add from POD</p>
          <div className="flex flex-wrap gap-2">
            {unselected.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => onAdd(m.userId)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#9ca3af" }}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="w-2.5 h-2.5 text-gray-500" />
                  </div>
                )}
                {formatName(m.display_name)}
              </button>
            ))}
          </div>
        </div>
      ) : participants.length > 0 && unselected.length === 0 ? (
        <p className="text-gray-600 text-xs">All POD members added.</p>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WizardStep1Setup({
  mode,
  lockedPodMode,
  pod,
  podLoading,
  podMembers,
  podMembersLoading,
  authUserId,
  profileId,
  participants,
  memberData,
  currentUser,
  playedAt,
  notes,
  onModeSwitch,
  onPodSelected,
  onClearPod,
  onAddPodParticipant,
  onRemovePodParticipant,
  onAddCasualParticipant,
  onRemoveCasualParticipant,
  onPlayedAtChange,
  onNotesChange,
}) {
  return (
    <div className="space-y-5 pt-2">

      {/* Game Type */}
      {!lockedPodMode && (
        <div>
          <FieldLabel>Game Type</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {["Casual", "POD"].map((label) => {
              const val = label.toLowerCase();
              const active = mode === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onModeSwitch(val)}
                  className="rounded-xl py-3.5 text-sm font-bold transition-all"
                  style={
                    active
                      ? { backgroundColor: "rgba(var(--ds-primary-rgb),0.12)", border: "1px solid rgb(var(--ds-primary-rgb))", color: "var(--ds-primary-text)" }
                      : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* POD selection */}
      {mode === "pod" && (
        <div>
          <FieldLabel>POD</FieldLabel>
          {podLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
              Loading POD…
            </div>
          ) : pod ? (
            <PodChip pod={pod} locked={lockedPodMode} onClear={onClearPod} />
          ) : (
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <PodSearchPicker
                authUserId={authUserId}
                profileId={profileId}
                onSelect={onPodSelected}
              />
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      {(mode === "casual" || (mode === "pod" && pod)) && (
        <div>
          <FieldLabel>
            Players{" "}
            <span className="normal-case font-normal text-gray-700">
              {participants.length > 0 ? `(${participants.length} selected)` : "(min. 2)"}
            </span>
          </FieldLabel>
          {mode === "casual" ? (
            <CasualParticipantSection
              participants={participants}
              memberData={memberData}
              currentUser={currentUser}
              onAdd={onAddCasualParticipant}
              onRemove={onRemoveCasualParticipant}
            />
          ) : (
            <PodParticipantSection
              participants={participants}
              memberData={memberData}
              podMembers={podMembers}
              podMembersLoading={podMembersLoading}
              currentUser={currentUser}
              onAdd={onAddPodParticipant}
              onRemove={onRemovePodParticipant}
            />
          )}
        </div>
      )}

      {/* Format — Commander, locked */}
      <div>
        <FieldLabel>Format</FieldLabel>
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-sm font-semibold text-white">Commander</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280" }}
          >
            Only format
          </span>
        </div>
      </div>

      {/* Date & time */}
      <div>
        <FieldLabel>Date &amp; Time</FieldLabel>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(e) => onPlayedAtChange(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            colorScheme: "dark",
          }}
        />
      </div>

      {/* Notes */}
      <div>
        <FieldLabel>Notes <span className="normal-case font-normal text-gray-700">(optional)</span></FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="Anything worth remembering…"
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] resize-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        />
      </div>

    </div>
  );
}