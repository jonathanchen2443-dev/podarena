import React from "react";
import { Lock, List, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

/**
 * DeckListTab — placeholder / status states for the DECK LIST tab.
 *
 * States:
 *   - private + not owner → privacy lock message
 *   - importing in progress → loading indicator
 *   - failed / unsupported_source → error message
 *   - no imported data yet → placeholder with call-to-action hint for owner
 *   - imported → future card-list UI (renders nothing until Prompt 2)
 *
 * Props:
 *   isOwner              – boolean
 *   showDeckListPublicly – boolean
 *   importStatus         – string: not_imported | importing | imported | failed | unsupported_source
 *   lastSyncedAt         – ISO string or null
 *   cardCount            – number or null
 */
export default function DeckListTab({
  isOwner,
  showDeckListPublicly,
  importStatus = 'not_imported',
  lastSyncedAt = null,
  cardCount = null,
}) {
  const isPrivateForViewer = !isOwner && !showDeckListPublicly;

  if (isPrivateForViewer) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)" }}>
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

  if (importStatus === 'importing') {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse"
          style={{ background: "rgba(92,124,250,0.10)" }}>
          <Clock className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Importing deck list…</p>
          <p className="text-gray-500 text-xs mt-1.5">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (importStatus === 'failed') {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.10)" }}>
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Import failed</p>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[240px]">
            {isOwner
              ? "Something went wrong importing the deck list. Try refreshing below."
              : "The deck list could not be imported from the external source."}
          </p>
        </div>
      </div>
    );
  }

  if (importStatus === 'unsupported_source') {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(251,191,36,0.08)" }}>
          <AlertCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Source not yet supported</p>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[240px]">
            The deck link is saved and valid, but automatic import isn't available for this source yet.
          </p>
        </div>
      </div>
    );
  }

  if (importStatus === 'imported' && cardCount > 0) {
    // Deck list data exists — show minimal "imported" confirmation until Prompt 2 UI
    const syncLabel = lastSyncedAt
      ? `Last synced ${format(parseISO(lastSyncedAt), "MMM d, yyyy")}`
      : null;
    return (
      <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(47,158,68,0.12)" }}>
          <List className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{cardCount} cards imported</p>
          {syncLabel && <p className="text-gray-600 text-xs mt-1">{syncLabel}</p>}
          <p className="text-gray-600 text-xs mt-1.5 leading-relaxed max-w-[240px]">
            Full card-list view coming soon. {isOwner ? "Use Refresh to re-sync." : ""}
          </p>
        </div>
      </div>
    );
  }

  // Default: not_imported
  return (
    <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-4"
      style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.05)" }}>
        <List className="w-5 h-5 text-gray-500" />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">No deck list yet</p>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed max-w-[240px]">
          {isOwner
            ? "Add a deck link and use the Import button to bring in your card list."
            : "Deck list will appear here once the owner imports it."}
        </p>
      </div>
    </div>
  );
}