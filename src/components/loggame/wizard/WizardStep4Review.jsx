/**
 * Step 4 — Review & Submit
 * Shows a summary of all collected data. Edit links jump back to earlier steps.
 */
import React from "react";
import { Pencil, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PRAISE_META } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";

const PLACE_EMOJI = { 1: "🥇", 2: "🥈", 3: "🥉" };

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatDateDisplay(iso) {
  if (!iso) return "—";
  try { return format(new Date(iso.replace("T", " ")), "MMM d, yyyy · HH:mm"); } catch { return iso; }
}

function SectionCard({ title, onEdit, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
        >
          <Pencil className="w-2.5 h-2.5" />
          Edit
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function PlayerRow({ name, isYou, placement, avatarUrl }) {
  const emoji = PLACE_EMOJI[placement] || `${placement}.`;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-base w-6 text-center flex-shrink-0">{emoji}</span>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0border border-white/10" />
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
          <User className="w-3.5 h-3.5 text-gray-600" />
        </div>
      )}
      <span className="text-sm text-white flex-1 truncate font-medium">
        {formatName(name)}
        {isYou && <span className="text-gray-600 text-xs ml-1.5">(you)</span>}
      </span>
    </div>
  );
}

export default function WizardStep4Review({
  mode,
  pod,
  participants,
  memberData,
  placements,
  myDeckId,
  myDecks,
  playedAt,
  notes,
  praiseReceiver,
  praiseType,
  currentUser,
  onEditStep,
}) {
  // Sort participants by placement
  const sorted = [...participants].sort((a, b) => (placements[a] || 99) - (placements[b] || 99));

  const myDeck = myDecks.find((d) => d.id === myDeckId) || null;
  const praiseMeta = praiseType ? PRAISE_META[praiseType] : null;
  const praiseReceiverName = praiseReceiver ? memberData[praiseReceiver]?.display_name : null;

  return (
    <div className="space-y-4">

      {/* Setup summary */}
      <SectionCard title="Setup" onEdit={() => onEditStep(1)}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Mode</span>
          <span className="text-white font-medium capitalize">{mode}</span>
        </div>
        {pod && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">POD</span>
            <span className="text-white font-medium truncate max-w-[160px]">{pod.pod_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Format</span>
          <span className="text-white font-medium">Commander</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Date</span>
          <span className="text-white font-medium">{formatDateDisplay(playedAt)}</span>
        </div>
        {notes && (
          <div className="pt-1 border-t border-white/[0.04]">
            <p className="text-gray-500 text-xs mb-1">Notes</p>
            <p className="text-gray-300 text-xs leading-relaxed">{notes}</p>
          </div>
        )}
      </SectionCard>

      {/* Players & results */}
      <SectionCard title="Players & Results" onEdit={() => onEditStep(2)}>
        {/* My deck */}
        {myDeck && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
            style={{ background: "rgba(var(--ds-primary-rgb),0.07)", border: "1px solid rgba(var(--ds-primary-rgb),0.18)" }}
          >
            <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 flex-shrink-0 w-12">Your deck</span>
            <span className="text-sm text-white font-medium truncate flex-1">
              {myDeck.name}{myDeck.commander_name ? ` — ${myDeck.commander_name}` : ""}
            </span>
          </div>
        )}
        {sorted.map((uid) => (
          <PlayerRow
            key={uid}
            name={memberData[uid]?.display_name || uid}
            isYou={uid === currentUser?.id}
            placement={placements[uid]}
            avatarUrl={memberData[uid]?.avatar_url || null}
          />
        ))}
      </SectionCard>

      {/* Props */}
      <SectionCard title="Props" onEdit={() => onEditStep(3)}>
        {praiseReceiver && praiseMeta ? (
          <div className="flex items-center gap-3">
            <img src={PRAISE_ICONS[praiseType]} alt={praiseMeta.label} className="w-9 h-9 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--ds-primary-text)" }}>{praiseMeta.label}</p>
              {praiseReceiverName && (
                <p className="text-xs text-gray-500">for {formatName(praiseReceiverName)}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-700 text-sm italic">No props awarded</p>
        )}
      </SectionCard>

      {/* Final note */}
      <p className="text-center text-gray-600 text-xs pb-2 leading-relaxed">
        All participants will be notified to review and approve this game.
      </p>

    </div>
  );
}