import React, { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * DisplayNameEdit — inline edit for Profile.display_name with uniqueness check.
 * Props:
 *   profile       – current profile record
 *   onSaved(name) – called after successful save
 */
export default function DisplayNameEdit({ profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setValue(profile?.display_name || "");
    setError("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError("");
  }

  async function save() {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const lc = trimmed.toLowerCase();
      // Uniqueness check: find profiles with same display_name_lc
      const matches = await base44.entities.Profile.filter({ display_name_lc: lc });
      const conflict = matches.find((p) => p.id !== profile.id);
      if (conflict) {
        setError("Name already taken. Choose another.");
        setSaving(false);
        return;
      }
      await base44.entities.Profile.update(profile.id, {
        display_name: trimmed,
        display_name_lc: lc,
      });
      toast.success("Display name updated!");
      onSaved(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="flex items-center gap-1.5 text-gray-500 hover:text-violet-400 text-xs transition-colors group mt-0.5"
        title="Edit display name"
      >
        <Pencil className="w-3 h-3 group-hover:text-violet-400" />
        Edit name
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 h-8 px-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-violet-500 min-w-0"
          maxLength={40}
          disabled={saving}
        />
        <button
          onClick={save}
          disabled={saving}
          className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-300" />
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}