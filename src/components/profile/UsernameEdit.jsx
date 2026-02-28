import React, { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * UsernameEdit — inline username edit with uniqueness + min-length validation.
 * Props: profile, onSaved(newUsername)
 */
export default function UsernameEdit({ profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile?.username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function startEdit() {
    setValue(profile?.username || "");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    if (saving) return;
    const trimmed = value.trim();

    // Min length check
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    const lc = trimmed.toLowerCase();

    setSaving(true);
    setError(null);

    try {
      // Uniqueness check: look for any profile with same username_lc
      const existing = await base44.entities.Profile.filter({ username_lc: lc });
      const conflict = existing.find((p) => p.id !== profile.id);
      if (conflict) {
        setError("Username already taken. Please choose another.");
        setSaving(false);
        return;
      }

      await base44.entities.Profile.update(profile.id, {
        username: trimmed,
        username_lc: lc,
      });

      onSaved?.(trimmed);
      setEditing(false);
      toast.success("Username updated!");
    } catch (err) {
      setError("Failed to save username. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const displayUsername = profile?.username || null;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {displayUsername ? (
          <span className="text-gray-400 text-sm">@{displayUsername}</span>
        ) : (
          <span className="text-gray-600 text-sm italic">No username set</span>
        )}
        <button
          onClick={startEdit}
          className="p-1 rounded-md text-gray-600 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
          title="Edit username"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-0.5">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
          maxLength={30}
          autoFocus
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors min-w-0"
          placeholder="your_username"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
          title="Save"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={cancelEdit}
          disabled={saving}
          className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p className="text-red-400 text-xs pl-4">{error}</p>}
    </div>
  );
}