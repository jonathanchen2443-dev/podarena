import React from "react";
import { Lock, List } from "lucide-react";

/**
 * DeckListTab — placeholder states for the DECK LIST tab.
 *
 * States:
 *   - private + not owner → privacy message
 *   - no imported data yet (owner or public-but-visible) → import placeholder
 *
 * Props:
 *   isOwner              – boolean: is the viewer the deck owner?
 *   showDeckListPublicly – boolean: deck owner's public visibility setting
 *   hasDeckListData      – boolean: does imported deck-list data exist? (false until import task)
 */
export default function DeckListTab({ isOwner, showDeckListPublicly, hasDeckListData = false }) {
  // Non-owner viewing a private deck list
  const isPrivateForViewer = !isOwner && !showDeckListPublicly;

  if (isPrivateForViewer) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <Lock className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Deck list is private</p>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[220px]">
            The deck owner has chosen to keep their deck list private.
          </p>
        </div>
      </div>
    );
  }

  if (!hasDeckListData) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <List className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">No deck list yet</p>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[240px]">
            Deck list will appear here once imported from the external deck source.
          </p>
        </div>
      </div>
    );
  }

  // Future: render actual deck list content here
  return null;
}