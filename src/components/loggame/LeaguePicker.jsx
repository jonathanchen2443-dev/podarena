import React from "react";
import { Globe, Lock, ChevronDown } from "lucide-react";

export default function LeaguePicker({ leagues, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        League <span className="text-red-400">*</span>
      </label>
      <div className="relative">
        <select
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full appearance-none bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select a league…</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
      {value && (
        <div className="flex items-center gap-1.5 mt-1.5 px-1">
          {leagues.find((l) => l.id === value)?.is_public ? (
            <><Globe className="w-3 h-3 text-gray-500" /><span className="text-xs text-gray-500">Public league</span></>
          ) : (
            <><Lock className="w-3 h-3 text-gray-500" /><span className="text-xs text-gray-500">Private league</span></>
          )}
        </div>
      )}
    </div>
  );
}