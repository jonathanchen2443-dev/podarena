import React from "react";
import { Star, X } from "lucide-react";
import ManaPip from "@/components/mtg/ManaPip";

const ALL_COLORS = ["W", "U", "B", "R", "G", "C"];

export default function DeckFilters({ filters, onChange, totalCount }) {
  function toggleColor(c) {
    const next = filters.colors.includes(c)
      ? filters.colors.filter((x) => x !== c)
      : [...filters.colors, c];
    onChange({ ...filters, colors: next });
  }

  return (
    <div className="space-y-2.5">
      {/* Row 1: Favorites + Active/Retired */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Favorites toggle */}
        <button
          onClick={() => onChange({ ...filters, favOnly: !filters.favOnly })}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-medium transition-colors ${
            filters.favOnly
              ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
              : "bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${filters.favOnly ? "fill-amber-400 text-amber-400" : ""}`} />
          Favorites
        </button>

        {/* Active / All / Retired */}
        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "retired", label: "Retired" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, status: opt.value })}
              className={`h-8 px-3 text-xs font-medium transition-colors ${
                filters.status === opt.value
                  ? "ds-accent-bg"
                  : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Color pips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">Colors</span>
        <div className="flex items-center gap-1.5">
          {ALL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => toggleColor(c)}
              className={`rounded-full transition-all ${
                filters.colors.includes(c)
                  ? "ring-2 ring-white/60 scale-110"
                  : "opacity-50 hover:opacity-80"
              }`}
              title={c}
            >
              <ManaPip symbol={c} size={20} />
            </button>
          ))}
        </div>
        {filters.colors.length > 0 && (
          <button
            onClick={() => onChange({ ...filters, colors: [] })}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-[10px] transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Count label */}
      <p className="text-gray-500 text-[11px]">{totalCount} {totalCount === 1 ? "deck" : "decks"}</p>
    </div>
  );
}