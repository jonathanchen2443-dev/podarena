import React from "react";
import { X, User } from "lucide-react";

export default function ParticipantPicker({
  members,
  selectedIds,
  onAdd,
  onRemove,
  currentUserId,
  membersLoading,
}) {
  const unselected = members.filter((m) => !selectedIds.includes(m.userId));

  function handleSelect(e) {
    const uid = e.target.value;
    if (!uid) return;
    onAdd(uid);
    e.target.value = "";
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
          onClick={() => onAdd(currentUserId)}
          className="mb-2 flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
          style={{ color: "var(--ds-primary-text)" }}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add me
        </button>
      )}

      {/* Dropdown to add others */}
      {membersLoading ? (
        <div className="text-xs text-gray-500 py-2">Loading members…</div>
      ) : (
        <select
          onChange={handleSelect}
          defaultValue=""
          disabled={unselected.length === 0}
          className="w-full appearance-none bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] disabled:opacity-50"
        >
          <option value="">Add a participant…</option>
          {unselected.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.display_name}{m.userId === currentUserId ? " (you)" : ""}
            </option>
          ))}
        </select>
      )}

      {/* Selected list */}
      {selectedIds.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedIds.map((uid) => {
            const member = members.find((m) => m.userId === uid);
            return (
              <div
                key={uid}
                className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2"
              >
                {member?.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" style={{ color: "var(--ds-primary-text)" }} />
                  </div>
                )}
                <span className="flex-1 text-sm text-white truncate">
                  {member?.display_name || uid}
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