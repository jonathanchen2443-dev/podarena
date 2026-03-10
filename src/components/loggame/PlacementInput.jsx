import React from "react";
import { User } from "lucide-react";

export default function PlacementInput({ participants, members, placements, onPlacementChange, myDecks, deckSelections, onDeckChange, currentUserProfileId, currentUserId }) {
  // Support both prop names for backwards compatibility
  const myId = currentUserProfileId || currentUserId;
  const usedPlacements = new Set(Object.values(placements).filter(Boolean).map(Number));

  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        Placements <span className="text-red-400">*</span>
      </label>
      <div className="space-y-2">
        {participants.map((uid) => {
          const member = members.find((m) => m.userId === uid);
          const currentPlacement = placements[uid] || "";
          const isCurrentUser = uid === myId;

          return (
            <div key={uid} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                {member?.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" style={{ color: "var(--ds-primary-text)" }} />
                  </div>
                )}
                <span className="flex-1 text-sm text-white truncate">
                  {member?.display_name || uid}
                  {isCurrentUser && <span className="text-gray-500 text-xs ml-1">(you)</span>}
                </span>
                <select
                  value={currentPlacement}
                  onChange={(e) => onPlacementChange(uid, e.target.value ? Number(e.target.value) : null)}
                  className="bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[rgb(var(--ds-primary-rgb))] w-24"
                >
                  <option value="">Place…</option>
                  {participants.map((_, i) => {
                    const place = i + 1;
                    const alreadyUsed = usedPlacements.has(place) && placements[uid] !== place;
                    return (
                      <option key={place} value={place} disabled={alreadyUsed}>
                        {place === 1 ? "🥇 1st" : place === 2 ? "🥈 2nd" : place === 3 ? "🥉 3rd" : `${place}th`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Deck selection — only for current user (v1) */}
              {isCurrentUser && myDecks.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-500 shrink-0">Deck:</span>
                  <select
                    value={deckSelections[uid] || ""}
                    onChange={(e) => onDeckChange(uid, e.target.value || null)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[rgb(var(--ds-primary-rgb))]"
                  >
                    <option value="">No deck / not tracked</option>
                    {myDecks.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.commander_name ? ` — ${d.commander_name}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}