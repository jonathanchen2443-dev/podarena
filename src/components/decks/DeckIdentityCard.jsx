/**
 * DeckIdentityCard — medium-sized identity preview shown inside the create/edit deck form.
 * Updates live as commander name, image, mana identity, and deck name change.
 */
import React from "react";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { Swords } from "lucide-react";

export default function DeckIdentityCard({ commanderName, commanderImageUrl, deckName, colorIdentity }) {
  const displayName = commanderName || "Your Commander";
  const hasImage = !!commanderImageUrl;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-700/60 bg-gray-900/80 flex gap-0 min-h-[112px]">
      {/* Commander art — left panel */}
      <div className="relative flex-shrink-0 w-24 h-28 bg-gray-800 overflow-hidden">
        {hasImage ? (
          <img
            src={commanderImageUrl}
            alt={commanderName}
            className="w-full h-full object-cover object-top"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Swords className="w-8 h-8 text-gray-700" />
          </div>
        )}
        {/* subtle gradient fade right */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-900/80 pointer-events-none" />
      </div>

      {/* Info — right panel */}
      <div className="flex flex-col justify-center gap-1.5 px-4 py-3 flex-1 min-w-0">
        {/* Format pill */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            Commander
          </span>
        </div>

        {/* Commander name */}
        <p className="text-white font-bold text-sm leading-tight truncate" title={displayName}>
          {displayName}
        </p>

        {/* Deck nickname (if set and different from commander) */}
        {deckName && deckName.trim() && deckName !== commanderName && (
          <p className="text-gray-400 text-xs truncate">{deckName}</p>
        )}

        {/* Mana pips */}
        {colorIdentity && colorIdentity.length > 0 ? (
          <ManaPipRow colors={colorIdentity} size={18} gap={2} />
        ) : (
          <p className="text-gray-600 text-[10px] italic">Color identity auto-filled from commander</p>
        )}
      </div>
    </div>
  );
}